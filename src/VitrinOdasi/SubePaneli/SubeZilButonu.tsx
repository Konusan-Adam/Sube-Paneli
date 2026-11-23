import React, { useState } from 'react';
import { Bell, BellOff, Volume2 } from 'lucide-react';
import { subeZilAktifMi, subeZilAyariniDegistir, subeSiparisZiliCal } from '@/src/MalzemeCekmeceleri/Sube/subeZilServisi';

interface SubeZilButonuProps {
  tamGenislik?: boolean;
}

export const SubeZilButonu: React.FC<SubeZilButonuProps> = ({ tamGenislik = false }) => {
  const [aktif, setAktif] = useState<boolean>(subeZilAktifMi());

  const ayariDegistir = () => {
    const yeni = !aktif;
    setAktif(yeni);
    subeZilAyariniDegistir(yeni);
    if (yeni) subeSiparisZiliCal();
  };

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
          onClick={() => subeSiparisZiliCal()}
          className={`rounded-lg hover:bg-[#3E1646] text-[#DDAF53] transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold ${
            tamGenislik ? 'min-h-[44px] px-3 py-2 bg-[#180A1F] border border-[#521E5C]' : 'p-1.5'
          }`}
          title="Sipariş Sirenini Test Et"
        >
          <Volume2 className="w-4 h-4" />
          {tamGenislik && <span>Test Et</span>}
        </button>
      )}
    </div>
  );
};
