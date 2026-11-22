import { collection, getDocs, query, where } from 'firebase/firestore';
import { Kullanici } from '@/src/veritabani/VeriTipleri';
import { canliFirebaseAktifMi, firebaseVeritabani } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeGetir, belgeKaydet } from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { telefonGecerliMi, telefonuStandartlastir } from '@/src/MalzemeCekmeceleri/Dogrulama/telefonDogrulayici';
import { telefonStandartCekirdek } from './telefonYardimcisi';

type GuvenlikliKullanici = Kullanici & {
  sifre?: string | number;
  parola?: string | number;
  guvenlik_sorusu?: string;
  guvenlik_cevabi?: string;
};

export const YETKILI_SUBE_ROLLERI = ['sube_muduru', 'sube_admin'] as const;
export const YETKISIZ_ROLLER = new Set([
  'super_admin',
  'yonetici',
  'musteri',
  'mutfak',
  'ev_mutfagi',
  'ticari_restoran',
  'kurye',
]);

export const YETKISIZ_GIRIS_MESAJI = 'Yetkisiz giriş denemesi.';

export function subeMuduruRoluGecerliMi(rol: string | undefined | null): boolean {
  if (!rol) return false;
  const temizRol = rol.trim();
  if (YETKISIZ_ROLLER.has(temizRol)) return false;
  return temizRol === 'sube_muduru' || temizRol === 'sube_admin';
}

export function subeKullaniciBelgeIdOlustur(
  telefon: string,
  rol: 'sube_muduru' | 'sube_admin' = 'sube_muduru'
): string {
  const standart05 = telefonuStandartlastir(telefon);
  return `${standart05}_${rol}`;
}

async function sadeceSubeMuduruBelgesiGetir(
  telefon: string
): Promise<{ belgeId: string; kullanici: GuvenlikliKullanici } | null> {
  const standart05 = telefonuStandartlastir(telefon);
  const cekirdek10 = telefonStandartCekirdek(telefon);
  if (!standart05 || standart05.length !== 11 || !cekirdek10) return null;

  // 1. Önce bileşik doküman anahtarlarını doğrudan kontrol et: 05XXXXXXXXX_sube_muduru -> _sube_admin
  const adayBelgeIdleri = [
    `${standart05}_sube_muduru`,
    `${standart05}_sube_admin`,
    `${cekirdek10}_sube_muduru`,
    `${cekirdek10}_sube_admin`,
  ];

  for (const belgeId of adayBelgeIdleri) {
    const kayit = await belgeGetir<GuvenlikliKullanici>('kullanicilar', belgeId);
    if (kayit) {
      return { belgeId, kullanici: kayit };
    }
  }

  // 2. Bileşik ID ile bulunamazsa yalnızca sube_muduru / sube_admin rollerini sorgula
  // (musteri, super_admin, yonetici, kurye, mutfak hesapları kesinlikle okunmaz)
  try {
    const rolSorgusu = query(
      collection(firebaseVeritabani, 'kullanicilar'),
      where('rol', 'in', ['sube_muduru', 'sube_admin'])
    );
    const snap = await getDocs(rolSorgusu);
    for (const d of snap.docs) {
      const veri = d.data() as GuvenlikliKullanici;
      if (telefonStandartCekirdek(veri.telefon || '') === cekirdek10) {
        return {
          belgeId: d.id,
          kullanici: { ...veri, id: d.id },
        };
      }
    }
  } catch (sorguHatasi) {
    console.warn('Şube müdürü rol sorgusu uyarısı:', sorguHatasi);
  }

  return null;
}

export interface GirisDogrulamaSonucu {
  kullanici: Kullanici | null;
  hata?: string;
}

