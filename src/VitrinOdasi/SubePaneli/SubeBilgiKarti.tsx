import React, { useState, useEffect } from 'react';
import { Store, Clock, Video, MapPin, Power, Check, Loader2, AlertCircle, Save } from 'lucide-react';
import { GelAlSubesi } from '@/src/veritabani/SubeTipleri';
import { SubeKapakYukleyici } from './SubeKapakYukleyici';

export interface SubeAyarGuncellemesi {
  acik_mi: boolean;
  acilis_saati: string;
  kapanis_saati: string;
  calisma_saatleri: string;
  hazirlanma_suresi?: string;
}

interface Props {
  sube: GelAlSubesi;
  onCanliYayinToggle?: () => void;
  onKapakGuncelle?: (yeniUrl: string) => Promise<void> | void;
  onDurumDegistir?: (acikMi: boolean) => Promise<boolean | void> | void;
  onSaatleriKaydet?: (ayarlar: SubeAyarGuncellemesi) => Promise<boolean | void> | void;
}

function saatiNormallestir(deger: string | undefined, varsayilan: string): string {
  if (!deger) return varsayilan;
  const eslesme = deger.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!eslesme) return varsayilan;
  const saat = Number(eslesme[1]);
  const dakika = Number(eslesme[2]);
  if (saat < 0 || saat > 23 || dakika < 0 || dakika > 59) return varsayilan;
  return `${String(saat).padStart(2, '0')}:${String(dakika).padStart(2, '0')}`;
}

function subeSaatleriniCoze(sube: GelAlSubesi): { acilis: string; kapanis: string } {
  if (sube.acilis_saati && sube.kapanis_saati) {
    return {
      acilis: saatiNormallestir(sube.acilis_saati, '09:00'),
      kapanis: saatiNormallestir(sube.kapanis_saati, '22:00'),
    };
  }
  const metin = sube.calisma_saatleri || '';
  const eslesme = metin.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  return {
    acilis: saatiNormallestir(sube.acilis_saati || eslesme?.[1], '09:00'),
    kapanis: saatiNormallestir(sube.kapanis_saati || eslesme?.[2], '22:00'),
  };
}

