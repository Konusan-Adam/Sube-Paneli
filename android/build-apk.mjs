import { execFileSync, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apkImzalaNode, zipArsiviOlustur, zipGirdileriniOku } from './apkImzalayici.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJE_KOKU = path.resolve(__dirname, '..');

function jdkBinDizininiEkle() {
  const adaylar = [
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin') : '',
    '/opt/jdk-21/bin',
    '/usr/lib/jvm/java-21-openjdk-amd64/bin',
    '/usr/lib/jvm/default-java/bin',
  ].filter(Boolean);
  for (const dizin of adaylar) {
    if (fs.existsSync(path.join(dizin, 'keytool'))) {
      process.env.PATH = `${dizin}:${process.env.PATH || ''}`;
      return dizin;
    }
  }
  return '';
}

const JDK_BIN = jdkBinDizininiEkle();
const KEYTOOL_YOLU = JDK_BIN ? path.join(JDK_BIN, 'keytool') : 'keytool';
const JAVAC_YOLU = JDK_BIN ? path.join(JDK_BIN, 'javac') : 'javac';

const UYGULAMA_KIMLIK = 'com.afyonevlezzetleri.sube';
const UYGULAMA_ADI = 'Afyon Şube';
const APK_DOSYA_ADI = 'afyon-sube.apk';
const SURUM_KODU = 1;
const SURUM_ADI = '1.0.0';

const ANDROID_ANA = __dirname;
const KAYNAK_KLASORU = path.join(ANDROID_ANA, 'app', 'src', 'main');
const JAVA_KLASORU = path.join(KAYNAK_KLASORU, 'java');
const RES_KLASORU = path.join(KAYNAK_KLASORU, 'res');
const VARLIK_WWW_KLASORU = path.join(KAYNAK_KLASORU, 'assets', 'www');
const MANIFEST_YOLU = path.join(KAYNAK_KLASORU, 'AndroidManifest.xml');

const ANAHTAR_KLASORU = path.join(ANDROID_ANA, 'anahtar');
const ANAHTAR_DEPOSU_YOLU = path.join(ANAHTAR_KLASORU, 'afyon_sube.keystore');
const ANAHTAR_TAKMA_ADI = 'afyon_sube';
const DEPO_SIFRESI = process.env.AFYON_STORE_PASS || 'AfyonSube2026!';
const ANAHTAR_SIFRESI = process.env.AFYON_KEY_PASS || 'AfyonSube2026!';

const GECICI_KLASORU = path.join(ANDROID_ANA, 'gecici');
const SABLON_KLASORU = path.join(ANDROID_ANA, 'sablon');
const SABLON_APK_YOLU = path.join(SABLON_KLASORU, 'temel-sablon.apk');
const CIKTI_KLASORU = path.join(ANDROID_ANA, 'cikti');
const CIKTI_APK_YOLU = path.join(CIKTI_KLASORU, APK_DOSYA_ADI);
const CIKTI_META_YOLU = path.join(CIKTI_KLASORU, 'apk-meta.json');

function klasorTemizleVeOlustur(hedef) {
  fs.rmSync(hedef, { recursive: true, force: true });
  fs.mkdirSync(hedef, { recursive: true });
}

