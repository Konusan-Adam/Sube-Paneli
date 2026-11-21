import React, { useState } from 'react';
import { Store, Phone, Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';
import { kullaniciHafizasiKullan } from '@/src/OrtakHavuz/KullaniciHafizasi';
import { telefonMaskele } from '@/src/MalzemeCekmeceleri/Dogrulama/telefonDogrulayici';

export const SubeGirisEkrani: React.FC = () => {
  const { girisYap, yukleniyor } = kullaniciHafizasiKullan();
  const [telefon, setTelefon] = useState<string>('');
  const [sifre, setSifre] = useState<string>('');
  const [sifreGorunur, setSifreGorunur] = useState<boolean>(false);
  const [hata, setHata] = useState<string>('');

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata('');
    const sonuc = await girisYap(telefon, sifre);
    if (!sonuc.basarili) {
      setHata(sonuc.hata || 'Giriş yapılamadı.');
    }
  };

  return (
    <div className="min-h-screen bg-[#180A1F] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#220E29] border border-[#521E5C] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#6D237A] border border-[#9633A7] flex items-center justify-center shadow-lg">
            <Store className="w-8 h-8 text-[#DDAF53]" />
          </div>
          <h1 className="text-xl font-bold text-white">Afyon Ev Lezzetleri</h1>
          <p className="text-xs font-semibold text-[#DDAF53] tracking-wide uppercase">
            Şube Yönetim Paneli
          </p>
          <p className="text-xs text-stone-300">
            Yetkili Şube Müdürü veya Yönetici hesabınızla oturum açın.
          </p>
        </div>

        {hata && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{hata}</span>
          </div>
        )}

        <form onSubmit={gonder} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#CFA353] block">Telefon Numarası</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#A872B5] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={telefon}
                onChange={(e) => setTelefon(telefonMaskele(e.target.value))}
                placeholder="05XX XXX XX XX"
                className="w-full bg-[#180A1F] border border-[#521E5C] focus:border-[#DDAF53] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#CFA353] block">Şifre</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A872B5] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={sifreGorunur ? 'text' : 'password'}
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                placeholder="••••••"
                className="w-full bg-[#180A1F] border border-[#521E5C] focus:border-[#DDAF53] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setSifreGorunur((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer"
                aria-label="Şifreyi Göster"
              >
                {sifreGorunur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={yukleniyor}
            className="w-full py-3 rounded-xl bg-[#6D237A] hover:bg-[#852C94] disabled:opacity-60 border border-[#9633A7] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-[#DDAF53]" />
            <span>{yukleniyor ? 'Giriş Yapılıyor...' : 'Panele Giriş Yap'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