export const SubeBilgiKarti: React.FC<Props> = ({
  sube,
  onCanliYayinToggle,
  onKapakGuncelle,
  onDurumDegistir,
  onSaatleriKaydet,
}) => {
  const subeAcikMi = sube.acik_mi !== false;
  const baslangicSaatleri = subeSaatleriniCoze(sube);

  const [acilisSaati, setAcilisSaati] = useState<string>(baslangicSaatleri.acilis);
  const [kapanisSaati, setKapanisSaati] = useState<string>(baslangicSaatleri.kapanis);
  const [hazirlanmaSuresi, setHazirlanmaSuresi] = useState<string>(sube.hazirlanma_suresi || '15-20 dk');
  const [durumKaydediliyor, setDurumKaydediliyor] = useState<boolean>(false);
  const [saatKaydediliyor, setSaatKaydediliyor] = useState<boolean>(false);
  const [kayitBasarili, setKayitBasarili] = useState<boolean>(false);
  const [hataMesaji, setHataMesaji] = useState<string>('');

  useEffect(() => {
    const guncel = subeSaatleriniCoze(sube);
    setAcilisSaati(guncel.acilis);
    setKapanisSaati(guncel.kapanis);
    if (sube.hazirlanma_suresi !== undefined) {
      setHazirlanmaSuresi(sube.hazirlanma_suresi || '15-20 dk');
    }
  }, [sube.acilis_saati, sube.kapanis_saati, sube.calisma_saatleri, sube.hazirlanma_suresi]);

  const durumDegistir = async () => {
    if (!onDurumDegistir || durumKaydediliyor) return;
    setDurumKaydediliyor(true);
    setHataMesaji('');
    try {
      await onDurumDegistir(!subeAcikMi);
    } catch {
      setHataMesaji('Şube durumu güncellenemedi.');
    } finally {
      setDurumKaydediliyor(false);
    }
  };

  const saatleriKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaatleriKaydet || saatKaydediliyor) return;
    setHataMesaji('');
    setKayitBasarili(false);

    const temizAcilis = saatiNormallestir(acilisSaati, '');
    const temizKapanis = saatiNormallestir(kapanisSaati, '');
    if (!temizAcilis || !temizKapanis) {
      setHataMesaji('Geçerli bir açılış ve kapanış saati seçin.');
      return;
    }

    setSaatKaydediliyor(true);
    try {
      const temizHazirlanma = hazirlanmaSuresi.trim();
      const sonuc = await onSaatleriKaydet({
        acik_mi: subeAcikMi,
        acilis_saati: temizAcilis,
        kapanis_saati: temizKapanis,
        calisma_saatleri: `${temizAcilis} - ${temizKapanis}`,
        ...(temizHazirlanma ? { hazirlanma_suresi: temizHazirlanma } : {}),
      });
      if (sonuc === false) {
        setHataMesaji('Saatler kaydedilemedi. Lütfen tekrar deneyin.');
      } else {
        setKayitBasarili(true);
        setTimeout(() => setKayitBasarili(false), 2500);
      }
    } catch {
      setHataMesaji('Saatler kaydedilirken bir hata oluştu.');
    } finally {
      setSaatKaydediliyor(false);
    }
  };

  return (
    <div className="bg-[#220E29] border border-[#521E5C] rounded-2xl p-3.5 sm:p-5 text-white shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#3E1646] border border-[#6D237A] overflow-hidden flex items-center justify-center text-[#DDAF53] shrink-0 relative shadow-inner">
            {sube.gorsel ? (
              <img src={sube.gorsel} alt={sube.ad} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-6 h-6 text-[#DDAF53]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 inline-block">
                Şube Yönetim Merkezi
              </span>
              {!subeAcikMi && (
                <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/50 inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Şu an müşteri siparişine kapalı
                </span>
              )}
            </div>
            <h2 className="text-sm sm:text-lg font-bold text-white mt-0.5 truncate">{sube.ad}</h2>
            <p className="text-[11px] sm:text-xs text-stone-300 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#DDAF53] shrink-0" />
              <span className="truncate">{sube.adres}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-start md:justify-end">
          {onDurumDegistir && (
            <button
              type="button"
              onClick={durumDegistir}
              disabled={durumKaydediliyor}
              className={`min-h-[40px] lg:min-h-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border disabled:opacity-60 ${
                subeAcikMi
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 hover:bg-emerald-900/70'
                  : 'bg-rose-950/80 border-rose-500 text-rose-200 hover:bg-rose-900/70'
              }`}
              title={subeAcikMi ? 'Şubeyi müşteri siparişine kapat' : 'Şubeyi müşteri siparişine aç'}
            >
              {durumKaydediliyor ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              <span>{subeAcikMi ? 'Şube Açık' : 'Şube Kapalı'}</span>
            </button>
          )}

          {onKapakGuncelle && (
            <SubeKapakYukleyici
              mevcutGorsel={sube.gorsel}
              onGorselYuklendi={onKapakGuncelle}
            />
          )}

          <div className="bg-[#180A1F] border border-[#3E1646] rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#DDAF53]" />
            <span>{sube.calisma_saatleri || `${acilisSaati} - ${kapanisSaati}`}</span>
          </div>

          <button
            onClick={onCanliYayinToggle}
            type="button"
            className={`min-h-[40px] lg:min-h-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              sube.canli_yayin_aktif_mi
                ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                : 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            {sube.canli_yayin_aktif_mi ? 'Canlı Yayını Kapat' : 'Canlı Yayını Aç'}
          </button>
        </div>
      </div>

      {/* Şube Çalışma Saatleri & Hazırlanma Süresi Ayarları */}
      {onSaatleriKaydet && (
        <form
          onSubmit={saatleriKaydet}
          className="border-t border-[#3E1646] pt-3.5 flex flex-col lg:flex-row lg:items-end justify-between gap-3"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-[#A872B5] block">Açılış Saati</span>
              <input
                type="time"
                value={acilisSaati}
                onChange={(e) => setAcilisSaati(e.target.value)}
                required
                className="w-full min-h-[44px] lg:min-h-[38px] bg-[#180A1F] border border-[#521E5C] focus:border-[#DDAF53] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-white tabular-nums outline-none [color-scheme:dark]"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-[#A872B5] block">Kapanış Saati</span>
              <input
                type="time"
                value={kapanisSaati}
                onChange={(e) => setKapanisSaati(e.target.value)}
                required
                className="w-full min-h-[44px] lg:min-h-[38px] bg-[#180A1F] border border-[#521E5C] focus:border-[#DDAF53] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-white tabular-nums outline-none [color-scheme:dark]"
              />
            </label>

            <label className="block space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-[#A872B5] block">Hazırlanma Süresi</span>
              <input
                type="text"
                value={hazirlanmaSuresi}
                onChange={(e) => setHazirlanmaSuresi(e.target.value)}
                placeholder="15-20 dk"
                maxLength={32}
                className="w-full min-h-[44px] lg:min-h-[38px] bg-[#180A1F] border border-[#521E5C] focus:border-[#DDAF53] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-white placeholder:text-stone-500 outline-none"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {hataMesaji && (
              <span className="text-xs text-rose-300 font-medium">{hataMesaji}</span>
            )}
            <button
              type="submit"
              disabled={saatKaydediliyor}
              className={`min-h-[44px] lg:min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border disabled:opacity-60 ${
                kayitBasarili
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-[#6D237A] hover:bg-[#852C94] border-[#9633A7] text-white'
              }`}
            >
              {saatKaydediliyor ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : kayitBasarili ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4 text-[#DDAF53]" />
              )}
              <span>
                {saatKaydediliyor
                  ? 'Kaydediliyor...'
                  : kayitBasarili
                  ? 'Saatler Kaydedildi'
                  : 'Saatleri Kaydet'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
