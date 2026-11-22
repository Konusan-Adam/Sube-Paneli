import { SubeSiparisi } from '@/src/veritabani/SubeTipleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import {
  belgeKaydet,
  subeKoleksiyonuGetir,
  subeKoleksiyonunuCanliDinle,
} from '@/src/veritabani/FirebaseKoleksiyonServisi';

export async function subeSiparisiOlustur(siparis: SubeSiparisi): Promise<boolean> {
  if (!siparis.sube_id) return false;
  if (canliFirebaseAktifMi()) {
    return await belgeKaydet('sube_siparisleri', siparis.id, siparis);
  }
  return false;
}

export async function subeSiparisleriGetir(subeId: string): Promise<SubeSiparisi[]> {
  if (!canliFirebaseAktifMi() || !subeId) return [];
  const liste = await subeKoleksiyonuGetir<SubeSiparisi>('sube_siparisleri', subeId);
  return (liste || []).filter((s) => s.sube_id === subeId);
}

export function subeSiparisleriniCanliDinle(
  subeId: string,
  onGuncelle: (siparisler: SubeSiparisi[]) => void,
  onHata?: (hata: Error) => void
): () => void {
  if (!canliFirebaseAktifMi() || !subeId) return () => {};
  return subeKoleksiyonunuCanliDinle<SubeSiparisi>(
    'sube_siparisleri',
    subeId,
    (liste) => {
      const filtrelenmis = (liste || []).filter((s) => s.sube_id === subeId);
      onGuncelle(filtrelenmis);
    },
    onHata
  );
}

export async function subeSiparisiDurumGuncelle(
  siparisId: string,
  yeniDurum: SubeSiparisi['durum']
): Promise<boolean> {
  if (canliFirebaseAktifMi()) {
    return await belgeKaydet('sube_siparisleri', siparisId, { durum: yeniDurum });
  }
  return false;
}