function wavTamponuUret(sureSn, ornekUretici) {
  const ornekHizi = 22050;
  const ornekSayisi = Math.floor(ornekHizi * sureSn);
  const veriBoyutu = ornekSayisi * 2;
  const tampon = Buffer.alloc(44 + veriBoyutu);

  tampon.write('RIFF', 0);
  tampon.writeUInt32LE(36 + veriBoyutu, 4);
  tampon.write('WAVE', 8);
  tampon.write('fmt ', 12);
  tampon.writeUInt32LE(16, 16);
  tampon.writeUInt16LE(1, 20);
  tampon.writeUInt16LE(1, 22);
  tampon.writeUInt32LE(ornekHizi, 24);
  tampon.writeUInt32LE(ornekHizi * 2, 28);
  tampon.writeUInt16LE(2, 32);
  tampon.writeUInt16LE(16, 34);
  tampon.write('data', 36);
  tampon.writeUInt32LE(veriBoyutu, 40);

  let faz1 = 0;
  let faz2 = 0;
  for (let i = 0; i < ornekSayisi; i++) {
    const t = i / ornekHizi;
    const { f1, f2, zarf, dalga } = ornekUretici(t, sureSn);
    faz1 += (2 * Math.PI * f1) / ornekHizi;
    faz2 += (2 * Math.PI * f2) / ornekHizi;

    let sinyal = 0;
    if (dalga === 'testere') {
      const s1 = ((faz1 / (2 * Math.PI)) % 1) * 2 - 1;
      const s2 = ((faz2 / (2 * Math.PI)) % 1) * 2 - 1;
      sinyal = (s1 + s2) * 0.5;
    } else if (dalga === 'kare') {
      const s1 = Math.sin(faz1) >= 0 ? 0.8 : -0.8;
      const s2 = Math.sin(faz2) >= 0 ? 0.4 : -0.4;
      sinyal = s1 + s2;
    } else {
      sinyal = Math.sin(faz1) * 0.65 + Math.sin(faz2) * 0.35;
    }

    const genlik = Math.max(-1, Math.min(1, sinyal * zarf));
    tampon.writeInt16LE(Math.round(genlik * 32000), 44 + i * 2);
  }
  return tampon;
}

function zilSesleriniHazirla() {
  const rawKlasor = path.join(RES_KLASORU, 'raw');
  const publicSesKlasor = path.join(PROJE_KOKU, 'public', 'sesler');
  fs.mkdirSync(rawKlasor, { recursive: true });
  fs.mkdirSync(publicSesKlasor, { recursive: true });

  const sesTanimlari = [
    {
      dosya: 'nukleer_siren.wav',
      sure: 2.0,
      uret: (t, toplam) => {
        const yukselen = t < 0.5 ? 460 + (t / 0.5) * 480 : t < 1.0 ? 940 - ((t - 0.5) / 0.5) * 420 : t < 1.5 ? 520 + ((t - 1.0) / 0.5) * 460 : 980 - ((t - 1.5) / 0.5) * 520;
        const solma = t < 0.05 ? t / 0.05 : t > toplam - 0.08 ? (toplam - t) / 0.08 : 1;
        return { f1: yukselen, f2: yukselen + 9, zarf: 0.85 * solma, dalga: 'testere' };
      },
    },
    {
      dosya: 'kristal_can.wav',
      sure: 1.6,
      uret: (t) => {
        const adim = t % 0.52;
        const frekans = t < 0.52 ? 1046.5 : t < 1.04 ? 1318.5 : 1567.98;
        const zarf = Math.exp(-adim * 5.2) * 0.9;
        return { f1: frekans, f2: frekans * 2.0, zarf, dalga: 'sinus' };
      },
    },
    {
      dosya: 'hizli_bip_alarm.wav',
      sure: 1.4,
      uret: (t) => {
        const vurus = t % 0.28;
        const aktif = vurus < 0.14 ? 1 : 0;
        return { f1: 880, f2: 1760, zarf: aktif * 0.72, dalga: 'kare' };
      },
    },
    {
      dosya: 'mutfak_zili.wav',
      sure: 1.5,
      uret: (t) => {
        const zil = t < 0.7 ? t : t - 0.7;
        const zarf = Math.exp(-zil * 4.2) * 0.92;
        return { f1: 1174.66, f2: 2349.32, zarf, dalga: 'sinus' };
      },
    },
  ];

  for (const tanim of sesTanimlari) {
    const icerik = wavTamponuUret(tanim.sure, tanim.uret);
    fs.writeFileSync(path.join(rawKlasor, tanim.dosya), icerik);
    fs.writeFileSync(path.join(publicSesKlasor, tanim.dosya), icerik);
  }
}

