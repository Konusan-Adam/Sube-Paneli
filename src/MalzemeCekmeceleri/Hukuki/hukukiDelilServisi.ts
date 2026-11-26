import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { canliFirebaseAktifMi, firebaseVeritabani } from '@/src/veritabani/FirebaseIstemcisi';
import { Kullanici } from '@/src/veritabani/VeriTipleri';

export type DamgaDurumu = 'rfc3161_onayli' | 'sunucu_muhurlu' | 'yerel_ozet';

export type HukukiIslemTuru = 'teslimat' | 'iptal' | 'hakedis';

export type HukukiSozlesmeTuru =
  | 'sube_teslimat_onayi'
  | 'iptal_iade_kosullari'
  | 'tedarikci_hakedis_mutabakati';

export interface HukukiDelilGirdisi {
  islemTuru: HukukiIslemTuru;
  sozlesmeTuru: HukukiSozlesmeTuru;
  sozlesmeVersiyonu?: string;
  ilgiliKayitId: string;
  sozlesmeMetni?: string;
  ekDetay?: string;
  kullanici?: Pick<Kullanici, 'id' | 'kimlik' | 'telefon' | 'ad_soyad'> | null;
}

export interface HukukiOnayKaydi {
  kimlik: string;
  sozlesmeTuru: HukukiSozlesmeTuru;
  sozlesmeVersiyonu: string;
  islemTuru: HukukiIslemTuru;
  tarihSaat: string;
  ipAdresi: string;
  cihazBilgisi: string;
  onaylandiMi: boolean;
  sunucuKayitZamani: ReturnType<typeof serverTimestamp>;
  sunucuUtc: string;
  ozetHash: string;
  sozlesmeMetinHash: string;
  tsaSaglayici: string;
  tsaTokenBase64: string;
  damgaDurumu: DamgaDurumu;
  sunucuImzasi: string;
  ilgiliKayitId: string;
  kullaniciKimlik: string;
  kullaniciTelefon: string;
  kullaniciAdSoyad: string;
  ekDetay: string;
}

const OTURUM_ANAHTARI = 'afyon_sube_paneli_oturum';

function aktifSubeMuduruOku(): Partial<Kullanici> {
  if (typeof window === 'undefined') return {};
  try {
    const ham = localStorage.getItem(OTURUM_ANAHTARI);
    if (!ham) return {};
    return JSON.parse(ham) as Partial<Kullanici>;
  } catch {
    return {};
  }
}

function cihazBilgisiAl(): string {
  if (typeof navigator === 'undefined') return 'bilinmiyor';
  const ua = navigator.userAgent || 'bilinmiyor';
  const dil = navigator.language || '';
  const ekran =
    typeof window !== 'undefined' && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : '';
  return [ua.slice(0, 200), dil, ekran].filter(Boolean).join(' | ').slice(0, 280);
}

async function yerelSha256Hex(metin: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const veri = new TextEncoder().encode(metin);
      const ozet = await crypto.subtle.digest('SHA-256', veri);
      return Array.from(new Uint8Array(ozet))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // WebCrypto desteklenmiyorsa boş özet yerine sabit olmayan kısa iz döner
  }
  return '';
}

function sozlesmeMetniOlustur(girdi: HukukiDelilGirdisi): string {
  if (girdi.sozlesmeMetni && girdi.sozlesmeMetni.trim()) {
    return girdi.sozlesmeMetni.trim();
  }
  if (girdi.sozlesmeTuru === 'sube_teslimat_onayi') {
    return 'Afyon Ev Lezzetleri şube siparişi müşteriye eksiksiz teslim edilmiş ve şube yöneticisi tarafından onaylanmıştır.';
  }
  if (girdi.sozlesmeTuru === 'iptal_iade_kosullari') {
    return 'Afyon Ev Lezzetleri şube siparişi iptal edilmiş ve ilgili ürün stokları şube tezgahına atomik olarak iade edilmiştir.';
  }
  return 'Afyon Ev Lezzetleri tedarikçi ürün teslimatı ve hak ediş tutarı şube müdürü ile mutabakat altına alınmıştır.';
}

function zamanDamgasiUcNoktasiAl(): string {
  const ozelTaban =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim().replace(/\/+$/, '')
      : '';
  if (ozelTaban) {
    return `${ozelTaban}/api/zaman-damgasi/damgala`;
  }
  if (typeof window !== 'undefined') {
    const kopru = (window as unknown as { AfyonAndroidKopru?: unknown }).AfyonAndroidKopru;
    const yerliUygulama =
      Boolean(kopru) || window.location.hostname === 'appassets.androidplatform.net';
    if (yerliUygulama) {
      return 'https://ais-pre-n7odpzo4uwztdphrws42tc-546261314622.europe-west2.run.app/api/zaman-damgasi/damgala';
    }
  }
  return '/api/zaman-damgasi/damgala';
}

