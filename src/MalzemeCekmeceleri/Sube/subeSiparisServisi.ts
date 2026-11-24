import { doc, runTransaction } from 'firebase/firestore';
import { SubeSiparisi } from '@/src/veritabani/SubeTipleri';
import { canliFirebaseAktifMi, firebaseVeritabani } from '@/src/veritabani/FirebaseIstemcisi';
import {
  belgeKaydet,
  subeKoleksiyonuGetir,
  subeKoleksiyonunuCanliDinle,
} from '@/src/veritabani/FirebaseKoleksiyonServisi';

function siparisleriTariheGoreSirala(liste: SubeSiparisi[]): SubeSiparisi[] {
  return [...liste].sort((a, b) => {
    const tA = a.olusturma_tarihi ? new Date(a.olusturma_tarihi).getTime() : 0;
    const tB = b.olusturma_tarihi ? new Date(b.olusturma_tarihi).getTime() : 0;
    return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
  });
}

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
  return siparisleriTariheGoreSirala((liste || []).filter((s) => s.sube_id === subeId));
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
      onGuncelle(siparisleriTariheGoreSirala(filtrelenmis));
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

export async function subeSiparisiIptalEtVeStokIadeEt(
  siparisId: string,
  subeId: string
): Promise<{ basarili: boolean; hata?: string }> {
  if (!canliFirebaseAktifMi() || !siparisId || !subeId) {
    return { basarili: false, hata: 'Geçersiz sipariş veya veritabanı bağlantısı.' };
  }

  try {
    await runTransaction(firebaseVeritabani, async (tx) => {
      const siparisRef = doc(firebaseVeritabani, 'sube_siparisleri', siparisId);
      const siparisSnap = await tx.get(siparisRef);

      if (!siparisSnap.exists()) {
        throw new Error('Sipariş belgesi bulunamadı.');
      }

      const siparisData = siparisSnap.data() as SubeSiparisi;
      if (siparisData.sube_id !== subeId) {
        throw new Error('Bu siparişe müdahale yetkiniz yok.');
      }
      if (siparisData.durum === 'teslim_edildi') {
        throw new Error('Teslim edilmiş sipariş iptal edilemez.');
      }
      if (siparisData.durum === 'iptal') {
        throw new Error('Bu sipariş zaten iptal edilmiş.');
      }

      const iadeEdilecekKalemler =
        !siparisData.stok_iade_edildi_mi && Array.isArray(siparisData.urunler)
          ? siparisData.urunler.filter((u) => u && u.urun_id && Number(u.adet) > 0)
          : [];

      const okunanStoklar: Array<{
        ref: ReturnType<typeof doc>;
        mevcutStok: number;
        adet: number;
      }> = [];

      for (const kalem of iadeEdilecekKalemler) {
        const stokRef = doc(firebaseVeritabani, 'sube_stoklari', kalem.urun_id);
        const stokSnap = await tx.get(stokRef);
        if (stokSnap.exists()) {
          const stokVeri = stokSnap.data() as { sube_id?: string; stok_adedi?: number };
          if (stokVeri.sube_id === subeId) {
            okunanStoklar.push({
              ref: stokRef,
              mevcutStok: Number(stokVeri.stok_adedi) || 0,
              adet: Number(kalem.adet) || 0,
            });
          }
        }
      }

      for (const kayit of okunanStoklar) {
        tx.update(kayit.ref, {
          stok_adedi: kayit.mevcutStok + kayit.adet,
        });
      }

      tx.update(siparisRef, {
        durum: 'iptal',
        stok_iade_edildi_mi: true,
      });
    });

    return { basarili: true };
  } catch (hata) {
    const mesaj =
      hata instanceof Error
        ? hata.message
        : 'Sipariş iptal edilirken bir hata oluştu.';
    return { basarili: false, hata: mesaj };
  }
}