function ikonlariHazirla() {
  const kaynakLogo = path.join(PROJE_KOKU, 'public', 'marka_logosu.jpg');
  if (!fs.existsSync(kaynakLogo)) {
    throw new Error('public/marka_logosu.jpg bulunamadı.');
  }

  const yogunluklar = [
    { klasor: 'mipmap-mdpi', boyut: 48 },
    { klasor: 'mipmap-hdpi', boyut: 72 },
    { klasor: 'mipmap-xhdpi', boyut: 96 },
    { klasor: 'mipmap-xxhdpi', boyut: 144 },
    { klasor: 'mipmap-xxxhdpi', boyut: 192 },
  ];

  for (const y of yogunluklar) {
    const hedefKlasor = path.join(RES_KLASORU, y.klasor);
    fs.mkdirSync(hedefKlasor, { recursive: true });
    const kareIkon = path.join(hedefKlasor, 'uygulama_ikonu.png');
    const yuvarlakIkon = path.join(hedefKlasor, 'uygulama_ikonu_yuvarlak.png');

    if (!fs.existsSync(kareIkon)) {
      execFileSync('convert', [kaynakLogo, '-resize', `${y.boyut}x${y.boyut}^`, '-gravity', 'center', '-extent', `${y.boyut}x${y.boyut}`, `PNG32:${kareIkon}`]);
    }
    if (!fs.existsSync(yuvarlakIkon)) {
      fs.copyFileSync(kareIkon, yuvarlakIkon);
    }
  }
}

function anahtarDeposunuHazirla() {
  fs.mkdirSync(ANAHTAR_KLASORU, { recursive: true });
  if (!fs.existsSync(ANAHTAR_DEPOSU_YOLU)) {
    execFileSync(
      KEYTOOL_YOLU,
      [
        '-genkeypair',
        '-v',
        '-keystore',
        ANAHTAR_DEPOSU_YOLU,
        '-storetype',
        'PKCS12',
        '-alias',
        ANAHTAR_TAKMA_ADI,
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '10000',
        '-storepass',
        DEPO_SIFRESI,
        '-keypass',
        ANAHTAR_SIFRESI,
        '-dname',
        'CN=Afyon Ev Lezzetleri, OU=Sube Paneli, O=Afyon Ev Lezzetleri, L=Afyonkarahisar, ST=Afyonkarahisar, C=TR',
      ],
      { stdio: 'pipe' }
    );
  }
}

function webDerlemesiniHazirla() {
  const distKlasoru = path.join(PROJE_KOKU, 'dist');
  console.log('1/4 Web arayüzü derleniyor (vite build)...');
  execSync('npm run build', { cwd: PROJE_KOKU, stdio: 'inherit' });

  if (!fs.existsSync(path.join(distKlasoru, 'index.html'))) {
    throw new Error('dist/index.html üretilemedi.');
  }

  klasorTemizleVeOlustur(VARLIK_WWW_KLASORU);
  kopyalaFiltreli(distKlasoru, VARLIK_WWW_KLASORU);
}

function kopyalaFiltreli(kaynak, hedef) {
  fs.mkdirSync(hedef, { recursive: true });
  for (const oge of fs.readdirSync(kaynak, { withFileTypes: true })) {
    if (oge.name.endsWith('.apk') || oge.name.endsWith('.idsig')) {
      continue;
    }
    const kYol = path.join(kaynak, oge.name);
    const hYol = path.join(hedef, oge.name);
    if (oge.isDirectory()) {
      kopyalaFiltreli(kYol, hYol);
    } else if (oge.isFile()) {
      fs.copyFileSync(kYol, hYol);
    }
  }
}

