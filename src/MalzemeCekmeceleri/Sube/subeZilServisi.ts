import {
  HAZIR_ZIL_SESLERI,
  SeciliZilKimligi,
  androidZilSustur,
  sesSeviyesiniSinirla,
  zilAyarlariniOku,
} from '@/src/MalzemeCekmeceleri/Mobil/AndroidKopruServisi';

const ZIL_AYAR_ANAHTARI = 'afyon_sube_zil_aktif';
let sesMotoru: AudioContext | null = null;
let sirenAraligi: ReturnType<typeof setInterval> | null = null;
let sirenCaliyor = false;
let aktifKazanc: GainNode | null = null;
let aktifOsilatorler: OscillatorNode[] = [];
let aktifSesOgesi: HTMLAudioElement | null = null;
let onizlemeSesOgesi: HTMLAudioElement | null = null;
const dinleyiciler = new Set<(caliyor: boolean) => void>();

function sesMotorunuAl(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sesMotoru) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) sesMotoru = new Ctx();
  }
  if (sesMotoru && sesMotoru.state === 'suspended') {
    sesMotoru.resume().catch(() => {});
  }
  return sesMotoru;
}

if (typeof window !== 'undefined') {
  const kilidiAc = () => {
    sesMotorunuAl();
    window.removeEventListener('click', kilidiAc);
    window.removeEventListener('touchstart', kilidiAc);
  };
  window.addEventListener('click', kilidiAc, { once: true });
  window.addEventListener('touchstart', kilidiAc, { once: true });
  window.addEventListener('afyon-android-sustur', () => {
    subeSireniniDurdur();
  });
}

function dinleyicileriBilgilendir(): void {
  for (const fn of dinleyiciler) {
    try {
      fn(sirenCaliyor);
    } catch {
      // Dinleyici hatası servisi kırmasın
    }
  }
}

function zilKaynagiCoz(kimlik: SeciliZilKimligi, ozelSesVeriUrl?: string): string {
  if (kimlik === 'ozel_ses' && ozelSesVeriUrl) {
    return ozelSesVeriUrl;
  }
  const hazir = HAZIR_ZIL_SESLERI.find((z) => z.kimlik === kimlik);
  return hazir ? hazir.dosyaYolu : '/sesler/nukleer_siren.wav';
}

export function subeSireniCaliyorMu(): boolean {
  return sirenCaliyor;
}

export function subeSirenDinle(geriCagirim: (caliyor: boolean) => void): () => void {
  dinleyiciler.add(geriCagirim);
  geriCagirim(sirenCaliyor);
  return () => {
    dinleyiciler.delete(geriCagirim);
  };
}

export function subeZilAktifMi(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(ZIL_AYAR_ANAHTARI) !== 'kapali';
}

export function subeZilAyariniDegistir(aktif: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ZIL_AYAR_ANAHTARI, aktif ? 'acik' : 'kapali');
  if (!aktif) {
    subeSireniniDurdur();
  }
}

function tekDalgaYedekCal(sesSeviyesi: number): void {
  if (!subeZilAktifMi()) {
    subeSireniniDurdur();
    return;
  }
  const ctx = sesMotorunuAl();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const kazanc = ctx.createGain();

    aktifKazanc = kazanc;
    aktifOsilatorler = [o1, o2];

    o1.type = 'sawtooth';
    o2.type = 'sawtooth';

    o1.frequency.setValueAtTime(450, t);
    o1.frequency.linearRampToValueAtTime(920, t + 0.45);
    o1.frequency.linearRampToValueAtTime(520, t + 0.95);
    o1.frequency.linearRampToValueAtTime(960, t + 1.45);
    o1.frequency.linearRampToValueAtTime(400, t + 1.95);

    o2.frequency.setValueAtTime(458, t);
    o2.frequency.linearRampToValueAtTime(928, t + 0.45);
    o2.frequency.linearRampToValueAtTime(528, t + 0.95);
    o2.frequency.linearRampToValueAtTime(968, t + 1.45);
    o2.frequency.linearRampToValueAtTime(408, t + 1.95);

    const tepe = Math.max(0.08, Math.min(0.6, sesSeviyesi * 0.45));
    kazanc.gain.setValueAtTime(0.01, t);
    kazanc.gain.linearRampToValueAtTime(tepe, t + 0.1);
    kazanc.gain.setValueAtTime(tepe, t + 1.6);
    kazanc.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    o1.connect(kazanc);
    o2.connect(kazanc);
    kazanc.connect(ctx.destination);

    o1.start(t);
    o2.start(t);
    o1.stop(t + 2.0);
    o2.stop(t + 2.0);
  } catch (err) {
    console.warn('Siren dalgası çalınamadı:', err);
  }
}

