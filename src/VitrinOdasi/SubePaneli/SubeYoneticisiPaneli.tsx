import React, { useState, useEffect } from 'react';
import { LogOut, Package, ShoppingBag, TrendingUp, Store, Power, Wallet, Bell, AlertCircle } from 'lucide-react';
import { kullaniciHafizasiKullan } from '@/src/OrtakHavuz/KullaniciHafizasi';
import { subeMuduruRoluGecerliMi } from '@/src/MalzemeCekmeceleri/Kullanici/kullaniciGirisServisi';
import { gelAlSubeleriGetir } from '@/src/MalzemeCekmeceleri/gelAlSubeleriGetir';
import { useSubeUrunleri } from '@/src/MalzemeCekmeceleri/Sube/useSubeUrunleri';
import { subeSiparisleriniCanliDinle } from '@/src/MalzemeCekmeceleri/Sube/subeSiparisServisi';
import { SubeSiparisi } from '@/src/veritabani/SubeTipleri';
import { SubeBilgiKarti, SubeAyarGuncellemesi } from './SubeBilgiKarti';
import { SubeStokYonetimi } from './SubeStokYonetimi';
import { SubeSiparisYonetimi } from './SubeSiparisYonetimi';
import { SubeTedarikVeKazanc } from './SubeTedarikVeKazanc';
import { SubeZilButonu } from './SubeZilButonu';
import { SubeGirisEkrani } from './SubeGirisEkrani';
import { subeSiparisZiliCal } from '@/src/MalzemeCekmeceleri/Sube/subeZilServisi';

type PanelSekmesi = 'siparisler' | 'stoklar' | 'tedarik_kazanc' | 'subem';

