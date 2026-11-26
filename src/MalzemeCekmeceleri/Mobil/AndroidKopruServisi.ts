import { Kullanici } from '@/src/veritabani/VeriTipleri';

export type HazirZilKimligi =
  | 'nukleer_siren'
  | 'kristal_can'
  | 'hizli_bip_alarm'
  | 'mutfak_zili';

export type SeciliZilKimligi = HazirZilKimligi | 'ozel_ses';

export interface HazirZilTanimi {
  kimlik: HazirZilKimligi;
  ad: string;
  aciklama: string;
  dosyaYolu: string;
}

export interface ZilSesiAyarlari {
  seciliKimlik: SeciliZilKimligi;
  sesSeviyesi: number;
  ozelSesAdi: string;
  ozelSesVeriUrl: string;
}

export interface AndroidSurumBilgisi {
  surumKodu: number;
  surumAdi: string;
  paketAdi: string;
  native: boolean;
}

interface YerliKopruArayuzu {
  oturumAyarla?: (
    kullaniciId: string,
    adSoyad: string,
    rol: string,
    subeId: string,
    firebaseBelirtec: string
  ) => boolean;
  oturumKapat?: () => void;
  zilAyarla?: (
    seciliKimlik: string,
    sesSeviyesi: number,
    ozelSesVeriUrl: string
  ) => boolean;
  zilCal?: (
    baslik: string,
    detay: string,
    kesintisiz: boolean,
    sureSn: number
  ) => void;
  zilSustur?: () => void;
  pilOptimizasyonuIste?: () => string;
  uygulamaSurumu?: () => string;
  apkGuncelleIndirVeKur?: (indirmeUrl: string) => string;
}

export const HAZIR_ZIL_SESLERI: HazirZilTanimi[] = [
  {
    kimlik: 'nukleer_siren',
    ad: 'Nükleer Siren',
    aciklama: 'Yüksek frekanslı çift tonlu acil sipariş sireni',
    dosyaYolu: '/sesler/nukleer_siren.wav',
  },
  {
    kimlik: 'kristal_can',
    ad: 'Kristal Çan',
    aciklama: 'Net ve berrak üçlü şube bildirim çanı',
    dosyaYolu: '/sesler/kristal_can.wav',
  },
  {
    kimlik: 'hizli_bip_alarm',
    ad: 'Hızlı Bip Alarmı',
    aciklama: 'Yoğun mutfak gürültüsünde duyulan kesik uyarı',
    dosyaYolu: '/sesler/hizli_bip_alarm.wav',
  },
  {
    kimlik: 'mutfak_zili',
    ad: 'Mutfak Zili',
    aciklama: 'Klasik tezgah sipariş zili tınısı',
    dosyaYolu: '/sesler/mutfak_zili.wav',
  },
];

const ZIL_TERCIH_ANAHTARI = 'afyon_sube_zil_ayarlari_v1';
export const AZAMI_OZEL_SES_BOYUTU_BAYT = Math.floor(2.5 * 1024 * 1024);

function kopruyuAl(): YerliKopruArayuzu | null {
  if (typeof window === 'undefined') return null;
  const pencere = window as unknown as { AfyonAndroidKopru?: YerliKopruArayuzu };
  return pencere.AfyonAndroidKopru || null;
}

export function yerliAndroidOrtamindaMi(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(kopruyuAl()) || window.location.hostname === 'appassets.androidplatform.net';
}

export function sesSeviyesiniSinirla(deger: number): number {
  if (!Number.isFinite(deger)) return 0.95;
  return Math.max(0.2, Math.min(1.0, Number(deger.toFixed(2))));
}

export function zilAyarlariniOku(): ZilSesiAyarlari {
  const varsayilan: ZilSesiAyarlari = {
    seciliKimlik: 'nukleer_siren',
    sesSeviyesi: 0.95,
    ozelSesAdi: '',
    ozelSesVeriUrl: '',
  };
  if (typeof window === 'undefined') return varsayilan;

  try {
    const ham = localStorage.getItem(ZIL_TERCIH_ANAHTARI);
    if (!ham) return varsayilan;
    const ayristirilmis = JSON.parse(ham) as Partial<ZilSesiAyarlari>;
    const gecerliKimlikler = new Set<string>([
      ...HAZIR_ZIL_SESLERI.map((z) => z.kimlik),
      'ozel_ses',
    ]);
    const seciliKimlik: SeciliZilKimligi =
      ayristirilmis.seciliKimlik && gecerliKimlikler.has(ayristirilmis.seciliKimlik)
        ? (ayristirilmis.seciliKimlik as SeciliZilKimligi)
        : 'nukleer_siren';
    const ozelSesVeriUrl =
      typeof ayristirilmis.ozelSesVeriUrl === 'string' &&
      ayristirilmis.ozelSesVeriUrl.startsWith('data:audio/')
        ? ayristirilmis.ozelSesVeriUrl
        : '';

    return {
      seciliKimlik:
        seciliKimlik === 'ozel_ses' && !ozelSesVeriUrl ? 'nukleer_siren' : seciliKimlik,
      sesSeviyesi: sesSeviyesiniSinirla(Number(ayristirilmis.sesSeviyesi ?? 0.95)),
      ozelSesAdi: typeof ayristirilmis.ozelSesAdi === 'string' ? ayristirilmis.ozelSesAdi : '',
      ozelSesVeriUrl,
    };
  } catch {
    return varsayilan;
  }
}

