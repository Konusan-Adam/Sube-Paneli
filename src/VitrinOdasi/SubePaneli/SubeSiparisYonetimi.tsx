import React, { useState, useEffect } from 'react';
import { ShoppingBag, Clock, CheckCircle2, Phone, User, ArrowRight, XCircle, RotateCcw, Truck } from 'lucide-react';
import { SubeSiparisi } from '@/src/veritabani/SubeTipleri';
import {
  subeSiparisleriniCanliDinle,
  subeSiparisiDurumGuncelle,
  subeSiparisiIptalEtVeStokIadeEt,
} from '@/src/MalzemeCekmeceleri/Sube/subeSiparisServisi';
import { hukukiOnayDamgalaVeKaydet } from '@/src/MalzemeCekmeceleri/Hukuki/hukukiDelilServisi';

interface Props {
  subeId: string;
}

export const SubeSiparisYonetimi: React.FC<Props> = ({ subeId }) => {
  const [siparisler, setSiparisler] = useState<SubeSiparisi[]>([]);
  const [seciliDurum, setSeciliDurum] = useState<string>('tumu');
  const [yetkiHatasi, setYetkiHatasi] = useState<string>('');
  const [islemHatasi, setIslemHatasi] = useState<string>('');
  const [iptalOnayId, setIptalOnayId] = useState<string | null>(null);
  const [islemdeId, setIslemdeId] = useState<string | null>(null);

  useEffect(() => {
    setYetkiHatasi('');
    const durdur = subeSiparisleriniCanliDinle(
      subeId,
      (liste) => {
        setYetkiHatasi('');
        setSiparisler(liste);
      },
      () => {
        setYetkiHatasi(
          'Şube siparişleri için Firestore okuma yetkisi bulunamadı. Veritabanı kuralları (sube_siparisleri) şu an oturumsuz erişimi engelliyor.'
        );
      }
    );
    return () => durdur();
  }, [subeId]);

  const durumGuncelle = async (siparisId: string, yeniDurum: SubeSiparisi['durum']) => {
    const hedefSiparis = siparisler.find((s) => s.id === siparisId && s.sube_id === subeId);
    if (!hedefSiparis) return;
    if (yeniDurum === 'teslim_edildi' && hedefSiparis.teslimat_tipi === 'teslimat') {
      return;
    }
    setIslemHatasi('');
    setIslemdeId(siparisId);
    try {
      const ok = await subeSiparisiDurumGuncelle(siparisId, yeniDurum);
      if (!ok) {
        setIslemHatasi('Sipariş durumu güncellenemedi. Lütfen tekrar deneyin.');
      } else if (yeniDurum === 'teslim_edildi') {
        void hukukiOnayDamgalaVeKaydet({
          islemTuru: 'teslimat',
          sozlesmeTuru: 'sube_teslimat_onayi',
          ilgiliKayitId: hedefSiparis.siparis_kodu || hedefSiparis.id,
          ekDetay: `Şube: ${hedefSiparis.sube_adi || subeId} | Sipariş: ${
            hedefSiparis.siparis_kodu || hedefSiparis.id
          } | Müşteri: ${hedefSiparis.musteri_adi} | Tip: ${
            hedefSiparis.teslimat_tipi || 'gel_al'
          } | Tutar: ${hedefSiparis.toplam_tutar} ₺`,
        });
      }
    } catch {
      setIslemHatasi('Sipariş durumu güncellenirken yetki veya bağlantı hatası oluştu.');
    } finally {
      setIslemdeId(null);
    }
  };

  const siparisiIptalEt = async (siparisId: string) => {
    const hedefSiparis = siparisler.find((s) => s.id === siparisId && s.sube_id === subeId);
    if (!hedefSiparis || islemdeId) return;
    setIslemHatasi('');
    setIslemdeId(siparisId);
    try {
      const sonuc = await subeSiparisiIptalEtVeStokIadeEt(siparisId, subeId);
      if (!sonuc.basarili) {
        setIslemHatasi(sonuc.hata || 'Sipariş iptal edilemedi.');
      } else {
        setIptalOnayId(null);
        void hukukiOnayDamgalaVeKaydet({
          islemTuru: 'iptal',
          sozlesmeTuru: 'iptal_iade_kosullari',
          ilgiliKayitId: hedefSiparis.siparis_kodu || hedefSiparis.id,
          ekDetay: `Şube: ${hedefSiparis.sube_adi || subeId} | Sipariş: ${
            hedefSiparis.siparis_kodu || hedefSiparis.id
          } | Müşteri: ${hedefSiparis.musteri_adi} | Tutar: ${
            hedefSiparis.toplam_tutar
          } ₺ | Stok İade: Evet`,
        });
      }
    } finally {
      setIslemdeId(null);
    }
  };

  const filtrelenmisSiparisler = siparisler.filter((s) => {
    if (seciliDurum === 'tumu') return true;
    return s.durum === seciliDurum;
  });

  const hazirlaniyorSayisi = siparisler.filter((s) => s.durum === 'hazirlaniyor').length;
  const teslimeHazirSayisi = siparisler.filter((s) => s.durum === 'teslime_hazir').length;
  const teslimEdildiSayisi = siparisler.filter((s) => s.durum === 'teslim_edildi').length;

  const durumSekmeleri = [
    { id: 'tumu', etiket: 'Tümü', sayi: siparisler.length },
    { id: 'hazirlaniyor', etiket: 'Hazırlanıyor', sayi: hazirlaniyorSayisi },
    { id: 'teslime_hazir', etiket: 'Teslime Hazır', sayi: teslimeHazirSayisi },
    { id: 'teslim_edildi', etiket: 'Teslim Edildi', sayi: teslimEdildiSayisi },
  ];

  const bosDurumMesaji =
    seciliDurum === 'hazirlaniyor'
      ? 'Hazırlanıyor aşamasında sipariş bulunmuyor.'
      : seciliDurum === 'teslime_hazir'
      ? 'Teslime hazır aşamasında sipariş bulunmuyor.'
      : seciliDurum === 'teslim_edildi'
      ? 'Teslim edilmiş sipariş bulunmuyor.'
      : 'Bu şubeye ait aktif sipariş bulunmuyor.';

  return (
    <div className="bg-[#220E29] border border-[#521E5C] rounded-2xl p-3.5 sm:p-5 text-white shadow-xl space-y-4">
      {yetkiHatasi && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs">
          {yetkiHatasi}
        </div>
      )}
      {islemHatasi && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs font-medium">
          {islemHatasi}
        </div>
      )}
      {hazirlaniyorSayisi > 0 && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="font-bold tabular-nums">
              Dikkat: {hazirlaniyorSayisi} şube siparişi paketlenmeyi bekliyor!
            </span>
          </div>
          <span className="text-[10px] text-amber-300 font-semibold hidden sm:inline">Tezgahı Kontrol Edin</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#3E1646] pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-[#DDAF53]" />
          <h3 className="font-bold text-sm sm:text-base text-white">Şube Canlı Sipariş Havuzu</h3>
        </div>

        <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-[#180A1F] p-1 rounded-xl border border-[#3E1646] w-full sm:w-auto">
          {durumSekmeleri.map((sekme) => (
            <button
              key={sekme.id}
              type="button"
              onClick={() => setSeciliDurum(sekme.id)}
              className={`min-h-[42px] sm:min-h-0 px-1.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs leading-tight text-center ${
                seciliDurum === sekme.id ? 'bg-[#6D237A] text-white font-bold' : 'text-[#A872B5] hover:text-white'
              }`}
            >
              <span className="truncate max-w-full">{sekme.etiket}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                  seciliDurum === sekme.id
                    ? 'bg-[#3E1646] text-[#DDAF53]'
                    : 'bg-[#220E29] text-stone-300'
                }`}
              >
                {sekme.sayi}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtrelenmisSiparisler.length === 0 ? (
        <div className="py-12 px-4 text-center text-stone-400 bg-[#180A1F] rounded-xl border border-[#3E1646]">
          <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-[#DDAF53]/60 mb-2" />
          <p className="text-xs sm:text-sm font-medium">{bosDurumMesaji}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrelenmisSiparisler.map((siparis) => {
            const kuryeYoldaMi =
              siparis.durum === 'yolda' ||
              siparis.durum === 'kuryede' ||
              siparis.durum === 'kurye_yolda' ||
              siparis.durum === 'kurye_teslim_aldi' ||
              siparis.durum === 'kuryeye_teslim_edildi';

            const durumBilgisi =
              siparis.durum === 'hazirlaniyor'
                ? {
                    sinif: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
                    etiket: '🔥 Hazırlanıyor',
                  }
                : siparis.durum === 'teslime_hazir'
                ? {
                    sinif: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
                    etiket: '📦 Teslime Hazır',
                  }
                : kuryeYoldaMi
                ? {
                    sinif: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
                    etiket: '🛵 Kuryede (Yolda)',
                  }
                : siparis.durum === 'teslim_edildi'
                ? {
                    sinif: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
                    etiket: '✅ Teslim Edildi',
                  }
                : siparis.durum === 'iptal'
                ? {
                    sinif: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
                    etiket: '❌ İptal Edildi',
                  }
                : {
                    sinif: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
                    etiket: '🛵 Kuryede',
                  };

            return (
              <div
                key={siparis.id}
                className="bg-[#180A1F] border border-[#3E1646] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-[#3E1646] text-[#DDAF53] font-bold text-xs px-2.5 py-0.5 rounded-md border border-[#521E5C] tabular-nums">
                      #{siparis.siparis_kodu}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${durumBilgisi.sinif}`}>
                      {durumBilgisi.etiket}
                    </span>
                    <span className="text-xs text-stone-400 tabular-nums">
                      PIN: <strong className="text-white">{siparis.pin_kodu}</strong>
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      siparis.teslimat_tipi === 'teslimat'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}>
                      {siparis.teslimat_tipi === 'teslimat'
                        ? '🛵 Kurye Teslimatı (Paketle -> Kurye Bekliyor)'
                        : '🏬 Gel-Al (Müşteri Şubeden Alacak)'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-300 pt-0.5">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-[#DDAF53]" /> {siparis.musteri_adi}</span>
                    <span className="flex items-center gap-1 tabular-nums"><Phone className="w-3.5 h-3.5 text-emerald-400" /> {siparis.musteri_telefon}</span>
                  </div>

                  {siparis.teslimat_tipi === 'teslimat' && siparis.teslimat_adresi_metni && (
                    <p className="text-[11px] text-sky-200/90 bg-sky-950/30 border border-sky-800/40 rounded-lg px-2.5 py-1 mt-1">
                      📍 {siparis.teslimat_adresi_metni}
                    </p>
                  )}

                  {siparis.teslimat_tipi === 'teslimat' &&
                    siparis.durum !== 'iptal' &&
                    (siparis.kurye_adi || siparis.durum === 'teslime_hazir' || kuryeYoldaMi) && (
                      <div className="text-[11px] text-sky-200 bg-[#1B1230] border border-sky-500/35 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1.5 font-semibold text-sky-300">
                          <Truck className="w-3.5 h-3.5 shrink-0" />
                          {siparis.kurye_adi
                            ? `Kurye: ${siparis.kurye_adi}`
                            : 'Kurye Durumu: Atama bekleniyor'}
                        </span>
                        {siparis.kurye_telefon && (
                          <span className="text-stone-300 tabular-nums">{siparis.kurye_telefon}</span>
                        )}
                        <span className="text-stone-400">
                          •{' '}
                          {kuryeYoldaMi
                            ? 'Paketi teslim aldı, müşteriye gidiyor'
                            : siparis.durum === 'teslim_edildi'
                            ? 'Müşteriye teslim etti'
                            : siparis.kurye_adi
                            ? 'Şubeden almaya geliyor'
                            : 'Kurye havuzunda bekliyor'}
                        </span>
                      </div>
                    )}

                  {siparis.urunler && siparis.urunler.length > 0 && (
                    <div className="text-xs text-stone-300 pt-1 flex flex-wrap gap-1">
                      {siparis.urunler.map((u, i) => (
                        <span key={i} className="bg-[#2A102E] px-2 py-0.5 rounded border border-[#521E5C] tabular-nums">
                          {u.adet}x {u.ad}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[#3E1646] pt-3 md:pt-0 shrink-0">
                  <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                    <span className="text-xs text-stone-400 sm:hidden">Toplam:</span>
                    <div className="text-base font-bold text-[#DDAF53] tabular-nums">{siparis.toplam_tutar} ₺</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {siparis.durum === 'hazirlaniyor' && (
                      <>
                        {iptalOnayId === siparis.id ? (
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <button
                              type="button"
                              disabled={islemdeId === siparis.id}
                              onClick={() => siparisiIptalEt(siparis.id)}
                              className="flex-1 sm:flex-initial min-h-[44px] px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Onayla (Stok İade)</span>
                            </button>
                            <button
                              type="button"
                              disabled={islemdeId === siparis.id}
                              onClick={() => setIptalOnayId(null)}
                              className="min-h-[44px] px-3 py-2 bg-[#2A102E] hover:bg-[#3E1646] text-stone-300 rounded-xl text-xs font-semibold border border-[#521E5C] cursor-pointer"
                            >
                              Vazgeç
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={islemdeId === siparis.id}
                              onClick={() => setIptalOnayId(siparis.id)}
                              className="min-h-[44px] px-3 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 rounded-xl text-xs font-bold border border-rose-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                              title="Siparişi iptal et ve stokları tezgaha iade et"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>İptal</span>
                            </button>
                            <button
                              type="button"
                              disabled={islemdeId === siparis.id}
                              onClick={() => durumGuncelle(siparis.id, 'teslime_hazir')}
                              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                            >
                              <span>Paketlendi • Teslime Hazır</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {siparis.durum === 'teslime_hazir' &&
                      (siparis.teslimat_tipi === 'teslimat' ? (
                        <div className="w-full sm:w-auto min-h-[44px] px-3.5 py-2.5 bg-sky-950/60 border border-sky-500/40 text-sky-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                          <span>
                            {siparis.kurye_adi
                              ? `🛵 Kurye Geliyor (${siparis.kurye_adi})`
                              : '🛵 Kurye Teslim Alması Bekleniyor'}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={islemdeId === siparis.id}
                          onClick={() => durumGuncelle(siparis.id, 'teslim_edildi')}
                          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Müşteriye Teslim Et</span>
                        </button>
                      ))}
                    {kuryeYoldaMi && (
                      <div className="w-full sm:w-auto min-h-[44px] px-3.5 py-2.5 bg-sky-950/70 border border-sky-400/50 text-sky-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span>
                          {siparis.kurye_adi
                            ? `🛵 Kuryede (${siparis.kurye_adi})`
                            : '🛵 Kurye Teslimatta'}
                        </span>
                      </div>
                    )}
                    {siparis.durum === 'teslim_edildi' && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 py-1">
                        <CheckCircle2 className="w-4 h-4" /> Teslim Edildi
                      </span>
                    )}
                    {siparis.durum === 'iptal' && (
                      <span className="text-xs text-rose-300 font-semibold flex items-center gap-1 py-1">
                        <XCircle className="w-4 h-4" />
                        {siparis.stok_iade_edildi_mi ? 'İptal • Stok İade Edildi' : 'İptal Edildi'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
