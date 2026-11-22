import { useState, useEffect } from 'react';
import { SubeUrunu } from '@/src/veritabani/SubeTipleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import {
  subeKoleksiyonuGetir,
  subeKoleksiyonunuCanliDinle,
} from '@/src/veritabani/FirebaseKoleksiyonServisi';

export function useSubeUrunleri(subeId?: string | null, aktifMi: boolean = true) {
  const [urunler, setUrunler] = useState<SubeUrunu[]>([]);
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);

  useEffect(() => {
    if (!aktifMi || !subeId) {
      setUrunler([]);
      setYukleniyor(false);
      return;
    }

    let iptal = false;
    let dinlemeDurdur: (() => void) | undefined;
    const temizSubeId = subeId.trim();

    const veriGetir = async () => {
      if (!canliFirebaseAktifMi()) return;
      setYukleniyor(true);
      try {
        const fbUrunler = await subeKoleksiyonuGetir<SubeUrunu>('sube_stoklari', temizSubeId);
        if (iptal) return;
        setUrunler(fbUrunler.filter((u) => u.sube_id === temizSubeId));

        dinlemeDurdur = subeKoleksiyonunuCanliDinle<SubeUrunu>(
          'sube_stoklari',
          temizSubeId,
          (guncel) => {
            if (!iptal) {
              setUrunler((guncel || []).filter((u) => u.sube_id === temizSubeId));
            }
          },
          (hata) => {
            console.warn('Şube stokları canlı dinleme yetki uyarısı:', hata.message);
          }
        );
      } catch (err) {
        console.warn('Şube stokları çekilirken hata oluştu:', err);
        if (!iptal) setUrunler([]);
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    };

    veriGetir();
    return () => {
      iptal = true;
      if (dinlemeDurdur) dinlemeDurdur();
    };
  }, [subeId, aktifMi]);

  const seciliSubeUrunleri = subeId
    ? urunler.filter((u) => u.sube_id === subeId)
    : [];

  return {
    urunler: seciliSubeUrunleri,
    tumUrunler: seciliSubeUrunleri,
    yukleniyor,
  };
}
