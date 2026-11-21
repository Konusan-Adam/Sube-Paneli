import React from 'react';
import { KullaniciSaglayici } from './OrtakHavuz/KullaniciHafizasi';
import { SubeYoneticisiPaneli } from './VitrinOdasi/SubePaneli/SubeYoneticisiPaneli';

interface HataSiniriState {
  hataMesaji: string | null;
}

class HataSiniri extends React.Component<{ children: React.ReactNode }, HataSiniriState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hataMesaji: null };
  }

  static getDerivedStateFromError(error: Error): HataSiniriState {
    return { hataMesaji: error?.message || 'Beklenmeyen bir hata oluştu.' };
  }

  render() {
    if (this.state.hataMesaji) {
      return (
        <div className="min-h-screen bg-[#180A1F] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#220E29] border border-rose-500/40 rounded-2xl p-6 space-y-4 text-center shadow-2xl">
            <h2 className="text-lg font-bold text-[#DDAF53]">Bağlantı veya Yetki Hatası</h2>
            <p className="text-xs text-stone-300 leading-relaxed">
              Veritabanı işlemi sırasında yetki veya bağlantı sorunu yaşandı. Lütfen oturumunuzu kontrol edip yeniden deneyin.
            </p>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('afyon_sube_paneli_oturum');
                window.location.reload();
              }}
              className="px-4 py-2.5 rounded-xl bg-[#6D237A] hover:bg-[#852C94] border border-[#9633A7] text-xs font-bold text-white cursor-pointer"
            >
              Sayfayı Yenile & Tekrar Dene
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <HataSiniri>
      <KullaniciSaglayici>
        <SubeYoneticisiPaneli />
      </KullaniciSaglayici>
    </HataSiniri>
  );
}