function sdkAraclariniBul() {
  const sdkKok = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/opt/android-sdk';
  const buildToolsAna = path.join(sdkKok, 'build-tools');
  const platformsAna = path.join(sdkKok, 'platforms');
  if (!fs.existsSync(buildToolsAna) || !fs.existsSync(platformsAna)) {
    return null;
  }

  const surumler = fs.readdirSync(buildToolsAna).sort().reverse();
  const platformlar = fs.readdirSync(platformsAna).sort().reverse();
  if (surumler.length === 0 || platformlar.length === 0) {
    return null;
  }

  const bt = path.join(buildToolsAna, surumler[0]);
  const aapt2 = path.join(bt, 'aapt2');
  const d8 = path.join(bt, 'd8');
  const zipalign = path.join(bt, 'zipalign');
  const apksigner = path.join(bt, 'apksigner');
  const androidJar = path.join(platformsAna, platformlar[0], 'android.jar');

  if (![aapt2, d8, zipalign, apksigner, androidJar].every((p) => fs.existsSync(p))) {
    return null;
  }

  try {
    execFileSync(JAVAC_YOLU, ['-version'], { stdio: 'pipe' });
  } catch {
    return null;
  }

  return { aapt2, d8, zipalign, apksigner, androidJar };
}

function javaDosyalariniTopla(dizin, sonuc = []) {
  for (const oge of fs.readdirSync(dizin, { withFileTypes: true })) {
    const yol = path.join(dizin, oge.name);
    if (oge.isDirectory()) {
      javaDosyalariniTopla(yol, sonuc);
    } else if (oge.name.endsWith('.java')) {
      sonuc.push(yol);
    }
  }
  return sonuc;
}

function classDosyalariniTopla(dizin, sonuc = []) {
  for (const oge of fs.readdirSync(dizin, { withFileTypes: true })) {
    const yol = path.join(dizin, oge.name);
    if (oge.isDirectory()) {
      classDosyalariniTopla(yol, sonuc);
    } else if (oge.name.endsWith('.class')) {
      sonuc.push(yol);
    }
  }
  return sonuc;
}

