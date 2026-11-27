import { useCallback, useEffect, useState } from 'react';
import {
  AndroidSurumBilgisi,
  androidApkGuncelle,
  androidSurumBilgisiAl,
  yerliAndroidOrtamindaMi,
} from '@/src/MalzemeCekmeceleri/Mobil/AndroidKopruServisi';

export interface GuncellemeBilgisi {
  yeniSurumVar: boolean;
  mevcutSurumAdi: string;
  mevcutSurumKodu: number;
  yeniSurumAdi: string;
  yeniSurumKodu: number;
  indirmeUrl: string;
  kaynak: 'sunucu' | 'github';
}

type OtaDurumu = 'bosta' | 'indiriliyor' | 'kurulum_baslatildi' | 'izin_gerekli' | 'hata';

function surumKarsilastir(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const uzunluk = Math.max(pa.length, pb.length);
  for (let i = 0; i < uzunluk; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function sunucuTabanAdresiAl(): string {
  const ozel =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim().replace(/\/+$/, '')
      : '';
  if (ozel) return ozel;
  if (yerliAndroidOrtamindaMi()) {
    return 'https://ais-pre-n7odpzo4uwztdphrws42tc-546261314622.europe-west2.run.app';
  }
  return '';
}

export function useApkGuncelleme() {
  const [guncelleme, setGuncelleme] = useState<GuncellemeBilgisi | null>(null);
  const [otaDurum, setOtaDurum] = useState<OtaDurumu>('bosta');
  const [otaMesaj, setOtaMesaj] = useState<string>('');
  const [gizlendi, setGizlendi] = useState<boolean>(false);

  const kontrolEt = useCallback(async () => {
    const yerliSurum: AndroidSurumBilgisi | null = androidSurumBilgisiAl();
    if (!yerliSurum?.native) {
      return;
    }

    const tabanAdres = sunucuTabanAdresiAl();
    const githubRepo =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_GITHUB_RELEASES_REPO
        ? String(import.meta.env.VITE_GITHUB_RELEASES_REPO).trim()
        : '';

    let bulunan: GuncellemeBilgisi | null = null;

    // 1) Sunucudaki apk-meta.json kontrolü
    try {
      const metaUrl = `${tabanAdres}/apk/apk-meta.json`;
      const yanit = await fetch(metaUrl, { cache: 'no-store' });
      if (yanit.ok) {
        const meta = (await yanit.json()) as {
          surumKodu?: number;
          surumAdi?: string;
          indirmeYolu?: string;
        };
        const sunucuKod = Number(meta.surumKodu) || 0;
        const sunucuAd = String(meta.surumAdi || '1.0.0');
        const dahaYeni =
          sunucuKod > yerliSurum.surumKodu ||
          surumKarsilastir(sunucuAd, yerliSurum.surumAdi) > 0;
        if (dahaYeni && meta.indirmeYolu) {
          const mutlakUrl = meta.indirmeYolu.startsWith('https://')
            ? meta.indirmeYolu
            : `${tabanAdres}${meta.indirmeYolu.startsWith('/') ? '' : '/'}${meta.indirmeYolu}`;
          if (mutlakUrl.startsWith('https://')) {
            bulunan = {
              yeniSurumVar: true,
              mevcutSurumAdi: yerliSurum.surumAdi,
              mevcutSurumKodu: yerliSurum.surumKodu,
              yeniSurumAdi: sunucuAd,
              yeniSurumKodu: sunucuKod,
              indirmeUrl: mutlakUrl,
              kaynak: 'sunucu',
            };
          }
        }
      }
    } catch {
      // Sunucu kontrolü sessizce atlanır
    }

    // 2) Opsiyonel GitHub Releases kontrolü
    if (!bulunan && githubRepo && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(githubRepo)) {
      try {
        const ghYanit = await fetch(
          `https://api.github.com/repos/${githubRepo}/releases/latest`,
          { headers: { Accept: 'application/vnd.github+json' } }
        );
        if (ghYanit.ok) {
          const surum = (await ghYanit.json()) as {
            tag_name?: string;
            assets?: Array<{ name?: string; browser_download_url?: string }>;
          };
          const etiket = String(surum.tag_name || '').replace(/^v/i, '');
          const apkVarligi = surum.assets?.find(
            (a) =>
              a.name?.endsWith('.apk') &&
              a.browser_download_url?.startsWith('https://')
          );
          if (
            etiket &&
            apkVarligi?.browser_download_url &&
            surumKarsilastir(etiket, yerliSurum.surumAdi) > 0
          ) {
            bulunan = {
              yeniSurumVar: true,
              mevcutSurumAdi: yerliSurum.surumAdi,
              mevcutSurumKodu: yerliSurum.surumKodu,
              yeniSurumAdi: etiket,
              yeniSurumKodu: yerliSurum.surumKodu + 1,
              indirmeUrl: apkVarligi.browser_download_url,
              kaynak: 'github',
            };
          }
        }
      } catch {
        // GitHub kontrolü sessizce atlanır
      }
    }

    if (bulunan) {
      setGuncelleme(bulunan);
    }
  }, []);

  useEffect(() => {
    void kontrolEt();
  }, [kontrolEt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dinle = (olay: Event) => {
      const detay = (olay as CustomEvent<{ durum?: string; mesaj?: string }>).detail;
      if (!detay) return;
      if (detay.durum === 'indiriliyor') {
        setOtaDurum('indiriliyor');
        setOtaMesaj('Yeni APK indiriliyor...');
      } else if (detay.durum === 'kurulum_baslatildi') {
        setOtaDurum('kurulum_baslatildi');
        setOtaMesaj('Kurulum penceresi açıldı.');
      } else if (detay.durum === 'hata') {
        setOtaDurum('hata');
        const ham = typeof detay.mesaj === 'string' ? detay.mesaj.trim() : '';
        const turkceMi = /[çğıöşüÇĞİÖŞÜ]/.test(ham) || ham.startsWith('Sunucu HTTP');
        setOtaMesaj(turkceMi ? ham : 'Güncelleme indirilemedi. Lütfen bağlantınızı kontrol edin.');
      }
    };
    window.addEventListener('afyon-ota-durum', dinle);
    return () => window.removeEventListener('afyon-ota-durum', dinle);
  }, []);

  const simdiGuncelle = () => {
    if (!guncelleme?.indirmeUrl) return;
    const yanit = androidApkGuncelle(guncelleme.indirmeUrl);
    if (yanit === 'kurulum_izni_gerekli') {
      setOtaDurum('izin_gerekli');
      setOtaMesaj('Lütfen açılan ayarlardan uygulama kurulum izni verip tekrar dokunun.');
    } else if (yanit === 'baslatildi') {
      setOtaDurum('indiriliyor');
      setOtaMesaj('Yeni sürüm indiriliyor...');
    } else {
      setOtaDurum('hata');
      setOtaMesaj('Güncelleme başlatılamadı.');
    }
  };

  return {
    guncelleme: gizlendi ? null : guncelleme,
    otaDurum,
    otaMesaj,
    simdiGuncelle,
    uyariyiKapat: () => setGizlendi(true),
  };
}
