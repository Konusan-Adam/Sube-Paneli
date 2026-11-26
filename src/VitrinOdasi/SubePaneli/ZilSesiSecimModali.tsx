import React, { useEffect, useRef, useState } from 'react';
import {
  BatteryCharging,
  Check,
  Music,
  Play,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  AZAMI_OZEL_SES_BOYUTU_BAYT,
  HAZIR_ZIL_SESLERI,
  SeciliZilKimligi,
  ZilSesiAyarlari,
  androidPilOptimizasyonuIste,
  androidZilCal,
  androidZilSustur,
  sesSeviyesiniSinirla,
  yerliAndroidOrtamindaMi,
  zilAyarlariniKaydetVeSenkronizeEt,
  zilAyarlariniOku,
} from '@/src/MalzemeCekmeceleri/Mobil/AndroidKopruServisi';
import {
  subeZilOnizlemeCal,
  subeZilOnizlemeDurdur,
} from '@/src/MalzemeCekmeceleri/Sube/subeZilServisi';

interface ZilSesiSecimModaliProps {
  acik: boolean;
  kapat: () => void;
}

export const ZilSesiSecimModali: React.FC<ZilSesiSecimModaliProps> = ({ acik, kapat }) => {
  const [ayarlar, setAyarlar] = useState<ZilSesiAyarlari>(() => zilAyarlariniOku());
  const [calinanOnizleme, setCalinanOnizleme] = useState<SeciliZilKimligi | null>(null);
  const [hataMesaji, setHataMesaji] = useState<string>('');
  const [pilBilgisi, setPilBilgisi] = useState<string>('');
  const dosyaGirdiRef = useRef<HTMLInputElement | null>(null);
  const androidMi = yerliAndroidOrtamindaMi();

  useEffect(() => {
    if (acik) {
      setAyarlar(zilAyarlariniOku());
      setHataMesaji('');
      setPilBilgisi('');
    } else {
      subeZilOnizlemeDurdur();
      setCalinanOnizleme(null);
    }
    return () => {
      subeZilOnizlemeDurdur();
    };
  }, [acik]);

  if (!acik) return null;

  const guncelAyarlaVeSenkronizeEt = (yeni: ZilSesiAyarlari, ozelDegisti = false) => {
    setAyarlar(yeni);
    zilAyarlariniKaydetVeSenkronizeEt(yeni, ozelDegisti);
  };

  const melodiSec = (kimlik: SeciliZilKimligi) => {
    setHataMesaji('');
    const yeni: ZilSesiAyarlari = { ...ayarlar, seciliKimlik: kimlik };
    guncelAyarlaVeSenkronizeEt(yeni, false);
  };

  const sesSeviyesiDegistir = (yeniDeger: number) => {
    const sinirli = sesSeviyesiniSinirla(yeniDeger);
    const yeni: ZilSesiAyarlari = { ...ayarlar, sesSeviyesi: sinirli };
    guncelAyarlaVeSenkronizeEt(yeni, false);
  };

  const onizlemeDegistir = (kimlik: SeciliZilKimligi) => {
    if (calinanOnizleme === kimlik) {
      subeZilOnizlemeDurdur();
      androidZilSustur();
      setCalinanOnizleme(null);
      return;
    }

    setCalinanOnizleme(kimlik);
    const veriUrl = kimlik === 'ozel_ses' ? ayarlar.ozelSesVeriUrl : undefined;
    subeZilOnizlemeCal(kimlik, ayarlar.sesSeviyesi, veriUrl, () => {
      setCalinanOnizleme((aktif) => (aktif === kimlik ? null : aktif));
    });
  };

  const ozelSesSecildi = (olay: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = olay.target.files?.[0];
    olay.target.value = '';
    if (!dosya) return;

    const adKucuk = dosya.name.toLowerCase();
    const gecerliUzanti =
      adKucuk.endsWith('.mp3') || adKucuk.endsWith('.wav') || adKucuk.endsWith('.ogg');
    const gecerliTur = dosya.type.startsWith('audio/');
    if (!gecerliUzanti && !gecerliTur) {
      setHataMesaji('Yalnızca .mp3, .wav veya .ogg ses dosyası yükleyebilirsiniz.');
      return;
    }

    if (dosya.size > AZAMI_OZEL_SES_BOYUTU_BAYT) {
      setHataMesaji('Ses dosyası en fazla 2.5 MB boyutunda olabilir.');
      return;
    }

    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      const sonuc = typeof okuyucu.result === 'string' ? okuyucu.result : '';
      if (!sonuc.startsWith('data:audio/')) {
        setHataMesaji('Ses dosyası okunamadı, farklı bir dosya deneyin.');
        return;
      }
      setHataMesaji('');
      const yeni: ZilSesiAyarlari = {
        ...ayarlar,
        seciliKimlik: 'ozel_ses',
        ozelSesAdi: dosya.name,
        ozelSesVeriUrl: sonuc,
      };
      guncelAyarlaVeSenkronizeEt(yeni, true);
    };
    okuyucu.onerror = () => {
      setHataMesaji('Ses dosyası okunurken bir hata oluştu.');
    };
    okuyucu.readAsDataURL(dosya);
  };

  const ozelSesiKaldir = () => {
    subeZilOnizlemeDurdur();
    setCalinanOnizleme(null);
    const yeni: ZilSesiAyarlari = {
      ...ayarlar,
      seciliKimlik: ayarlar.seciliKimlik === 'ozel_ses' ? 'nukleer_siren' : ayarlar.seciliKimlik,
      ozelSesAdi: '',
      ozelSesVeriUrl: '',
    };
    guncelAyarlaVeSenkronizeEt(yeni, true);
  };

  const pilMuafiyetiIste = () => {
    const sonuc = androidPilOptimizasyonuIste();
    if (sonuc === 'zaten_muaf') {
      setPilBilgisi('Pil optimizasyonu muafiyeti zaten aktif.');
    } else if (sonuc === 'istek_acildi') {
      setPilBilgisi('Lütfen açılan Android penceresinde "İzin Ver" seçeneğini onaylayın.');
    } else {
      setPilBilgisi('Bu ayar yalnızca Android uygulaması içinde kullanılabilir.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3.5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zil-modal-baslik"
    >
      <div className="w-full max-w-lg bg-[#220E29] border border-[#521E5C] rounded-2xl shadow-2xl overflow-hidden text-white">
        <div className="px-5 py-4 bg-[#180A1F] border-b border-[#3E1646] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#6D237A] flex items-center justify-center text-[#DDAF53]">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 id="zil-modal-baslik" className="text-base font-bold text-white">
                Zil Sesi Seç &amp; Ekle
              </h2>
              <p className="text-xs text-[#A872B5]">
                Ekran kapalıyken çalacak şube alarm zilini seçin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={kapat}
            className="w-9 h-9 rounded-xl bg-[#2A102E] hover:bg-[#3E1646] text-stone-300 flex items-center justify-center cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {hataMesaji && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold">
              {hataMesaji}
            </div>
          )}

          {/* Hazır Melodiler */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#DDAF53] uppercase tracking-wider">
              Hazır Alarm Zil Sesleri
            </p>
            <div className="space-y-2">
              {HAZIR_ZIL_SESLERI.map((zil) => {
                const secili = ayarlar.seciliKimlik === zil.kimlik;
                const caliyor = calinanOnizleme === zil.kimlik;
                return (
                  <div
                    key={zil.kimlik}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                      secili
                        ? 'bg-[#6D237A]/35 border-[#DDAF53]'
                        : 'bg-[#180A1F] border-[#3E1646] hover:border-[#6D237A]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => melodiSec(zil.kimlik)}
                      className="flex-1 text-left flex items-center gap-3 min-w-0 cursor-pointer"
                    >
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          secili
                            ? 'bg-[#DDAF53] border-[#DDAF53] text-[#180A1F]'
                            : 'border-[#A872B5]/50'
                        }`}
                      >
                        {secili && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{zil.ad}</p>
                        <p className="text-[11px] text-[#A872B5] truncate">{zil.aciklama}</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onizlemeDegistir(zil.kimlik)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        caliyor
                          ? 'bg-rose-600 text-white'
                          : 'bg-[#2A102E] hover:bg-[#3E1646] text-[#DDAF53] border border-[#521E5C]'
                      }`}
                    >
                      {caliyor ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{caliyor ? 'Durdur' : 'Dinle'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Özel Ses Yükleme */}
          <div className="p-3.5 rounded-xl bg-[#180A1F] border border-[#3E1646] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[#DDAF53]">Özel Zil Sesi Yükle</p>
                <p className="text-[11px] text-[#A872B5]">
                  Cihazdan .mp3, .wav veya .ogg dosyası (En fazla 2.5 MB)
                </p>
              </div>
              <input
                ref={dosyaGirdiRef}
                type="file"
                accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                onChange={ozelSesSecildi}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => dosyaGirdiRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-[#6D237A] hover:bg-[#822B92] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#DDAF53]" />
                <span>Dosya Seç</span>
              </button>
            </div>

            {ayarlar.ozelSesVeriUrl && (
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                  ayarlar.seciliKimlik === 'ozel_ses'
                    ? 'bg-[#6D237A]/35 border-[#DDAF53]'
                    : 'bg-[#220E29] border-[#521E5C]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => melodiSec('ozel_ses')}
                  className="flex-1 text-left flex items-center gap-2.5 min-w-0 cursor-pointer"
                >
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      ayarlar.seciliKimlik === 'ozel_ses'
                        ? 'bg-[#DDAF53] border-[#DDAF53] text-[#180A1F]'
                        : 'border-[#A872B5]/50'
                    }`}
                  >
                    {ayarlar.seciliKimlik === 'ozel_ses' && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {ayarlar.ozelSesAdi || 'Yüklenen Özel Zil'}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onizlemeDegistir('ozel_ses')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      calinanOnizleme === 'ozel_ses'
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#2A102E] text-[#DDAF53]'
                    }`}
                  >
                    {calinanOnizleme === 'ozel_ses' ? (
                      <Square className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>{calinanOnizleme === 'ozel_ses' ? 'Dur' : 'Dinle'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={ozelSesiKaldir}
                    className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 cursor-pointer"
                    title="Özel sesi sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ses Seviyesi */}
          <div className="p-3.5 rounded-xl bg-[#180A1F] border border-[#3E1646] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-white">
                <Volume2 className="w-4 h-4 text-[#DDAF53]" />
                <span>Alarm Ses Seviyesi</span>
              </span>
              <span className="text-[#DDAF53] tabular-nums">
                %{Math.round(ayarlar.sesSeviyesi * 100)}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(ayarlar.sesSeviyesi * 100)}
              onChange={(e) => sesSeviyesiDegistir(Number(e.target.value) / 100)}
              className="w-full accent-[#DDAF53] cursor-pointer"
            />
          </div>

          {/* Android Arka Plan Testi ve Pil Muafiyeti */}
          {androidMi && (
            <div className="p-3.5 rounded-xl bg-[#180A1F] border border-[#521E5C] space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    androidZilCal(
                      'Afyon Şube Test Alarmı',
                      'Arka plan siren ve titreşim testi çalışıyor.',
                      false,
                      5
                    )
                  }
                  className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl bg-[#2A102E] hover:bg-[#3E1646] border border-[#521E5C] text-[#DDAF53] text-xs font-bold cursor-pointer"
                >
                  Native Alarm Testi (5 sn)
                </button>
                <button
                  type="button"
                  onClick={pilMuafiyetiIste}
                  className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BatteryCharging className="w-4 h-4" />
                  <span>Pil Muafiyeti Ver</span>
                </button>
              </div>
              {pilBilgisi && <p className="text-[11px] text-emerald-300">{pilBilgisi}</p>}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-[#180A1F] border-t border-[#3E1646] flex justify-end">
          <button
            type="button"
            onClick={kapat}
            className="px-5 py-2.5 rounded-xl bg-[#DDAF53] hover:bg-[#e8be68] text-[#180A1F] text-xs font-black cursor-pointer"
          >
            Tamam ve Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};