function tamNativeDerle(sdk) {
  console.log('2/4 Tam Native Android derlemesi başlatılıyor (aapt2 + javac + d8)...');
  klasorTemizleVeOlustur(GECICI_KLASORU);
  fs.mkdirSync(SABLON_KLASORU, { recursive: true });
  fs.mkdirSync(CIKTI_KLASORU, { recursive: true });

  const resZip = path.join(GECICI_KLASORU, 'kaynaklar.zip');
  const hamApk = path.join(GECICI_KLASORU, 'ham.apk');
  const rJavaDizini = path.join(GECICI_KLASORU, 'uretildi_java');
  const sinifDizini = path.join(GECICI_KLASORU, 'siniflar');
  const dexDizini = path.join(GECICI_KLASORU, 'dex');
  const birlesikApk = path.join(GECICI_KLASORU, 'birlesik.apk');
  const hizaliApk = path.join(GECICI_KLASORU, 'hizali.apk');

  fs.mkdirSync(rJavaDizini, { recursive: true });
  fs.mkdirSync(sinifDizini, { recursive: true });
  fs.mkdirSync(dexDizini, { recursive: true });

  execFileSync(sdk.aapt2, ['compile', '--dir', RES_KLASORU, '-o', resZip], { stdio: 'inherit' });

  execFileSync(
    sdk.aapt2,
    [
      'link',
      '-o',
      hamApk,
      '-I',
      sdk.androidJar,
      '--manifest',
      MANIFEST_YOLU,
      '-R',
      resZip,
      '--java',
      rJavaDizini,
      '--min-sdk-version',
      '24',
      '--target-sdk-version',
      '34',
      '--version-code',
      String(SURUM_KODU),
      '--version-name',
      SURUM_ADI,
      '-A',
      path.join(KAYNAK_KLASORU, 'assets'),
      '--auto-add-overlay',
    ],
    { stdio: 'inherit' }
  );

  const javaDosyalari = [
    ...javaDosyalariniTopla(JAVA_KLASORU),
    ...javaDosyalariniTopla(rJavaDizini),
  ];

  execFileSync(
    JAVAC_YOLU,
    ['--release', '11', '-encoding', 'UTF-8', '-d', sinifDizini, '-cp', sdk.androidJar, ...javaDosyalari],
    { stdio: 'inherit' }
  );

  const classDosyalari = classDosyalariniTopla(sinifDizini);
  execFileSync(
    sdk.d8,
    ['--lib', sdk.androidJar, '--min-api', '24', '--output', dexDizini, ...classDosyalari],
    { stdio: 'inherit' }
  );

  console.log('3/4 APK birleştiriliyor ve hizalanıyor...');
  const hamGirdiler = zipGirdileriniOku(fs.readFileSync(hamApk));
  const dexVerisi = fs.readFileSync(path.join(dexDizini, 'classes.dex'));
  hamGirdiler.push({ ad: 'classes.dex', acikVeri: dexVerisi });

  const birlesik = zipArsiviOlustur(hamGirdiler);
  fs.writeFileSync(birlesikApk, birlesik.tampon);
  fs.copyFileSync(birlesikApk, SABLON_APK_YOLU);

  execFileSync(sdk.zipalign, ['-f', '-p', '4', birlesikApk, hizaliApk], { stdio: 'inherit' });

  console.log('4/4 APK v1 + v2 + v3 ile imzalanıyor...');
  execFileSync(
    sdk.apksigner,
    [
      'sign',
      '--ks',
      ANAHTAR_DEPOSU_YOLU,
      '--ks-key-alias',
      ANAHTAR_TAKMA_ADI,
      '--ks-pass',
      `pass:${DEPO_SIFRESI}`,
      '--key-pass',
      `pass:${ANAHTAR_SIFRESI}`,
      '--v1-signing-enabled',
      'true',
      '--v2-signing-enabled',
      'true',
      '--v3-signing-enabled',
      'true',
      '--min-sdk-version',
      '21',
      '--out',
      CIKTI_APK_YOLU,
      hizaliApk,
    ],
    { stdio: 'inherit' }
  );

  fs.rmSync(`${CIKTI_APK_YOLU}.idsig`, { force: true });
  execFileSync(sdk.apksigner, ['verify', '--verbose', CIKTI_APK_YOLU], { stdio: 'inherit' });
  return 'tam_native';
}