export async function veritabanindanKullaniciGirisYaptir(
  telefon: string,
  sifre: string
): Promise<GirisDogrulamaSonucu> {
  const dogrulama = telefonGecerliMi(telefon);
  if (!dogrulama.gecerli) {
    return { kullanici: null, hata: dogrulama.hata || 'Geçersiz telefon numarası.' };
  }

  const girilenSifre = sifre.trim();
  if (!girilenSifre) {
    return { kullanici: null, hata: 'Lütfen şifrenizi giriniz.' };
  }

  if (!canliFirebaseAktifMi()) {
    return { kullanici: null, hata: 'Veritabanı bağlantısı aktif değil.' };
  }

  try {
    const kayit = await sadeceSubeMuduruBelgesiGetir(telefon);
    if (!kayit) {
      return { kullanici: null, hata: 'Telefon numarası veya şifre hatalı.' };
    }

    const { belgeId, kullanici: bulunan } = kayit;

    // Rol izolasyonu: yalnızca sube_muduru (veya uyumlu sube_admin) kabul edilir
    if (!subeMuduruRoluGecerliMi(bulunan.rol)) {
      return { kullanici: null, hata: YETKISIZ_GIRIS_MESAJI };
    }

    // Birebir şifre doğrulaması (sayısal/metin saklama farkını normalize et, bypass yok)
    const hamSifre = bulunan.sifre ?? bulunan.parola ?? '';
    const kayitliSifre = String(hamSifre).trim();
    if (!kayitliSifre || kayitliSifre !== girilenSifre) {
      return { kullanici: null, hata: 'Telefon numarası veya şifre hatalı.' };
    }

    // Şube müdürü mutlaka atanmış bir şubeye sahip olmalıdır
    if (!bulunan.sube_id || !String(bulunan.sube_id).trim()) {
      return { kullanici: null, hata: YETKISIZ_GIRIS_MESAJI };
    }

    // Hassas alanları oturum nesnesinden ayıkla
    const { sifre: _sifre, parola: _parola, guvenlik_cevabi: _cevap, ...oturumKullanicisi } = bulunan;
    return {
      kullanici: {
        ...oturumKullanicisi,
        id: belgeId,
        kimlik: bulunan.kimlik || belgeId,
      },
    };
  } catch (hata) {
    console.warn('Firebase kullanıcı giriş okuma hatası:', hata);
    return { kullanici: null, hata: 'Bağlantı veya yetki doğrulaması sırasında bir sorun oluştu.' };
  }
}

export async function kullaniciGuvenlikSorusuGetir(
  telefon: string
): Promise<{ kimlik: string; soru: string } | null> {
  const dogrulama = telefonGecerliMi(telefon);
  if (!dogrulama.gecerli || !canliFirebaseAktifMi()) return null;

  try {
    const kayit = await sadeceSubeMuduruBelgesiGetir(telefon);
    if (!kayit) return null;
    const { belgeId, kullanici: bulunan } = kayit;

    if (!subeMuduruRoluGecerliMi(bulunan.rol)) {
      return null;
    }

    if (bulunan.guvenlik_sorusu?.trim()) {
      return {
        kimlik: belgeId,
        soru: bulunan.guvenlik_sorusu.trim(),
      };
    }
  } catch (hata) {
    console.warn('Güvenlik sorusu getirme hatası:', hata);
  }

  return null;
}

export async function sifreSifirlaGuvenlikSorusuIle(
  telefon: string,
  cevap: string,
  yeniSifre: string
): Promise<boolean> {
  const dogrulama = telefonGecerliMi(telefon);
  if (!dogrulama.gecerli || !cevap.trim() || yeniSifre.trim().length < 4) return false;
  if (!canliFirebaseAktifMi()) return false;

  const girilenCevap = cevap.trim().toLowerCase();
  const yeniSifreTemiz = yeniSifre.trim();

  try {
    const kayit = await sadeceSubeMuduruBelgesiGetir(telefon);
    if (!kayit) return false;
    const { belgeId, kullanici: bulunan } = kayit;

    if (!subeMuduruRoluGecerliMi(bulunan.rol)) {
      return false;
    }

    if (bulunan.guvenlik_cevabi?.trim()) {
      if (bulunan.guvenlik_cevabi.trim().toLowerCase() === girilenCevap) {
        return await belgeKaydet('kullanicilar', belgeId, {
          sifre: yeniSifreTemiz,
        });
      }
    }
  } catch (hata) {
    console.warn('Şifre sıfırlama hatası:', hata);
  }

  return false;
}
