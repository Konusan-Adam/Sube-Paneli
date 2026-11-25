import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import {
  subeZilAktifMi,
  subeZilAyariniDegistir,
  subeSireniniBaslat,
  subeSireniniDurdur,
  subeSirenDinle,
} from '@/src/MalzemeCekmeceleri/Sube/subeZilServisi';

interface SubeZilButonuProps {
  tamGenislik?: boolean;
}

export const SubeZilButonu: React.FC<SubeZilButonuProps> = ({ tamGenislik = false }) => {
  const [aktif, setAktif] = useState<boolean>(subeZilAktifMi());
  const [sirenCaliyor, setSirenCaliyor] = useState<boolean>(false);

  useEffect(() => {
    const durdur = subeSirenDinle((caliyor) => {
      setSirenCaliyor(caliyor);
    });
    return () => durdur();
  }, []);

  const ayariDegistir = () => {
    const yeni = !aktif;
    setAktif(yeni);
    subeZilAyariniDegistir(yeni);
    if (!yeni) {
      subeSireniniDurdur();
    }
  };

  if (sirenCaliyor) {
    return (
      <div
        className={`flex items-center gap-1.5 bg-rose-950/90 border-2 border-rose-500 rounded-xl animate-pulse shadow-lg shadow-rose-950/70 ${
          tamGenislik ? 'p-1.5 w-full' : 'p-0.5 sm:p-1 shrink-0'
        }`}
      >
        <button
          type="button"
          onClick={() => subeSireniniDurdur()}
          className={`rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
            tamGenislik ? 'w-full min-h-[44px] px-3 py-2' : 'px-2.5 py-1.5'
          }`}
          title="Çalan Sireni Anında Sustur"
        >
          <VolumeX className="w-4 h-4 text-white animate-bounce" />
          <span>Sireni Sustur</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 bg-[#2A102E] border border-[#521E5C] rounded-xl ${
        tamGenislik ? 'p-1.5 w-full justify-between' : 'p-0.5 sm:p-1 shrink-0'
      }`}
    >
      <button
        type="button"
        onClick={ayariDegistir}
        className={`rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
          tamGenislik ? 'flex-1 min-h-[44px] px-3 py-2' : 'px-2 py-1.5'
        } ${
          aktif
            ? 'bg-amber-500/20 text-[#DDAF53] border border-amber-500/40'
            : 'text-stone-400 hover:text-white'
        }`}
        title={aktif ? 'Siren Açık (Kapatmak için tıkla)' : 'Siren Kapalı'}
      >
        {aktif ? <Bell className="w-4 h-4 text-[#DDAF53]" /> : <BellOff className="w-4 h-4" />}
        <span className={tamGenislik ? 'inline' : 'hidden md:inline'}>
          {aktif ? 'Siren Açık' : 'Siren Kapalı'}
        </span>
      </button>

      {aktif && (
        <button
          type="button"
          onClick={() => subeSireniniBaslat()}
          className={`rounded-lg hover:bg-[#3E1646] text-[#DDAF53] transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold ${
            tamGenislik ? 'min-h-[44px] px-3 py-2 bg-[#180A1F] border border-[#521E5C]' : 'p-1.5'
          }`}
          title="Sipariş Sirenini Çal (Döngü Testi)"
        >
          <Volume2 className="w-4 h-4" />
          {tamGenislik && <span>Test Et</span>}
        </button>
      )}
    </div>
  );
};
