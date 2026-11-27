import { doc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { SubeSiparisi, SubeUrunu } from '@/src/veritabani/SubeTipleri';
import { canliFirebaseAktifMi, firebaseVeritabani } from '@/src/veritabani/FirebaseIstemcisi';
import {
  belgeKaydet,
  subeKoleksiyonuGetir,
  subeKoleksiyonunuCanliDinle,
} from '@/src/veritabani/FirebaseKoleksiyonServisi';
import {
  AlanHatasi,
  firebaseHatasiniTurkcelestir,
  firebaseYetkiHatasiMi,
} from '@/src/veritabani/firebaseHataMesaji';

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

function durumMetinleriniBelirle(yeniDurum: SubeSiparisi['durum']): {
  asama: string;
  durumAciklamasi: string;
} {
  switch (yeniDurum) {
    case 'hazirlaniyor':
      return {
        asama: 'ocakta',
        durumAciklamasi: 'Şube siparişiniz alındı, tezgahta hazırlanıyor.',
      };
    case 'teslime_hazir':
      return {
        asama: 'hazir',
        durumAciklamasi: 'Siparişiniz paketlendi, şubeden teslime hazır.',
      };
    case 'yolda':
    case 'kuryede':
    case 'kurye_yolda':
    case 'kurye_teslim_aldi':
    case 'kuryeye_teslim_edildi':
      return {
        asama: 'yolda',
        durumAciklamasi: 'Siparişiniz kurye ile teslimat için yola çıktı.',
      };
    case 'teslim_edildi':
      return {
        asama: 'teslim_edildi',
        durumAciklamasi: 'Şube siparişiniz teslim edildi. Afiyet olsun!',
      };
    case 'iptal':
      return {
        asama: 'iptal',
        durumAciklamasi: 'Şube siparişiniz iptal edildi.',
      };
    default:
      return {
        asama: 'isleniyor',
        durumAciklamasi: 'Sipariş durumu güncellendi.',
      };
  }
}

export async function anaSiparisDurumunuSenkronizeEt(
  siparisId: string,
  yeniDurum: SubeSiparisi['durum']
): Promise<boolean> {
  if (!canliFirebaseAktifMi() || !siparisId) return false;
  try {
    const anaSiparisRef = doc(firebaseVeritabani, 'siparisler', siparisId);
    const anaSnap = await getDoc(anaSiparisRef);
    if (!anaSnap.exists()) {
      return false;
    }

    const { asama, durumAciklamasi } = durumMetinleriniBelirle(yeniDurum);
    const simdikiZaman = new Date().toISOString();

    const guncelleme: Record<string, any> = {
      durum: yeniDurum,
      asama,
      durum_aciklamasi: durumAciklamasi,
      guncellenme_tarihi: simdikiZaman,
    };

    if (yeniDurum === 'teslim_edildi') {
      guncelleme.teslim_tarihi = simdikiZaman;
    } else if (yeniDurum === 'iptal') {
      guncelleme.iptal_tarihi = simdikiZaman;
    }

    await updateDoc(anaSiparisRef, guncelleme);
    return true;
  } catch (hata) {
    console.warn('Ana sipariş koleksiyonu senkronizasyon uyarısı:', hata);
    return false;
  }
}

export async function subeSiparisiDurumGuncelle(
  siparisId: string,
  yeniDurum: SubeSiparisi['durum']
): Promise<boolean> {
  if (canliFirebaseAktifMi()) {
    const basarili = await belgeKaydet('sube_siparisleri', siparisId, { durum: yeniDurum });
    if (basarili) {
      await anaSiparisDurumunuSenkronizeEt(siparisId, yeniDurum);
    }
    return basarili;
  }
  return false;
}

async function subeStokKimlikHaritasiniHazirla(subeId: string): Promise<Map<string, string>> {
  const eslesme = new Map<string, string>();
  try {
    const subeUrunleri = await subeKoleksiyonuGetir<SubeUrunu>('sube_stoklari', subeId);
    for (const urun of subeUrunleri) {
      if (urun.sube_id !== subeId) continue;
      if (urun.id) eslesme.set(urun.id, urun.id);
      if (urun.yemek_id) eslesme.set(urun.yemek_id, urun.id);
      if (urun.ad) eslesme.set(`ad:${urun.ad.trim().toLowerCase()}`, urun.id);
    }
  } catch {
    // Ön okuma yetkiye takılırsa doğrudan kalem.urun_id ile devam edilir
  }
  return eslesme;
}

async function atomikIptalVeStokIadeCalistir(
  siparisId: string,
  subeId: string,
  stokKimlikHaritasi: Map<string, string>,
  iadeIsaretiYaz: boolean
): Promise<void> {
  await runTransaction(firebaseVeritabani, async (tx) => {
    const siparisRef = doc(firebaseVeritabani, 'sube_siparisleri', siparisId);
    const siparisSnap = await tx.get(siparisRef);

    if (!siparisSnap.exists()) {
      throw new AlanHatasi('Sipariş belgesi bulunamadı.');
    }

    const siparisData = siparisSnap.data() as SubeSiparisi;
    if (siparisData.sube_id !== subeId) {
      throw new AlanHatasi('Bu siparişe müdahale yetkiniz yok.');
    }
    if (siparisData.durum === 'teslim_edildi') {
      throw new AlanHatasi('Teslim edilmiş sipariş iptal edilemez.');
    }
    if (siparisData.durum === 'iptal') {
      throw new AlanHatasi('Bu sipariş zaten iptal edilmiş.');
    }

    const iadeEdilecekKalemler =
      !siparisData.stok_iade_edildi_mi && Array.isArray(siparisData.urunler)
        ? siparisData.urunler.filter((u) => u && (u.urun_id || u.ad) && Number(u.adet) > 0)
        : [];

    const stokToplanan = new Map<string, number>();
    for (const kalem of iadeEdilecekKalemler) {
      const hamId = kalem.urun_id ? String(kalem.urun_id).trim() : '';
      const adAnahtar = kalem.ad ? `ad:${kalem.ad.trim().toLowerCase()}` : '';
      const hedefStokDocId =
        (hamId && stokKimlikHaritasi.get(hamId)) ||
        (adAnahtar && stokKimlikHaritasi.get(adAnahtar)) ||
        hamId;

      if (!hedefStokDocId) continue;
      stokToplanan.set(
        hedefStokDocId,
        (stokToplanan.get(hedefStokDocId) || 0) + (Number(kalem.adet) || 0)
      );
    }

    const okunanStoklar: Array<{
      ref: ReturnType<typeof doc>;
      mevcutStok: number;
      adet: number;
    }> = [];

    for (const [stokDocId, adet] of stokToplanan.entries()) {
      const stokRef = doc(firebaseVeritabani, 'sube_stoklari', stokDocId);
      const stokSnap = await tx.get(stokRef);
      if (stokSnap.exists()) {
        const stokVeri = stokSnap.data() as { sube_id?: string; stok_adedi?: number };
        if (stokVeri.sube_id === subeId) {
          okunanStoklar.push({
            ref: stokRef,
            mevcutStok: Number(stokVeri.stok_adedi) || 0,
            adet,
          });
        }
      }
    }

    for (const kayit of okunanStoklar) {
      tx.update(kayit.ref, {
        stok_adedi: kayit.mevcutStok + kayit.adet,
      });
    }

    tx.update(
      siparisRef,
      iadeIsaretiYaz
        ? { durum: 'iptal', stok_iade_edildi_mi: true }
        : { durum: 'iptal' }
    );
  });
}

export async function subeSiparisiIptalEtVeStokIadeEt(
  siparisId: string,
  subeId: string
): Promise<{ basarili: boolean; hata?: string }> {
  if (!canliFirebaseAktifMi() || !siparisId || !subeId) {
    return { basarili: false, hata: 'Geçersiz sipariş veya veritabanı bağlantısı.' };
  }

  try {
    const stokKimlikHaritasi = await subeStokKimlikHaritasiniHazirla(subeId);

    try {
      await atomikIptalVeStokIadeCalistir(siparisId, subeId, stokKimlikHaritasi, true);
    } catch (ilkHata) {
      if (firebaseYetkiHatasiMi(ilkHata)) {
        // Güvenlik kuralları ek alan yazımını kısıtlıyorsa yalnızca 'durum: iptal' + stok iadesini dene
        await atomikIptalVeStokIadeCalistir(siparisId, subeId, stokKimlikHaritasi, false);
      } else {
        throw ilkHata;
      }
    }

    // Ana müşteri sipariş koleksiyonunu ayrı adımda senkronize et (yetki kısıtı iptali geri almasın)
    await anaSiparisDurumunuSenkronizeEt(siparisId, 'iptal');

    return { basarili: true };
  } catch (hata) {
    console.warn('Sipariş iptal ve stok iade hatası:', hata);
    return {
      basarili: false,
      hata: firebaseHatasiniTurkcelestir(
        hata,
        'Sipariş iptal edilirken ve stok iade edilirken bir hata oluştu.'
      ),
    };
  }
}
