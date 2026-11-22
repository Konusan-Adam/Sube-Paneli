import { TedarikciHakedis, SubeUrunu, SubeSiparisi } from '@/src/veritabani/SubeTipleri';
import { canliFirebaseAktifMi } from '@/src/veritabani/FirebaseIstemcisi';
import {
  belgeKaydet,
  subeKoleksiyonuGetir,
  subeKoleksiyonunuCanliDinle,
} from '@/src/veritabani/FirebaseKoleksiyonServisi';
import { patronBildirimiEkle } from '@/src/MalzemeCekmeceleri/PatronBildirimServisi';

export async function tedarikciHakedisKaydet(hakedis: TedarikciHakedis): Promise<boolean> {
  if (!hakedis.sube_id) return false;
  if (canliFirebaseAktifMi()) {
    const basarili = await belgeKaydet('tedarikci_hakedisleri', hakedis.id, hakedis);
    if (basarili) {
      patronBildirimiEkle(
        'hakedis_talebi',
        'Yeni Şube Tedarikçi Hak Edişi 💰',
        `${hakedis.tedarikci_adi} tedarikçisinin ${hakedis.toplam_hakedis} ₺ tutarındaki hak edişi patron onayına sunuldu.`,
        hakedis.id,
        { subeId: hakedis.sube_id }
      );
    }
    return basarili;
  }
  return false;
}

export async function tedarikciHakedisleriGetir(subeId: string): Promise<TedarikciHakedis[]> {
  if (!canliFirebaseAktifMi() || !subeId) return [];
  const liste = await subeKoleksiyonuGetir<TedarikciHakedis>('tedarikci_hakedisleri', subeId);
  return (liste || []).filter((h) => h.sube_id === subeId);
}

export function tedarikciHakedisleriniCanliDinle(
  subeId: string,
  onGuncelle: (hakedisler: TedarikciHakedis[]) => void,
  onHata?: (hata: Error) => void
): () => void {
  if (!canliFirebaseAktifMi() || !subeId) return () => {};
  return subeKoleksiyonunuCanliDinle<TedarikciHakedis>(
    'tedarikci_hakedisleri',
    subeId,
    (liste) => {
      const filtrelenmis = (liste || []).filter((h) => h.sube_id === subeId);
      onGuncelle(filtrelenmis);
    },
    onHata
  );
}

export async function tedarikciHakedisDurumuGuncelle(
  hakedisId: string,
  yeniDurum: 'onaylandi' | 'odendi' | 'beklemede' | 'reddedildi'
): Promise<boolean> {
  if (canliFirebaseAktifMi()) {
    return belgeKaydet('tedarikci_hakedisleri', hakedisId, { durum: yeniDurum });
  }
  return false;
}

export function subeGunlukRaporHesapla(
  _urunler: SubeUrunu[],
  hakedisler: TedarikciHakedis[],
  siparisler: SubeSiparisi[]
) {
  const tamamlananSiparisler = siparisler.filter((s) => s.durum === 'teslim_edildi');
  const toplamCiro = tamamlananSiparisler.reduce((toplam, s) => toplam + (s.toplam_tutar || 0), 0);
  const toplamTedarikciMaliyeti = hakedisler.reduce((toplam, h) => toplam + (h.toplam_hakedis || 0), 0);
  const netSubeKari = Math.max(0, toplamCiro - toplamTedarikciMaliyeti);

  return {
    toplamCiro,
    toplamTedarikciMaliyeti,
    netSubeKari,
    toplamTeslimat: tamamlananSiparisler.length,
    bekleyenHakedis: hakedisler.filter((h) => h.durum === 'beklemede').length,
  };
}