export function zilAyarlariniKaydetVeSenkronizeEt(
  yeniAyarlar: ZilSesiAyarlari,
  ozelDosyaDegisti = false
): void {
  const guvenliAyar: ZilSesiAyarlari = {
    seciliKimlik:
      yeniAyarlar.seciliKimlik === 'ozel_ses' && !yeniAyarlar.ozelSesVeriUrl
        ? 'nukleer_siren'
        : yeniAyarlar.seciliKimlik,
    sesSeviyesi: sesSeviyesiniSinirla(yeniAyarlar.sesSeviyesi),
    ozelSesAdi: yeniAyarlar.ozelSesAdi || '',
    ozelSesVeriUrl: yeniAyarlar.ozelSesVeriUrl || '',
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ZIL_TERCIH_ANAHTARI, JSON.stringify(guvenliAyar));
    } catch {
      // Depolama kotası aşılırsa mevcut bellek ayarı ile devam et
    }
  }

  const kopru = kopruyuAl();
  if (kopru?.zilAyarla) {
    try {
      const veri = ozelDosyaDegisti
        ? guvenliAyar.ozelSesVeriUrl || 'temizle'
        : guvenliAyar.seciliKimlik === 'ozel_ses'
          ? guvenliAyar.ozelSesVeriUrl
          : '';
      kopru.zilAyarla(guvenliAyar.seciliKimlik, guvenliAyar.sesSeviyesi, veri);
    } catch {
      // Köprü hatası web akışını kesmesin
    }
  }
}

export function androidZilAyariniSenkronizeEt(): void {
  const ayar = zilAyarlariniOku();
  const kopru = kopruyuAl();
  if (kopru?.zilAyarla) {
    try {
      kopru.zilAyarla(
        ayar.seciliKimlik,
        ayar.sesSeviyesi,
        ayar.seciliKimlik === 'ozel_ses' ? ayar.ozelSesVeriUrl : ''
      );
    } catch {
      // Köprü hatası web akışını kesmesin
    }
  }
}

export function androidOturumBildir(
  kullanici: Pick<Kullanici, 'id' | 'kimlik' | 'ad_soyad' | 'rol' | 'sube_id'>,
  firebaseBelirtec = ''
): void {
  const kopru = kopruyuAl();
  if (!kopru?.oturumAyarla) return;
  const subeId = String(kullanici.sube_id || '').trim();
  if (!subeId) return;

  try {
    kopru.oturumAyarla(
      String(kullanici.id || kullanici.kimlik || ''),
      String(kullanici.ad_soyad || ''),
      String(kullanici.rol || ''),
      subeId,
      firebaseBelirtec
    );
    androidZilAyariniSenkronizeEt();
  } catch {
    // Köprü hatası web akışını kesmesin
  }
}

export function androidOturumKapatBildir(): void {
  const kopru = kopruyuAl();
  if (!kopru?.oturumKapat) return;
  try {
    kopru.oturumKapat();
  } catch {
    // Köprü hatası web akışını kesmesin
  }
}

export function androidZilCal(
  baslik: string,
  detay: string,
  kesintisiz = true,
  sureSn = 0
): void {
  const kopru = kopruyuAl();
  if (!kopru?.zilCal) return;
  try {
    kopru.zilCal(baslik, detay, kesintisiz, sureSn);
  } catch {
    // Köprü hatası web akışını kesmesin
  }
}

export function androidZilSustur(): void {
  const kopru = kopruyuAl();
  if (!kopru?.zilSustur) return;
  try {
    kopru.zilSustur();
  } catch {
    // Köprü hatası web akışını kesmesin
  }
}

export function androidPilOptimizasyonuIste(): string {
  const kopru = kopruyuAl();
  if (!kopru?.pilOptimizasyonuIste) return 'web_ortami';
  try {
    return kopru.pilOptimizasyonuIste();
  } catch {
    return 'hata';
  }
}

export function androidSurumBilgisiAl(): AndroidSurumBilgisi | null {
  const kopru = kopruyuAl();
  if (!kopru?.uygulamaSurumu) return null;
  try {
    const parsed = JSON.parse(kopru.uygulamaSurumu()) as Partial<AndroidSurumBilgisi>;
    return {
      surumKodu: Number(parsed.surumKodu) || 1,
      surumAdi: String(parsed.surumAdi || '1.0.0'),
      paketAdi: String(parsed.paketAdi || 'com.afyonevlezzetleri.sube'),
      native: Boolean(parsed.native),
    };
  } catch {
    return null;
  }
}

export function androidApkGuncelle(indirmeUrl: string): string {
  const kopru = kopruyuAl();
  if (!kopru?.apkGuncelleIndirVeKur) return 'desteklenmiyor';
  try {
    return kopru.apkGuncelleIndirVeKur(indirmeUrl);
  } catch {
    return 'hata';
  }
}