function sablonUzerindenDerle() {
  console.log('2/4 Android SDK bulunamadı; mevcut şablon APK güncellenip imzalanıyor...');
  let kaynakSablonYolu = SABLON_APK_YOLU;
  if (!fs.existsSync(kaynakSablonYolu) && fs.existsSync(CIKTI_APK_YOLU)) {
    fs.mkdirSync(SABLON_KLASORU, { recursive: true });
    fs.copyFileSync(CIKTI_APK_YOLU, SABLON_APK_YOLU);
    kaynakSablonYolu = SABLON_APK_YOLU;
  }
  if (!fs.existsSync(kaynakSablonYolu)) {
    throw new Error('Şablon APK bulunamadı: android/sablon/temel-sablon.apk');
  }
  klasorTemizleVeOlustur(GECICI_KLASORU);
  fs.mkdirSync(CIKTI_KLASORU, { recursive: true });

  const mevcutGirdiler = zipGirdileriniOku(fs.readFileSync(kaynakSablonYolu)).filter(
    (g) => !g.ad.startsWith('assets/www/') && !g.ad.startsWith('META-INF/')
  );

  function varlikEkle(dizin, onEk) {
    for (const oge of fs.readdirSync(dizin, { withFileTypes: true })) {
      const yol = path.join(dizin, oge.name);
      const zipAd = `${onEk}/${oge.name}`;
      if (oge.isDirectory()) {
        varlikEkle(yol, zipAd);
      } else if (oge.isFile() && !oge.name.endsWith('.apk') && !oge.name.endsWith('.idsig')) {
        mevcutGirdiler.push({ ad: zipAd, acikVeri: fs.readFileSync(yol) });
      }
    }
  }
  varlikEkle(VARLIK_WWW_KLASORU, 'assets/www');

  const guncelHamApk = path.join(GECICI_KLASORU, 'guncel_ham.apk');
  fs.writeFileSync(guncelHamApk, zipArsiviOlustur(mevcutGirdiler).tampon);

  const pemYolu = path.join(GECICI_KLASORU, 'anahtar.pem');
  const certPemYolu = path.join(GECICI_KLASORU, 'sertifika.pem');
  const certDerYolu = path.join(GECICI_KLASORU, 'sertifika.der');
  execFileSync(
    'openssl',
    [
      'pkcs12',
      '-in',
      ANAHTAR_DEPOSU_YOLU,
      '-nodes',
      '-nocerts',
      '-out',
      pemYolu,
      '-passin',
      `pass:${DEPO_SIFRESI}`,
    ],
    { stdio: 'pipe' }
  );
  execFileSync(
    'openssl',
    [
      'pkcs12',
      '-in',
      ANAHTAR_DEPOSU_YOLU,
      '-clcerts',
      '-nokeys',
      '-out',
      certPemYolu,
      '-passin',
      `pass:${DEPO_SIFRESI}`,
    ],
    { stdio: 'pipe' }
  );
  execFileSync(
    'openssl',
    ['x509', '-in', certPemYolu, '-outform', 'der', '-out', certDerYolu],
    { stdio: 'pipe' }
  );

  apkImzalaNode(
    guncelHamApk,
    CIKTI_APK_YOLU,
    fs.readFileSync(pemYolu, 'utf8'),
    fs.readFileSync(certDerYolu)
  );
  return 'sablon_imzali';
}

function ciktiyiDogrulaVeMetaYaz(yontem) {
  const apkTampon = fs.readFileSync(CIKTI_APK_YOLU);
  const girdiler = zipGirdileriniOku(apkTampon);
  const gomuluApk = girdiler.find((g) => g.ad.toLowerCase().endsWith('.apk'));
  if (gomuluApk) {
    throw new Error(`Güvenlik hatası: APK içinde başka bir APK gömülü (${gomuluApk.ad})!`);
  }

  const sha256 = crypto.createHash('sha256').update(apkTampon).digest('hex');
  const meta = {
    uygulamaKimlik: UYGULAMA_KIMLIK,
    uygulamaAdi: UYGULAMA_ADI,
    dosyaAdi: APK_DOSYA_ADI,
    surumKodu: SURUM_KODU,
    surumAdi: SURUM_ADI,
    boyutBayt: apkTampon.length,
    boyutMb: Number((apkTampon.length / (1024 * 1024)).toFixed(2)),
    sha256,
    uretimZamani: new Date().toISOString(),
    yontem,
    indirmeYolu: `/apk/${APK_DOSYA_ADI}`,
  };
  fs.writeFileSync(CIKTI_META_YOLU, JSON.stringify(meta, null, 2), 'utf8');
  fs.rmSync(GECICI_KLASORU, { recursive: true, force: true });

  console.log(`\nAPK başarıyla üretildi -> android/cikti/${APK_DOSYA_ADI} (${meta.boyutMb} MB)`);
  console.log(`Üstveri yazıldı -> android/cikti/apk-meta.json`);
}

function calistir() {
  zilSesleriniHazirla();
  ikonlariHazirla();
  anahtarDeposunuHazirla();
  webDerlemesiniHazirla();

  const sdk = sdkAraclariniBul();
  const yontem = sdk ? tamNativeDerle(sdk) : sablonUzerindenDerle();
  ciktiyiDogrulaVeMetaYaz(yontem);
}

calistir();
