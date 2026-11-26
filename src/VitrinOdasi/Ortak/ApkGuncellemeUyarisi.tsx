import React from 'react';
import { Download, Loader2, RefreshCw, X } from 'lucide-react';
import { useApkGuncelleme } from '@/src/MalzemeCekmeceleri/Mobil/useApkGuncelleme';

export const ApkGuncellemeUyarisi: React.FC = () => {
  const { guncelleme, otaDurum, otaMesaj, simdiGuncelle, uyariyiKapat } = useApkGuncelleme();

  if (!guncelleme?.yeniSurumVar) {
    return null;
  }

  return (
    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#2A102E] to-[#3E1646] border border-[#DDAF53]/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#DDAF53]/20 border border-[#DDAF53]/50 flex items-center justify-center text-[#DDAF53] shrink-0">
          <RefreshCw className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-white">
            Yeni Uygulama Sürümü Hazır (v{guncelleme.yeniSurumAdi})
          </p>
          <p className="text-[11px] text-[#A872B5]">
            {otaMesaj ||
              `Mevcut sürüm: v${guncelleme.mevcutSurumAdi}. Tek tıkla güncelleyebilirsiniz.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={simdiGuncelle}
          disabled={otaDurum === 'indiriliyor'}
          className="px-4 py-2 rounded-xl bg-[#DDAF53] hover:bg-[#e8be68] text-[#180A1F] text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {otaDurum === 'indiriliyor' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{otaDurum === 'indiriliyor' ? 'İndiriliyor...' : 'Güncelle'}</span>
        </button>

        <button
          type="button"
          onClick={uyariyiKapat}
          className="p-2 rounded-xl bg-[#180A1F]/70 hover:bg-[#180A1F] text-stone-300 cursor-pointer"
          aria-label="Güncelleme uyarısını kapat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
