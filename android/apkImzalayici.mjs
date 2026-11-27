import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';

const APK_IMZA_BLOK_SIHIRLI = Buffer.from('APK Sig Block 42', 'ascii');
const APK_V2_BLOK_KIMLIK = 0x7109871a;
const APK_V3_BLOK_KIMLIK = 0xf05368c0;
const IMZA_ALGORITMA_RSA_PKCS1_SHA256 = 0x0103;

function crc32Hesapla(tampon) {
  let crc = 0xffffffff;
  for (let i = 0; i < tampon.length; i++) {
    crc ^= tampon[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipGirdileriniOku(zipTampon) {
  let eocdKonum = -1;
  const enAz = Math.max(0, zipTampon.length - 65558);
  for (let i = zipTampon.length - 22; i >= enAz; i--) {
    if (
      zipTampon[i] === 0x50 &&
      zipTampon[i + 1] === 0x4b &&
      zipTampon[i + 2] === 0x05 &&
      zipTampon[i + 3] === 0x06
    ) {
      eocdKonum = i;
      break;
    }
  }
  if (eocdKonum < 0) {
    throw new Error('Geçersiz ZIP/APK: EOCD kaydı bulunamadı.');
  }

  const cdSayisi = zipTampon.readUInt16LE(eocdKonum + 10);
  const cdKonum = zipTampon.readUInt32LE(eocdKonum + 16);
  const girdiler = [];
  let imlec = cdKonum;

  for (let k = 0; k < cdSayisi; k++) {
    if (zipTampon.readUInt32LE(imlec) !== 0x02014b50) {
      throw new Error('Geçersiz ZIP Central Directory imzası.');
    }
    const yontem = zipTampon.readUInt16LE(imlec + 10);
    const crc = zipTampon.readUInt32LE(imlec + 16);
    const sikistirilmisBoyut = zipTampon.readUInt32LE(imlec + 20);
    const acikBoyut = zipTampon.readUInt32LE(imlec + 24);
    const adUzunluk = zipTampon.readUInt16LE(imlec + 28);
    const ekstraUzunluk = zipTampon.readUInt16LE(imlec + 30);
    const yorumUzunluk = zipTampon.readUInt16LE(imlec + 32);
    const yerelBaslikKonum = zipTampon.readUInt32LE(imlec + 42);
    const ad = zipTampon.toString('utf8', imlec + 46, imlec + 46 + adUzunluk);

    const yerelAdUzunluk = zipTampon.readUInt16LE(yerelBaslikKonum + 26);
    const yerelEkstraUzunluk = zipTampon.readUInt16LE(yerelBaslikKonum + 28);
    const veriBaslangic = yerelBaslikKonum + 30 + yerelAdUzunluk + yerelEkstraUzunluk;
    const sikistirilmisVeri = zipTampon.subarray(veriBaslangic, veriBaslangic + sikistirilmisBoyut);

    let acikVeri = null;
    if (yontem === 0) {
      acikVeri = Buffer.from(sikistirilmisVeri);
    } else if (yontem === 8) {
      acikVeri = zlib.inflateRawSync(sikistirilmisVeri);
    } else {
      throw new Error(`Desteklenmeyen ZIP sıkıştırma yöntemi (${yontem}): ${ad}`);
    }

    girdiler.push({
      ad,
      yontem,
      crc,
      acikBoyut,
      sikistirilmisVeri: Buffer.from(sikistirilmisVeri),
      acikVeri,
    });

    imlec += 46 + adUzunluk + ekstraUzunluk + yorumUzunluk;
  }

  return girdiler;
}

export function zipArsiviOlustur(girdiler) {
  const yerelParcalar = [];
  const cdParcalar = [];
  let konum = 0;

  for (const girdi of girdiler) {
    const adTampon = Buffer.from(girdi.ad, 'utf8');
    const sikistirilmasin =
      girdi.sikistirilmasin ||
      girdi.ad === 'resources.arsc' ||
      /\.(png|jpg|jpeg|webp|wav|mp3|ogg|arsc)$/i.test(girdi.ad);

    const acikVeri = girdi.acikVeri ?? zlib.inflateRawSync(girdi.sikistirilmisVeri);
    const crc = crc32Hesapla(acikVeri);

    let yontem = 8;
    let veri = null;
    if (sikistirilmasin) {
      yontem = 0;
      veri = acikVeri;
    } else {
      const sikistirilmis = zlib.deflateRawSync(acikVeri, { level: 6 });
      if (sikistirilmis.length < acikVeri.length) {
        yontem = 8;
        veri = sikistirilmis;
      } else {
        yontem = 0;
        veri = acikVeri;
      }
    }

    let ekstraUzunluk = 0;
    if (yontem === 0) {
      const hizaMod = (konum + 30 + adTampon.length) % 4;
      if (hizaMod !== 0) {
        ekstraUzunluk = 4 - hizaMod;
      }
    }
    const ekstraTampon = Buffer.alloc(ekstraUzunluk, 0);

    const yerelBaslik = Buffer.alloc(30);
    yerelBaslik.writeUInt32LE(0x04034b50, 0);
    yerelBaslik.writeUInt16LE(20, 4);
    yerelBaslik.writeUInt16LE(0x0800, 6);
    yerelBaslik.writeUInt16LE(yontem, 8);
    yerelBaslik.writeUInt16LE(0, 10);
    yerelBaslik.writeUInt16LE(0x4e21, 12);
    yerelBaslik.writeUInt32LE(crc, 14);
    yerelBaslik.writeUInt32LE(veri.length, 18);
    yerelBaslik.writeUInt32LE(acikVeri.length, 22);
    yerelBaslik.writeUInt16LE(adTampon.length, 26);
    yerelBaslik.writeUInt16LE(ekstraUzunluk, 28);

    const cdKayit = Buffer.alloc(46);
    cdKayit.writeUInt32LE(0x02014b50, 0);
    cdKayit.writeUInt16LE(20, 4);
    cdKayit.writeUInt16LE(20, 6);
    cdKayit.writeUInt16LE(0x0800, 8);
    cdKayit.writeUInt16LE(yontem, 10);
    cdKayit.writeUInt16LE(0, 12);
    cdKayit.writeUInt16LE(0x4e21, 14);
    cdKayit.writeUInt32LE(crc, 16);
    cdKayit.writeUInt32LE(veri.length, 20);
    cdKayit.writeUInt32LE(acikVeri.length, 24);
    cdKayit.writeUInt16LE(adTampon.length, 28);
    cdKayit.writeUInt16LE(0, 30);
    cdKayit.writeUInt16LE(0, 32);
    cdKayit.writeUInt16LE(0, 34);
    cdKayit.writeUInt16LE(0, 36);
    cdKayit.writeUInt32LE(0, 38);
    cdKayit.writeUInt32LE(konum, 42);

    yerelParcalar.push(yerelBaslik, adTampon, ekstraTampon, veri);
    cdParcalar.push(cdKayit, adTampon);
    konum += yerelBaslik.length + adTampon.length + ekstraTampon.length + veri.length;
  }

  const cdKonum = konum;
  const cdTampon = Buffer.concat(cdParcalar);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(girdiler.length, 8);
  eocd.writeUInt16LE(girdiler.length, 10);
  eocd.writeUInt32LE(cdTampon.length, 12);
  eocd.writeUInt32LE(cdKonum, 16);
  eocd.writeUInt16LE(0, 20);

  return {
    tampon: Buffer.concat([...yerelParcalar, cdTampon, eocd]),
    cdKonum,
    cdBoyut: cdTampon.length,
    eocdKonum: cdKonum + cdTampon.length,
  };
}

function derUzunlukKodla(uzunluk) {
  if (uzunluk < 128) return Buffer.from([uzunluk]);
  const baytlar = [];
  let gecici = uzunluk;
  while (gecici > 0) {
    baytlar.unshift(gecici & 0xff);
    gecici >>= 8;
  }
  return Buffer.from([0x80 | baytlar.length, ...baytlar]);
}

function derBlok(etiket, icerik) {
  const uzunluk = derUzunlukKodla(icerik.length);
  return Buffer.concat([Buffer.from([etiket]), uzunluk, icerik]);
}

function derOid(oidMetni) {
  const parcalar = oidMetni.split('.').map(Number);
  const sonuc = [parcalar[0] * 40 + parcalar[1]];
  for (let i = 2; i < parcalar.length; i++) {
    let deger = parcalar[i];
    if (deger < 128) {
      sonuc.push(deger);
    } else {
      const grup = [];
      grup.unshift(deger & 0x7f);
      deger >>= 7;
      while (deger > 0) {
        grup.unshift((deger & 0x7f) | 0x80);
        deger >>= 7;
      }
      sonuc.push(...grup);
    }
  }
  return derBlok(0x06, Buffer.from(sonuc));
}

function derTamsayi(tampon) {
  let kopya = Buffer.from(tampon);
  while (kopya.length > 1 && kopya[0] === 0x00 && (kopya[1] & 0x80) === 0) {
    kopya = kopya.subarray(1);
  }
  if (kopya[0] & 0x80) {
    kopya = Buffer.concat([Buffer.from([0x00]), kopya]);
  }
  return derBlok(0x02, kopya);
}

function derAlgoritmaKimligi(oid) {
  return derBlok(0x30, Buffer.concat([derOid(oid), Buffer.from([0x05, 0x00])]));
}

function pkcs7ImzaBlokuOlustur(sfTampon, ozelAnahtarPem, sertifikaDer) {
  const x509 = new crypto.X509Certificate(sertifikaDer);
  const hamCert = x509.raw;

  // X.509 TBSCertificate içinden issuer ve serialNumber çıkar
  let imlec = 0;
  function tlvOku(buf, pos) {
    const etiket = buf[pos];
    let lenByte = buf[pos + 1];
    let baslikBoy = 2;
    let uzunluk = lenByte;
    if (lenByte & 0x80) {
      const n = lenByte & 0x7f;
      uzunluk = 0;
      for (let i = 0; i < n; i++) {
        uzunluk = (uzunluk << 8) | buf[pos + 2 + i];
      }
      baslikBoy = 2 + n;
    }
    return {
      etiket,
      baslangic: pos,
      icerikBaslangic: pos + baslikBoy,
      toplamSon: pos + baslikBoy + uzunluk,
      ham: buf.subarray(pos, pos + baslikBoy + uzunluk),
    };
  }

  const kokSeq = tlvOku(hamCert, imlec);
  const tbsSeq = tlvOku(hamCert, kokSeq.icerikBaslangic);
  let tbsImlec = tbsSeq.icerikBaslangic;
  const ilkEleman = tlvOku(hamCert, tbsImlec);
  if ((ilkEleman.etiket & 0xe0) === 0xa0) {
    tbsImlec = ilkEleman.toplamSon;
  }
  const seriEleman = tlvOku(hamCert, tbsImlec);
  const algEleman = tlvOku(hamCert, seriEleman.toplamSon);
  const yayinciEleman = tlvOku(hamCert, algEleman.toplamSon);

  const imzaci = crypto.createSign('RSA-SHA256');
  imzaci.update(sfTampon);
  const imzaBaytlari = imzaci.sign(ozelAnahtarPem);

  const sha256Oid = derAlgoritmaKimligi('2.16.840.1.101.3.4.2.1');
  const rsaOid = derAlgoritmaKimligi('1.2.840.113549.1.1.1');
  const issuerAndSerial = derBlok(0x30, Buffer.concat([yayinciEleman.ham, seriEleman.ham]));

  const signerInfo = derBlok(
    0x30,
    Buffer.concat([
      derTamsayi(Buffer.from([1])),
      issuerAndSerial,
      sha256Oid,
      rsaOid,
      derBlok(0x04, imzaBaytlari),
    ])
  );

  const signedData = derBlok(
    0x30,
    Buffer.concat([
      derTamsayi(Buffer.from([1])),
      derBlok(0x31, sha256Oid),
      derBlok(0x30, derOid('1.2.840.113549.1.7.1')),
      derBlok(0xa0, rawCertSlice(hamCert)),
      derBlok(0x31, signerInfo),
    ])
  );

  return derBlok(
    0x30,
    Buffer.concat([derOid('1.2.840.113549.1.7.2'), derBlok(0xa0, signedData)])
  );
}

function rawCertSlice(buf) {
  return Buffer.from(buf);
}

function uzunlukOnekle(tampon) {
  const bas = Buffer.alloc(4);
  bas.writeUInt32LE(tampon.length, 0);
  return Buffer.concat([bas, tampon]);
}

function apkBolumOzetleriniHesapla(bolum1, bolum3, bolum4) {
  const parcaBoyutu = 1024 * 1024;
  const parcaOzetleri = [];

  for (const bolum of [bolum1, bolum3, bolum4]) {
    for (let i = 0; i < bolum.length; i += parcaBoyutu) {
      const parca = bolum.subarray(i, Math.min(i + parcaBoyutu, bolum.length));
      const onek = Buffer.alloc(5);
      onek[0] = 0xa5;
      onek.writeUInt32LE(parca.length, 1);
      const hasher = crypto.createHash('sha256');
      hasher.update(onek);
      hasher.update(parca);
      parcaOzetleri.push(hasher.digest());
    }
  }

  const ustOnek = Buffer.alloc(5);
  ustOnek[0] = 0x5a;
  ustOnek.writeUInt32LE(parcaOzetleri.length, 1);
  const kokHasher = crypto.createHash('sha256');
  kokHasher.update(ustOnek);
  for (const ozet of parcaOzetleri) {
    kokHasher.update(ozet);
  }
  return kokHasher.digest();
}

export function apkImzalaNode(girdiApkYolu, ciktiApkYolu, ozelAnahtarPem, sertifikaDer) {
  const hamApk = fs.readFileSync(girdiApkYolu);
  const tumGirdiler = zipGirdileriniOku(hamApk);

  // Eski imza kayıtlarını çıkar
  const temizGirdiler = tumGirdiler.filter(
    (g) => !g.ad.startsWith('META-INF/')
  );

  // JAR v1 Manifest ve SF oluştur
  const manifestSatirlari = ['Manifest-Version: 1.0', 'Created-By: Afyon Sube ApkImzalayici', ''];
  const sfGirdiSatirlari = [];

  for (const g of temizGirdiler) {
    const sha256B64 = crypto.createHash('sha256').update(g.acikVeri).digest('base64');
    const blokMetin = `Name: ${g.ad}\r\nSHA-256-Digest: ${sha256B64}\r\n\r\n`;
    manifestSatirlari.push(`Name: ${g.ad}`, `SHA-256-Digest: ${sha256B64}`, '');
    const blokSha256B64 = crypto
      .createHash('sha256')
      .update(Buffer.from(blokMetin, 'utf8'))
      .digest('base64');
    sfGirdiSatirlari.push(`Name: ${g.ad}\r\nSHA-256-Digest: ${blokSha256B64}\r\n\r\n`);
  }

  const manifestTampon = Buffer.from(manifestSatirlari.join('\r\n'), 'utf8');
  const manifestTumSha = crypto.createHash('sha256').update(manifestTampon).digest('base64');
  const sfMetin =
    `Signature-Version: 1.0\r\n` +
    `Created-By: Afyon Sube ApkImzalayici\r\n` +
    `SHA-256-Digest-Manifest: ${manifestTumSha}\r\n` +
    `X-Android-APK-Signed: 2, 3\r\n\r\n` +
    sfGirdiSatirlari.join('');
  const sfTampon = Buffer.from(sfMetin, 'utf8');
  const rsaTampon = pkcs7ImzaBlokuOlustur(sfTampon, ozelAnahtarPem, sertifikaDer);

  const imzaliGirdiler = [
    ...temizGirdiler,
    { ad: 'META-INF/MANIFEST.MF', acikVeri: manifestTampon },
    { ad: 'META-INF/AFYON.SF', acikVeri: sfTampon },
    { ad: 'META-INF/AFYON.RSA', acikVeri: rsaTampon },
  ];

  const arsiv = zipArsiviOlustur(imzaliGirdiler);
  const bolum1 = arsiv.tampon.subarray(0, arsiv.cdKonum);
  const bolum3 = arsiv.tampon.subarray(arsiv.cdKonum, arsiv.eocdKonum);
  const bolum4Tam = Buffer.from(arsiv.tampon.subarray(arsiv.eocdKonum));

  const ozet = apkBolumOzetleriniHesapla(bolum1, bolum3, bolum4Tam);
  const acikAnahtarDer = new crypto.X509Certificate(sertifikaDer).publicKey.export({
    type: 'spki',
    format: 'der',
  });

  const algTampon = Buffer.alloc(4);
  algTampon.writeUInt32LE(IMZA_ALGORITMA_RSA_PKCS1_SHA256, 0);

  // v2 SignedData
  const v2OzetKayit = uzunlukOnekle(Buffer.concat([algTampon, uzunlukOnekle(ozet)]));
  const v2Ozetler = uzunlukOnekle(v2OzetKayit);
  const v2Sertifikalar = uzunlukOnekle(uzunlukOnekle(sertifikaDer));
  const v2EkNitelikler = Buffer.alloc(4, 0);
  const v2SignedData = Buffer.concat([v2Ozetler, v2Sertifikalar, v2EkNitelikler]);

  const v2Imza = crypto.sign('RSA-SHA256', v2SignedData, ozelAnahtarPem);
  const v2Imzalar = uzunlukOnekle(
    uzunlukOnekle(Buffer.concat([algTampon, uzunlukOnekle(v2Imza)]))
  );
  const v2Imzaci = uzunlukOnekle(
    Buffer.concat([uzunlukOnekle(v2SignedData), v2Imzalar, uzunlukOnekle(acikAnahtarDer)])
  );
  const v2ImzaDegeri = uzunlukOnekle(v2Imzaci);

  // v3 SignedData (minSDK=24, maxSDK=0x7fffffff)
  const minSdkBuf = Buffer.alloc(4);
  minSdkBuf.writeUInt32LE(24, 0);
  const maxSdkBuf = Buffer.alloc(4);
  maxSdkBuf.writeUInt32LE(0x7fffffff, 0);
  const v3SignedData = Buffer.concat([
    v2Ozetler,
    v2Sertifikalar,
    minSdkBuf,
    maxSdkBuf,
    v2EkNitelikler,
  ]);
  const v3Imza = crypto.sign('RSA-SHA256', v3SignedData, ozelAnahtarPem);
  const v3Imzalar = uzunlukOnekle(
    uzunlukOnekle(Buffer.concat([algTampon, uzunlukOnekle(v3Imza)]))
  );
  const v3Imzaci = uzunlukOnekle(
    Buffer.concat([
      uzunlukOnekle(v3SignedData),
      minSdkBuf,
      maxSdkBuf,
      v3Imzalar,
      uzunlukOnekle(acikAnahtarDer),
    ])
  );
  const v3ImzaDegeri = uzunlukOnekle(v3Imzaci);

  function ciftBlokOlustur(kimlik, deger) {
    const icerik = Buffer.alloc(4 + deger.length);
    icerik.writeUInt32LE(kimlik, 0);
    deger.copy(icerik, 4);
    const boyut = Buffer.alloc(8);
    boyut.writeBigUInt64LE(BigInt(icerik.length), 0);
    return Buffer.concat([boyut, icerik]);
  }

  const v2Blok = ciftBlokOlustur(APK_V2_BLOK_KIMLIK, v2ImzaDegeri);
  const v3Blok = ciftBlokOlustur(APK_V3_BLOK_KIMLIK, v3ImzaDegeri);
  const blokGovdeBoyut = 8 + v2Blok.length + v3Blok.length + 8 + 16;
  const dolguBoy = (4096 - ((bolum1.length + blokGovdeBoyut) % 4096)) % 4096;
  const dolguBlok = dolguBoy >= 12 ? ciftBlokOlustur(0x42726577, Buffer.alloc(dolguBoy - 12, 0)) : Buffer.alloc(0);

  const blokBoyutu = BigInt(v2Blok.length + v3Blok.length + dolguBlok.length + 8 + 16);
  const ustBoyut = Buffer.alloc(8);
  ustBoyut.writeBigUInt64LE(blokBoyutu, 0);
  const altBoyut = Buffer.alloc(8);
  altBoyut.writeBigUInt64LE(blokBoyutu, 0);

  const apkImzaBloku = Buffer.concat([
    ustBoyut,
    v2Blok,
    v3Blok,
    dolguBlok,
    altBoyut,
    APK_IMZA_BLOK_SIHIRLI,
  ]);

  const yeniCdKonum = bolum1.length + apkImzaBloku.length;
  bolum4Tam.writeUInt32LE(yeniCdKonum, 16);

  const nihaiApk = Buffer.concat([bolum1, apkImzaBloku, bolum3, bolum4Tam]);
  fs.writeFileSync(ciktiApkYolu, nihaiApk);
}
