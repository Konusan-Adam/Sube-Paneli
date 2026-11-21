import React, { createContext, useContext, useState, useEffect } from 'react';
import { Kullanici } from '@/src/veritabani/VeriTipleri';
import { veritabanindanKullaniciGirisYaptir } from '@/src/MalzemeCekmeceleri/Kullanici/kullaniciGirisServisi';

export type GirisYaniti = { basarili: boolean; hata?: string };

interface SubeKullaniciHafizaTipi {
  aktifKullanici: Kullanici | null;
  yukleniyor: boolean;
  girisYap: (telefon: string, sifre: string) => Promise<GirisYaniti>;
  cikisYap: () => void;
  panelDegistir: (panel: string) => void;
}

const OTURUM_ANAHTARI = 'afyon_sube_paneli_oturum';
const KullaniciContext = createContext<SubeKullaniciHafizaTipi | undefined>(undefined);

export const KullaniciSaglayici: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [aktifKullanici, setAktifKullanici] = useState<Kullanici | null>(() => {
    try {
      const kayit = localStorage.getItem(OTURUM_ANAHTARI);
      if (!kayit) return null;
      const parsed = JSON.parse(kayit) as Kullanici;
      if (parsed?.rol === 'sube_admin' || parsed?.rol === 'yonetici') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);

  useEffect(() => {
    if (aktifKullanici) {
      localStorage.setItem(OTURUM_ANAHTARI, JSON.stringify(aktifKullanici));
    } else {
      localStorage.removeItem(OTURUM_ANAHTARI);
    }
  }, [aktifKullanici]);

  const girisYap = async (telefon: string, sifre: string): Promise<GirisYaniti> => {
    setYukleniyor(true);
    try {
      const kullanici = await veritabanindanKullaniciGirisYaptir(telefon, sifre);
      if (!kullanici) {
        return { basarili: false, hata: 'Telefon numarası veya şifre hatalı.' };
      }
      if (kullanici.rol !== 'sube_admin' && kullanici.rol !== 'yonetici') {
        return {
          basarili: false,
          hata: 'Bu panele yalnızca yetkili Şube Müdürleri ve Yöneticiler giriş yapabilir.',
        };
      }
      setAktifKullanici(kullanici);
      return { basarili: true };
    } catch {
      return { basarili: false, hata: 'Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.' };
    } finally {
      setYukleniyor(false);
    }
  };

  const cikisYap = () => {
    setAktifKullanici(null);
    localStorage.removeItem(OTURUM_ANAHTARI);
  };

  const panelDegistir = (_panel: string) => {};

  return (
    <KullaniciContext.Provider value={{ aktifKullanici, yukleniyor, girisYap, cikisYap, panelDegistir }}>
      {children}
    </KullaniciContext.Provider>
  );
};

export const kullaniciHafizasiKullan = (): SubeKullaniciHafizaTipi => {
  const ctx = useContext(KullaniciContext);
  if (!ctx) {
    throw new Error('kullaniciHafizasiKullan, KullaniciSaglayici içinde kullanılmalıdır');
  }
  return ctx;
};