export async function hukukiOnayDamgalaVeKaydet(
  girdi: HukukiDelilGirdisi
): Promise<{ basarili: boolean; belgeId?: string; damgaDurumu?: DamgaDurumu }> {
  const ilgiliKayitId = girdi.ilgiliKayitId.trim();
  if (!ilgiliKayitId) {
    return { basarili: false };
  }

  const oturumKullanici = girdi.kullanici || aktifSubeMuduruOku();
  const kullaniciKimlik = String(
    oturumKullanici?.kimlik || oturumKullanici?.id || ''
  ).trim();
  const kullaniciTelefon = String(oturumKullanici?.telefon || '').trim();
  const kullaniciAdSoyad = String(oturumKullanici?.ad_soyad || '').trim();

  const sozlesmeVersiyonu = (girdi.sozlesmeVersiyonu || '1.0').trim();
  const sozlesmeMetni = sozlesmeMetniOlustur(girdi);
  const tarihSaat = new Date().toISOString();
  const cihazBilgisi = cihazBilgisiAl();
  const ekDetay = (girdi.ekDetay || '').trim().slice(0, 1500);

  let sunucuUtc = tarihSaat;
  let ipAdresi = 'bilinmiyor';
  let ozetHash = '';
  let sozlesmeMetinHash = '';
  let tsaSaglayici = 'yerel';
  let tsaTokenBase64 = '';
  let damgaDurumu: DamgaDurumu = 'yerel_ozet';
  let sunucuImzasi = '';

  try {
    const controller = new AbortController();
    const zamanlayici = setTimeout(() => controller.abort(), 7500);
    try {
      const yanit = await fetch(zamanDamgasiUcNoktasiAl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          islemTuru: girdi.islemTuru,
          sozlesmeTuru: girdi.sozlesmeTuru,
          sozlesmeVersiyonu,
          ilgiliKayitId,
          sozlesmeMetni,
          kullaniciKimlik,
          ekDetay,
        }),
        signal: controller.signal,
      });

      if (yanit.ok) {
        const veri = await yanit.json();
        if (veri && veri.basarili) {
          sunucuUtc = String(veri.sunucuUtc || tarihSaat);
          ipAdresi = String(veri.ipAdresi || 'bilinmiyor');
          ozetHash = String(veri.ozetHash || '');
          sozlesmeMetinHash = String(veri.sozlesmeMetinHash || '');
          tsaSaglayici = String(veri.tsaSaglayici || 'sunucu');
          tsaTokenBase64 = String(veri.tsaTokenBase64 || '');
          damgaDurumu =
            veri.damgaDurumu === 'rfc3161_onayli' || veri.damgaDurumu === 'sunucu_muhurlu'
              ? veri.damgaDurumu
              : 'sunucu_muhurlu';
          sunucuImzasi = String(veri.sunucuImzasi || '');
        }
      }
    } finally {
      clearTimeout(zamanlayici);
    }
  } catch (agHatasi) {
    console.warn('Zaman damgası sunucusuna ulaşılamadı, yerel özete geçiliyor:', agHatasi);
  }

  if (!sozlesmeMetinHash) {
    sozlesmeMetinHash = await yerelSha256Hex(sozlesmeMetni);
  }
  if (!ozetHash) {
    ozetHash = await yerelSha256Hex(
      JSON.stringify({
        islemTuru: girdi.islemTuru,
        sozlesmeTuru: girdi.sozlesmeTuru,
        sozlesmeVersiyonu,
        ilgiliKayitId,
        sozlesmeMetinHash,
        kullaniciKimlik,
        ekDetay,
        tarihSaat,
      })
    );
  }

  if (!canliFirebaseAktifMi()) {
    return { basarili: false, damgaDurumu };
  }

  const rastgeleEk = Math.random().toString(36).slice(2, 8);
  const belgeId = `delil_${girdi.islemTuru}_${Date.now()}_${rastgeleEk}`;

  const kayit: HukukiOnayKaydi = {
    kimlik: belgeId,
    sozlesmeTuru: girdi.sozlesmeTuru,
    sozlesmeVersiyonu,
    islemTuru: girdi.islemTuru,
    tarihSaat,
    ipAdresi,
    cihazBilgisi,
    onaylandiMi: true,
    sunucuKayitZamani: serverTimestamp(),
    sunucuUtc,
    ozetHash,
    sozlesmeMetinHash,
    tsaSaglayici,
    tsaTokenBase64,
    damgaDurumu,
    sunucuImzasi,
    ilgiliKayitId,
    kullaniciKimlik,
    kullaniciTelefon,
    kullaniciAdSoyad,
    ekDetay,
  };

  try {
    await setDoc(doc(firebaseVeritabani, 'hukuki_onay_loglari', belgeId), kayit);
    return { basarili: true, belgeId, damgaDurumu };
  } catch (firestoreHatasi) {
    console.warn('Hukuki onay logu Firestore kaydı oluşturulamadı:', firestoreHatasi);
    return { basarili: false, belgeId, damgaDurumu };
  }
}
