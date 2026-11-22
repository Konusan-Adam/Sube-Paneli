import { useState, useEffect } from 'react';
import { GelAlSubesi } from '@/src/veritabani/VeriTipleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import { belgeGetir, belgeyiCanliDinle, belgeKaydet } from '@/src/veritabani/FirebaseKoleksiyonServisi';

export function gelAlSubeleriGetir(
  aktifMi: boolean = true,
  hedefSubeId?: string | null
): {
  subeler: GelAlSubesi[];
  yukleniyor: boolean;
  subeEkle: (yeniSube: Omit<GelAlSubesi, 'id' | 'kimlik'>) => Promise<boolean>;
  subeGuncelle: (subeId: string, guncelVeri: Partial<GelAlSubesi>) => Promise<boolean>;
  subeSil: (subeId: string) => Promise<boolean>;
} {
  const [subeler, setSubeler] = useState<GelAlSubesi[]>([]);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);

  useEffect(() => {
    if (!aktifMi || !hedefSubeId) {
      setSubeler([]);
      setYukleniyor(false);
      return;
    }

    let iptal = false;
    let dinlemeDurdur = () => {};
    const temizSubeId = hedefSubeId.trim();

    async function yukle() {
      if (canliFirebaseAktifMi()) {
        try {
          const fbSube = await belgeGetir<GelAlSubesi>('gel_al_subeleri', temizSubeId);
          if (iptal) return;

          if (fbSube) {
            setSubeler([fbSube]);
          } else {
            setSubeler([]);
          }

          dinlemeDurdur = belgeyiCanliDinle<GelAlSubesi>(
            'gel_al_subeleri',
            temizSubeId,
            (guncelSube) => {
              if (!iptal) {
                setSubeler(guncelSube ? [guncelSube] : []);
              }
            },
            (hata) => {
              console.warn('Şube bilgisi canlı dinleme yetki uyarısı:', hata.message);
            }
          );
        } catch (hata) {
          console.warn('Şube bilgisi çekilirken hata:', hata);
          if (!iptal) setSubeler([]);
        } finally {
          if (!iptal) setYukleniyor(false);
        }
      } else {
        setSubeler([]);
        setYukleniyor(false);
      }
    }

    yukle();
    return () => {
      iptal = true;
      dinlemeDurdur();
    };
  }, [aktifMi, hedefSubeId]);

  const subeEkle = async (_yeniSube: Omit<GelAlSubesi, 'id' | 'kimlik'>): Promise<boolean> => {
    return false;
  };

  const subeGuncelle = async (subeId: string, guncelVeri: Partial<GelAlSubesi>): Promise<boolean> => {
    if (!hedefSubeId || subeId !== hedefSubeId) {
      return false;
    }
    if (canliFirebaseAktifMi()) {
      const basarili = await belgeKaydet('gel_al_subeleri', subeId, guncelVeri);
      if (basarili) {
        setSubeler((eski) =>
          eski.map((s) => (s.id === subeId || s.kimlik === subeId ? { ...s, ...guncelVeri } : s))
        );
        return true;
      }
      return false;
    }
    return false;
  };

  const subeSil = async (_subeId: string): Promise<boolean> => {
    return false;
  };

  return { subeler, yukleniyor, subeEkle, subeGuncelle, subeSil };
}