export function subeSireniniBaslat(): void {
  if (!subeZilAktifMi()) return;
  if (sirenCaliyor) return;

  sirenCaliyor = true;
  dinleyicileriBilgilendir();

  const ayar = zilAyarlariniOku();
  const sesSeviyesi = sesSeviyesiniSinirla(ayar.sesSeviyesi);
  const kaynak = zilKaynagiCoz(ayar.seciliKimlik, ayar.ozelSesVeriUrl);

  try {
    const sesOgesi = new Audio(kaynak);
    sesOgesi.loop = true;
    sesOgesi.volume = sesSeviyesi;
    aktifSesOgesi = sesOgesi;
    sesOgesi.play().catch(() => {
      aktifSesOgesi = null;
      tekDalgaYedekCal(sesSeviyesi);
      if (!sirenAraligi) {
        sirenAraligi = setInterval(() => {
          tekDalgaYedekCal(sesSeviyesi);
        }, 2200);
      }
    });
  } catch {
    tekDalgaYedekCal(sesSeviyesi);
    sirenAraligi = setInterval(() => {
      tekDalgaYedekCal(sesSeviyesi);
    }, 2200);
  }
}

export function subeSireniniDurdur(): void {
  androidZilSustur();

  if (sirenAraligi) {
    clearInterval(sirenAraligi);
    sirenAraligi = null;
  }

  if (aktifSesOgesi) {
    try {
      aktifSesOgesi.pause();
      aktifSesOgesi.currentTime = 0;
    } catch {
      // Ses durdurma hatasını yoksay
    }
    aktifSesOgesi = null;
  }

  if (aktifKazanc && sesMotoru) {
    try {
      aktifKazanc.gain.cancelScheduledValues(sesMotoru.currentTime);
      aktifKazanc.gain.setValueAtTime(0.0001, sesMotoru.currentTime);
    } catch {
      // Ses motoru hatasını yoksay
    }
  }

  for (const osc of aktifOsilatorler) {
    try {
      osc.stop();
    } catch {
      // Durdurma hatasını yoksay
    }
  }
  aktifOsilatorler = [];
  aktifKazanc = null;

  if (sirenCaliyor) {
    sirenCaliyor = false;
    dinleyicileriBilgilendir();
  }
}

export function subeZilOnizlemeDurdur(): void {
  if (onizlemeSesOgesi) {
    try {
      onizlemeSesOgesi.pause();
      onizlemeSesOgesi.currentTime = 0;
    } catch {
      // Önizleme durdurma hatasını yoksay
    }
    onizlemeSesOgesi = null;
  }
}

export function subeZilOnizlemeCal(
  kimlik: SeciliZilKimligi,
  sesSeviyesi: number,
  ozelSesVeriUrl?: string,
  bittiGeriCagirim?: () => void
): void {
  subeZilOnizlemeDurdur();
  const kaynak = zilKaynagiCoz(kimlik, ozelSesVeriUrl);
  try {
    const ses = new Audio(kaynak);
    ses.loop = false;
    ses.volume = sesSeviyesiniSinirla(sesSeviyesi);
    ses.onended = () => {
      if (onizlemeSesOgesi === ses) {
        onizlemeSesOgesi = null;
      }
      bittiGeriCagirim?.();
    };
    ses.onerror = () => {
      if (onizlemeSesOgesi === ses) {
        onizlemeSesOgesi = null;
      }
      bittiGeriCagirim?.();
    };
    onizlemeSesOgesi = ses;
    ses.play().catch(() => {
      tekDalgaYedekCal(sesSeviyesi);
      bittiGeriCagirim?.();
    });
  } catch {
    tekDalgaYedekCal(sesSeviyesi);
    bittiGeriCagirim?.();
  }
}

export function subeSiparisZiliCal(): void {
  subeSireniniBaslat();
}
