import crypto from 'node:crypto';
import { sha256TimeStampReqOlustur, tsaYanitiniDogrula } from './Rfc3161Asn1Yardimcisi.ts';

export type DamgaDurumu = 'rfc3161_onayli' | 'sunucu_muhurlu' | 'yerel_ozet';

export interface ZamanDamgasiGirdisi {
  islemTuru: string;
  sozlesmeTuru: string;
  sozlesmeVersiyonu: string;
  ilgiliKayitId: string;
  sozlesmeMetni?: string;
  sozlesmeMetinHash?: string;
  kullaniciKimlik?: string;
  ekDetay?: string;
  ipAdresi: string;
}

export interface ZamanDamgasiSonucu {
  sunucuUtc: string;
  ipAdresi: string;
  ozetHash: string;
  sozlesmeMetinHash: string;
  tsaSaglayici: string;
  tsaTokenBase64: string;
  damgaDurumu: DamgaDurumu;
  sunucuImzasi: string;
}

const TSA_ZAMAN_ASIMI_MS = 3200;

const TSA_SAGLAYICILARI = [
  { ad: 'freetsa.org', url: 'https://freetsa.org/tsr' },
  { ad: 'digicert.com', url: 'http://timestamp.digicert.com' },
] as const;

// Gizli anahtar env üzerinden okunur; tanımlı değilse süreç içi rastgele anahtar üretilir.
const SUNUCU_IMZA_ANAHTARI =
  process.env.ZAMAN_DAMGASI_GIZLI_ANAHTARI?.trim() || crypto.randomBytes(32).toString('hex');

function sha256Hex(veri: string | Buffer): string {
  return crypto.createHash('sha256').update(veri).digest('hex');
}

function tsaIstegiGonder(url: string, reqDer: Buffer): Promise<Buffer> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/timestamp-query',
      Accept: 'application/timestamp-reply',
    },
    body: new Uint8Array(reqDer),
    signal: AbortSignal.timeout(TSA_ZAMAN_ASIMI_MS),
  }).then(async (yanit) => {
    if (!yanit.ok) {
      throw new Error(`TSA HTTP ${yanit.status}`);
    }
    const arrayBuf = await yanit.arrayBuffer();
    return Buffer.from(arrayBuf);
  });
}

export async function zamanDamgasiOlustur(
  girdi: ZamanDamgasiGirdisi
): Promise<ZamanDamgasiSonucu> {
  const sunucuUtc = new Date().toISOString();

  const sozlesmeMetinHash =
    girdi.sozlesmeMetni && girdi.sozlesmeMetni.trim()
      ? sha256Hex(girdi.sozlesmeMetni.trim())
      : girdi.sozlesmeMetinHash && /^[a-f0-9]{64}$/i.test(girdi.sozlesmeMetinHash.trim())
      ? girdi.sozlesmeMetinHash.trim().toLowerCase()
      : sha256Hex(`${girdi.sozlesmeTuru}:v${girdi.sozlesmeVersiyonu}`);

  const kanonikMetin = JSON.stringify({
    ekDetay: girdi.ekDetay || '',
    ilgiliKayitId: girdi.ilgiliKayitId,
    ipAdresi: girdi.ipAdresi,
    islemTuru: girdi.islemTuru,
    kullaniciKimlik: girdi.kullaniciKimlik || '',
    sozlesmeMetinHash,
    sozlesmeTuru: girdi.sozlesmeTuru,
    sozlesmeVersiyonu: girdi.sozlesmeVersiyonu,
    sunucuUtc,
  });

  const ozetBuffer = crypto.createHash('sha256').update(kanonikMetin).digest();
  const ozetHash = ozetBuffer.toString('hex');

  let tsaSaglayici = 'sunucu';
  let tsaTokenBase64 = '';
  let damgaDurumu: DamgaDurumu = 'sunucu_muhurlu';

  try {
    const tsaReqDer = sha256TimeStampReqOlustur(ozetBuffer);
    for (const saglayici of TSA_SAGLAYICILARI) {
      try {
        const yanitBuffer = await tsaIstegiGonder(saglayici.url, tsaReqDer);
        const dogrulama = tsaYanitiniDogrula(yanitBuffer);
        if (dogrulama.gecerli && dogrulama.tokenBase64) {
          tsaSaglayici = saglayici.ad;
          tsaTokenBase64 = dogrulama.tokenBase64;
          damgaDurumu = 'rfc3161_onayli';
          break;
        }
      } catch (tsaHatasi) {
        console.warn(
          `RFC 3161 TSA (${saglayici.ad}) erişilemedi, yedeğe geçiliyor:`,
          tsaHatasi instanceof Error ? tsaHatasi.message : String(tsaHatasi)
        );
      }
    }
  } catch (err) {
    console.warn('RFC 3161 istek hazırlama hatası:', err);
  }

  const sunucuImzasi = crypto
    .createHmac('sha256', SUNUCU_IMZA_ANAHTARI)
    .update(`${ozetHash}|${sunucuUtc}|${girdi.ipAdresi}|${tsaSaglayici}|${damgaDurumu}`)
    .digest('hex');

  return {
    sunucuUtc,
    ipAdresi: girdi.ipAdresi,
    ozetHash,
    sozlesmeMetinHash,
    tsaSaglayici,
    tsaTokenBase64,
    damgaDurumu,
    sunucuImzasi,
  };
}