export const SubeYoneticisiPaneli: React.FC = () => {
  const { aktifKullanici, cikisYap } = kullaniciHafizasiKullan();
  const atananSubeId = aktifKullanici?.sube_id?.trim() || '';
  const rolYetkiliMi = Boolean(
    aktifKullanici && subeMuduruRoluGecerliMi(aktifKullanici.rol) && atananSubeId
  );

  const { subeler, subeGuncelle } = gelAlSubeleriGetir(rolYetkiliMi, atananSubeId);
  const { urunler } = useSubeUrunleri(atananSubeId, rolYetkiliMi);
  const [siparisler, setSiparisler] = useState<SubeSiparisi[]>([]);
  const [aktifSekme, setAktifSekme] = useState<PanelSekmesi>('siparisler');
  const [durumGuncelleniyor, setDurumGuncelleniyor] = useState(false);
  const [logoHatali, setLogoHatali] = useState(false);
  const oncekiSayiRef = React.useRef<number | null>(null);

  const aktifSube = subeler.find((s) => s.id === atananSubeId || s.kimlik === atananSubeId) || null;
  const gosterilenSubeAdi = aktifSube?.ad || aktifKullanici?.isletme_adi || `Şube (${atananSubeId})`;
  const subeAcikMi = aktifSube?.acik_mi !== false;
  const aktifSiparisSayisi = siparisler.filter(
    (s) => s.durum !== 'teslim_edildi' && s.durum !== 'iptal'
  ).length;

  useEffect(() => {
    setLogoHatali(false);
  }, [aktifSube?.gorsel]);

  useEffect(() => {
    if (!rolYetkiliMi || !atananSubeId) {
      setSiparisler([]);
      return;
    }
    const durdur = subeSiparisleriniCanliDinle(
      atananSubeId,
      (liste) => {
        if (oncekiSayiRef.current !== null && liste.length > oncekiSayiRef.current) {
          subeSiparisZiliCal();
        }
        oncekiSayiRef.current = liste.length;
        setSiparisler(liste);
      },
      (hata) => {
        console.warn('Şube siparişleri canlı dinleme yetki uyarısı:', hata.message);
      }
    );
    return () => durdur();
  }, [rolYetkiliMi, atananSubeId]);

  const canliYayinToggle = async () => {
    if (!aktifSube || !atananSubeId) return;
    const yeniDurum = !aktifSube.canli_yayin_aktif_mi;
    await subeGuncelle(atananSubeId, { canli_yayin_aktif_mi: yeniDurum });
  };

  const subeDurumDegistir = async (yeniDurum: boolean) => {
    if (!atananSubeId) return false;
    return await subeGuncelle(atananSubeId, { acik_mi: yeniDurum });
  };

  const subeSaatleriKaydet = async (ayarlar: SubeAyarGuncellemesi) => {
    if (!atananSubeId) return false;
    return await subeGuncelle(atananSubeId, ayarlar);
  };

  const subeAcikKapaliToggle = async () => {
    if (!atananSubeId || durumGuncelleniyor) return;
    setDurumGuncelleniyor(true);
    try {
      await subeDurumDegistir(!subeAcikMi);
    } finally {
      setDurumGuncelleniyor(false);
    }
  };

  if (!rolYetkiliMi) {
    return <SubeGirisEkrani />;
  }

  const masaustuSekmesi = aktifSekme === 'subem' ? 'siparisler' : aktifSekme;
  const mobilLogoSrc = !logoHatali ? aktifSube?.gorsel || '/marka_logosu.jpg' : '';
  const mobilAltBaslik = aktifSube?.ilce
    ? `${aktifSube.ilce}, Afyonkarahisar`
    : `Şube Müdürü: ${aktifKullanici?.ad_soyad}`;

  return (
    <div className="min-h-screen bg-[#180A1F] text-white flex flex-col">
      {/* Mobil & Tablet (APK) Üst Çubuk */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-[#180A1F]/95 backdrop-blur-md border-b border-[#3E1646] px-3.5 flex items-center justify-between gap-2.5 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full border border-[#DDAF53]/60 bg-[#220E29] overflow-hidden flex items-center justify-center shrink-0">
            {mobilLogoSrc ? (
              <img
                src={mobilLogoSrc}
                alt={gosterilenSubeAdi}
                onError={() => setLogoHatali(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="w-5 h-5 text-[#DDAF53]" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-white truncate leading-tight">
              {gosterilenSubeAdi}
            </h1>
            <p className="text-[11px] text-[#A872B5] truncate leading-tight mt-0.5">
              {mobilAltBaslik}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={subeAcikKapaliToggle}
          disabled={durumGuncelleniyor}
          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-60 ${
            subeAcikMi
              ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-300'
              : 'bg-rose-950/70 border-rose-500/80 text-rose-300'
          }`}
          title={subeAcikMi ? 'Şubeyi kapatmak için dokun' : 'Şubeyi açmak için dokun'}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{subeAcikMi ? 'Şube Açık' : 'Şube Kapalı'}</span>
        </button>
      </header>

      {/* Masaüstü Üst Çubuk (Korundu) */}
      <header className="hidden lg:flex bg-[#220E29] border-b border-[#3E1646] px-6 py-3 items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#6D237A] flex items-center justify-center text-[#DDAF53] font-bold text-base shadow-md shrink-0">
            ŞM
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm text-white truncate">
              {gosterilenSubeAdi}
            </h1>
            <p className="text-xs text-[#A872B5] truncate">
              Şube Müdürü: <strong className="text-white">{aktifKullanici?.ad_soyad}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <SubeZilButonu />
          <button
            type="button"
            onClick={cikisYap}
            className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold border border-rose-500/50 transition-colors cursor-pointer flex items-center gap-1"
            title="Güvenli Çıkış Yap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıkış</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-3.5 sm:p-5 lg:p-6 pb-24 lg:pb-6 max-w-7xl mx-auto w-full space-y-4 lg:space-y-6">
        {!subeAcikMi && (
          <div className="lg:hidden px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Şu an müşteri siparişine kapalı</span>
          </div>
        )}

        {/* Masaüstü Şube Kartı (Korundu + Saat/Durum Yönetimi Eklendi) */}
        <div className="hidden lg:block">
          {aktifSube ? (
            <SubeBilgiKarti
              sube={aktifSube}
              onCanliYayinToggle={canliYayinToggle}
              onDurumDegistir={subeDurumDegistir}
              onSaatleriKaydet={subeSaatleriKaydet}
              onKapakGuncelle={async (yeniUrl) => {
                await subeGuncelle(atananSubeId, { gorsel: yeniUrl });
              }}
            />
          ) : (
            <div className="bg-[#220E29] border border-[#521E5C] rounded-2xl p-4 text-xs text-stone-300 flex items-center gap-2.5">
              <Store className="w-4 h-4 text-[#DDAF53] shrink-0" />
              <span>
                Atanmış Şube: <strong className="text-white">{gosterilenSubeAdi}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Masaüstü Sekme Çubuğu (Korundu) */}
        <div className="hidden lg:flex items-center gap-2 p-1.5 bg-[#220E29] border border-[#521E5C] rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setAktifSekme('tedarik_kazanc')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-center ${
              masaustuSekmesi === 'tedarik_kazanc'
                ? 'bg-[#6D237A] text-white shadow-md border border-[#9633A7]'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#DDAF53]" />
            <span>Kazanç & Tedarik</span>
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('stoklar')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-center ${
              masaustuSekmesi === 'stoklar'
                ? 'bg-[#6D237A] text-white shadow-md border border-[#9633A7]'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 text-[#DDAF53]" />
            <span>Tezgah Stokları</span>
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('siparisler')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-center ${
              masaustuSekmesi === 'siparisler'
                ? 'bg-[#6D237A] text-white shadow-md border border-[#9633A7]'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#DDAF53]" />
            <span>
              Siparişler {siparisler.length > 0 && `(${siparisler.length})`}
            </span>
          </button>
        </div>

        {/* Mobil & Tablet "Şubem" Sekmesi İçeriği */}
        {aktifSekme === 'subem' && (
          <div className="lg:hidden space-y-3.5">
            {aktifSube ? (
              <SubeBilgiKarti
                sube={aktifSube}
                onCanliYayinToggle={canliYayinToggle}
                onDurumDegistir={subeDurumDegistir}
                onSaatleriKaydet={subeSaatleriKaydet}
                onKapakGuncelle={async (yeniUrl) => {
                  await subeGuncelle(atananSubeId, { gorsel: yeniUrl });
                }}
              />
            ) : (
              <div className="bg-[#220E29] border border-[#521E5C] rounded-2xl p-4 text-xs text-stone-300 flex items-center gap-2.5">
                <Store className="w-4 h-4 text-[#DDAF53] shrink-0" />
                <span>
                  Atanmış Şube: <strong className="text-white">{gosterilenSubeAdi}</strong>
                </span>
              </div>
            )}

            <div className="bg-[#220E29] border border-[#521E5C] rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#DDAF53]" />
                  <h3 className="text-sm font-bold text-white">Sipariş Sireni & Bildirim</h3>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    subeAcikMi
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {subeAcikMi ? 'Şube Açık' : 'Şu an müşteri siparişine kapalı'}
                </span>
              </div>
              <SubeZilButonu tamGenislik />
            </div>

            <div className="bg-[#220E29] border border-[#521E5C] rounded-2xl p-4 space-y-3 shadow-xl">
              <div>
                <p className="text-[11px] text-[#A872B5]">Aktif Şube Müdürü</p>
                <p className="text-sm font-bold text-white mt-0.5">{aktifKullanici?.ad_soyad}</p>
                {aktifKullanici?.telefon && (
                  <p className="text-xs text-stone-400 tabular-nums mt-0.5">
                    {aktifKullanici.telefon}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={cikisYap}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-sm font-bold border border-rose-500/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Güvenli Çıkış Yap</span>
              </button>
            </div>
          </div>
        )}

        {/* Ortak Sekme İçerikleri (Mobilde aktifSekme, Masaüstünde masaustuSekmesi) */}
        <div className={aktifSekme === 'subem' ? 'hidden lg:block' : 'block'}>
          {(aktifSekme === 'tedarik_kazanc' ||
            (aktifSekme === 'subem' && masaustuSekmesi === 'tedarik_kazanc')) && (
            <SubeTedarikVeKazanc
              subeId={atananSubeId}
              subeAdi={gosterilenSubeAdi}
              urunler={urunler}
              siparisler={siparisler}
              onYenile={() => {}}
            />
          )}

          {aktifSekme === 'stoklar' && (
            <SubeStokYonetimi subeId={atananSubeId} urunler={urunler} onStokGuncellendi={() => {}} />
          )}

          {(aktifSekme === 'siparisler' || aktifSekme === 'subem') && (
            <SubeSiparisYonetimi subeId={atananSubeId} />
          )}
        </div>
      </main>

      {/* Mobil & Tablet (APK) Sabit Alt Menü */}
      <nav
        aria-label="Şube mobil gezinme"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#220E29]/95 backdrop-blur-md border-t border-[#3E1646] px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
      >
        <div className="grid grid-cols-4 gap-1 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => setAktifSekme('siparisler')}
            className={`relative min-h-[52px] px-1 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              aktifSekme === 'siparisler'
                ? 'bg-[#6D237A] text-white shadow-md shadow-[#6D237A]/30'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-tight leading-none">Siparişler</span>
            {aktifSiparisSayisi > 0 && (
              <span className="absolute top-1 right-3 sm:right-6 min-w-[18px] h-[18px] px-1 rounded-full bg-[#7C2D8C] border border-[#DDAF53]/60 text-white text-[10px] font-bold tabular-nums flex items-center justify-center shadow">
                {aktifSiparisSayisi}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('stoklar')}
            className={`min-h-[52px] px-1 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              aktifSekme === 'stoklar'
                ? 'bg-[#6D237A] text-white shadow-md shadow-[#6D237A]/30'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-tight leading-none">Stoklar</span>
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('tedarik_kazanc')}
            className={`min-h-[52px] px-1 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              aktifSekme === 'tedarik_kazanc'
                ? 'bg-[#6D237A] text-white shadow-md shadow-[#6D237A]/30'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-tight leading-none">Kazanç</span>
          </button>

          <button
            type="button"
            onClick={() => setAktifSekme('subem')}
            className={`min-h-[52px] px-1 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              aktifSekme === 'subem'
                ? 'bg-[#6D237A] text-white shadow-md shadow-[#6D237A]/30'
                : 'text-[#A872B5] hover:text-white'
            }`}
          >
            <Store className="w-5 h-5" />
            <span className="text-[11px] font-bold tracking-tight leading-none">Şubem</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
