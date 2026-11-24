import crypto from 'node:crypto';

/**
 * ASN.1 DER uzunluk alanını kodlar.
 */
function derUzunlukKodla(uzunluk: number): Buffer {
  if (uzunluk < 0x80) {
    return Buffer.from([uzunluk]);
  }
  const baytlar: number[] = [];
  let kalan = uzunluk;
  while (kalan > 0) {
    baytlar.unshift(kalan & 0xff);
    kalan >>= 8;
  }
  return Buffer.from([0x80 | baytlar.length, ...baytlar]);
}

function derTlvKodla(etiket: number, icerik: Buffer): Buffer {
  return Buffer.concat([Buffer.from([etiket]), derUzunlukKodla(icerik.length), icerik]);
}

function derSequence(ogeler: Buffer[]): Buffer {
  return derTlvKodla(0x30, Buffer.concat(ogeler));
}

function derPozitifInteger(baytlar: Buffer): Buffer {
  let baslangic = 0;
  while (baslangic < baytlar.length - 1 && baytlar[baslangic] === 0) {
    baslangic++;
  }
  let kesilmis = baytlar.subarray(baslangic);
  if (kesilmis.length === 0) {
    kesilmis = Buffer.from([0]);
  }
  if ((kesilmis[0] & 0x80) !== 0) {
    kesilmis = Buffer.concat([Buffer.from([0x00]), kesilmis]);
  }
  return derTlvKodla(0x02, kesilmis);
}

/**
 * SHA-256 (32 byte) özeti için RFC 3161 uyumlu TimeStampReq DER paketi üretir.
 * OID 2.16.840.1.101.3.4.2.1 (id-sha256) + NULL + nonce + certReq=TRUE
 */
export function sha256TimeStampReqOlustur(
  ozetBuffer: Buffer,
  nonceBuffer: Buffer = crypto.randomBytes(8)
): Buffer {
  if (ozetBuffer.length !== 32) {
    throw new Error('RFC 3161 TimeStampReq için 32 baytlık SHA-256 özeti gereklidir.');
  }

  // INTEGER 1 (RFC 3161 version = v1)
  const version = Buffer.from([0x02, 0x01, 0x01]);

  // SHA-256 AlgorithmIdentifier: SEQUENCE { OID 2.16.840.1.101.3.4.2.1, NULL }
  const sha256Oid = Buffer.from([
    0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
  ]);
  const nullParam = Buffer.from([0x05, 0x00]);
  const hashAlgorithm = derSequence([sha256Oid, nullParam]);

  // MessageImprint: SEQUENCE { hashAlgorithm, OCTET STRING hashedMessage }
  const hashedMessage = derTlvKodla(0x04, ozetBuffer);
  const messageImprint = derSequence([hashAlgorithm, hashedMessage]);

  // Nonce (pozitif INTEGER) + certReq (BOOLEAN TRUE = 0xFF)
  const nonce = derPozitifInteger(nonceBuffer);
  const certReq = Buffer.from([0x01, 0x01, 0xff]);

  return derSequence([version, messageImprint, nonce, certReq]);
}

interface DerEleman {
  etiket: number;
  baslangic: number;
  icerikBaslangic: number;
  icerikUzunluk: number;
  son: number;
}

function derElemanOku(buf: Buffer, offset: number): DerEleman | null {
  if (offset >= buf.length) return null;
  const etiket = buf[offset];
  if (offset + 1 >= buf.length) return null;

  const uzunlukIlk = buf[offset + 1];
  let icerikBaslangic = offset + 2;
  let icerikUzunluk = 0;

  if ((uzunlukIlk & 0x80) === 0) {
    icerikUzunluk = uzunlukIlk;
  } else {
    const uzunlukBaytSayisi = uzunlukIlk & 0x7f;
    if (uzunlukBaytSayisi === 0 || uzunlukBaytSayisi > 4) return null;
    if (offset + 2 + uzunlukBaytSayisi > buf.length) return null;
    for (let i = 0; i < uzunlukBaytSayisi; i++) {
      icerikUzunluk = (icerikUzunluk << 8) | buf[offset + 2 + i];
    }
    icerikBaslangic = offset + 2 + uzunlukBaytSayisi;
  }

  const son = icerikBaslangic + icerikUzunluk;
  if (son > buf.length) return null;

  return {
    etiket,
    baslangic: offset,
    icerikBaslangic,
    icerikUzunluk,
    son,
  };
}

export interface TsaDogrulamaSonucu {
  gecerli: boolean;
  pkiStatus: number;
  tokenBase64: string;
  hata?: string;
}

/**
 * TSA sunucusundan dönen DER TimeStampResp paketini doğrular.
 * PKIStatus 0 (granted) veya 1 (grantedWithMods) ve ContentInfo token varlığını kontrol eder.
 */
export function tsaYanitiniDogrula(yanitBuffer: Buffer): TsaDogrulamaSonucu {
  if (!yanitBuffer || yanitBuffer.length < 8) {
    return { gecerli: false, pkiStatus: -1, tokenBase64: '', hata: 'Boş veya eksik TSA yanıtı.' };
  }

  const disSequence = derElemanOku(yanitBuffer, 0);
  if (!disSequence || disSequence.etiket !== 0x30) {
    return { gecerli: false, pkiStatus: -1, tokenBase64: '', hata: 'Geçersiz ASN.1 SEQUENCE.' };
  }

  const pkiStatusInfo = derElemanOku(yanitBuffer, disSequence.icerikBaslangic);
  if (!pkiStatusInfo || pkiStatusInfo.etiket !== 0x30) {
    return { gecerli: false, pkiStatus: -1, tokenBase64: '', hata: 'PKIStatusInfo bulunamadı.' };
  }

  const statusInt = derElemanOku(yanitBuffer, pkiStatusInfo.icerikBaslangic);
  if (!statusInt || statusInt.etiket !== 0x02 || statusInt.icerikUzunluk < 1) {
    return { gecerli: false, pkiStatus: -1, tokenBase64: '', hata: 'PKIStatus değeri okunamadı.' };
  }

  const pkiStatus = yanitBuffer[statusInt.icerikBaslangic];
  if (pkiStatus !== 0 && pkiStatus !== 1) {
    return {
      gecerli: false,
      pkiStatus,
      tokenBase64: '',
      hata: `TSA isteği reddetti (PKIStatus=${pkiStatus}).`,
    };
  }

  if (pkiStatusInfo.son >= disSequence.son) {
    return {
      gecerli: false,
      pkiStatus,
      tokenBase64: '',
      hata: 'TimeStampToken içeriği bulunamadı.',
    };
  }

  const tokenElemani = derElemanOku(yanitBuffer, pkiStatusInfo.son);
  if (!tokenElemani || tokenElemani.etiket !== 0x30 || tokenElemani.icerikUzunluk < 16) {
    return {
      gecerli: false,
      pkiStatus,
      tokenBase64: '',
      hata: 'Geçersiz TimeStampToken yapısı.',
    };
  }

  return {
    gecerli: true,
    pkiStatus,
    tokenBase64: yanitBuffer.subarray(tokenElemani.baslangic, tokenElemani.son).toString('base64'),
  };
}
