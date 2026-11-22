import React, { createContext, useContext, useState, useEffect } from 'react';
import { Kullanici } from '@/src/veritabani/VeriTipleri';
import {
  subeMuduruRoluGecerliMi,
  veritabanindanKullaniciGirisYaptir,
  YETKISIZ_GIRIS_MESAJI,
} from '@/src/MalzemeCekmeceleri/Kullanici/kullaniciGirisServisi';

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

function gecerliSubeMuduruOturumuMu(k: Kullanici | null | undefined): k is Kullanici {
  if (!k) return false;
  if (!subeMuduruRoluGecerliMi(k.rol)) return false;
  if (!k.sube_id || !String(k.sube_id).trim()) return false;
  return true;
}

export const KullaniciSaglayici: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [aktifKullanici, setAktifKullanici] = useState<Kullanici | null>(() => {
    try {
      const kayit = localStorage.getItem(OTURUM_ANAHTARI);
      if (!kayit) return null;
      const parsed = JSON.parse(kayit) as Kullanici;
      if (gecerliSubeMuduruOturumuMu(parsed)) {
        return parsed;
      }
      localStorage.removeItem(OTURUM_ANAHTARI);
      return null;
    } catch {
      return null;
    }
  });
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);

  useEffect(() => {
    if (gecerliSubeMuduruOturumuMu(aktifKullanici)) {
      localStorage.setItem(OTURUM_ANAHTARI, JSON.stringify(aktifKullanici));
    } else {
      localStorage.removeItem(OTURUM_ANAHTARI);
    }
  }, [aktifKullanici]);

  const girisYap = async (telefon: string, sifre: string): Promise<GirisYaniti> => {
    setYukleniyor(true);
    try {
      const sonuc = await veritabanindanKullaniciGirisYaptir(telefon, sifre);
      if (!sonuc.kullanici) {
        return { basarili: false, hata: sonuc.hata || 'Telefon numarası veya şifre hatalı.' };
      }

      if (!gecerliSubeMuduruOturumuMu(sonuc.kullanici)) {
        return { basarili: false, hata: YETKISIZ_GIRIS_MESAJI };
      }

      setAktifKullanici(sonuc.kullanici);
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
