const ZIL_AYAR_ANAHTARI = 'afyon_sube_zil_aktif';
let sesMotoru: AudioContext | null = null;
let sirenAraligi: ReturnType<typeof setInterval> | null = null;
let sirenCaliyor = false;
let aktifKazanc: GainNode | null = null;
let aktifOsilatorler: OscillatorNode[] = [];
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

/**
 * 🚨 Tek bir nükleer siren dalgası çalar (~2.0 saniye).
 */
function tekDalgaCal(): void {
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

    // 1. Dalga: 450Hz -> 920Hz -> 520Hz -> 960Hz -> 400Hz (Klasik Nükleer Siren Yükselişi)
    o1.frequency.setValueAtTime(450, t);
    o1.frequency.linearRampToValueAtTime(920, t + 0.45);
    o1.frequency.linearRampToValueAtTime(520, t + 0.95);
    o1.frequency.linearRampToValueAtTime(960, t + 1.45);
    o1.frequency.linearRampToValueAtTime(400, t + 1.95);

    // 2. Osilatör (+8Hz akort kaymasıyla rahatsız edici çift mekanik korna uğultusu)
    o2.frequency.setValueAtTime(458, t);
    o2.frequency.linearRampToValueAtTime(928, t + 0.45);
    o2.frequency.linearRampToValueAtTime(528, t + 0.95);
    o2.frequency.linearRampToValueAtTime(968, t + 1.45);
    o2.frequency.linearRampToValueAtTime(408, t + 1.95);

    kazanc.gain.setValueAtTime(0.01, t);
    kazanc.gain.linearRampToValueAtTime(0.35, t + 0.1);
    kazanc.gain.setValueAtTime(0.35, t + 1.6);
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

/**
 * 🚨 Şube sipariş sirenini başlatır ve susturulana kadar döngüde kesintisiz çalar.
 */
export function subeSireniniBaslat(): void {
  if (!subeZilAktifMi()) return;
  if (sirenCaliyor) return;

  sirenCaliyor = true;
  dinleyicileriBilgilendir();

  tekDalgaCal();

  sirenAraligi = setInterval(() => {
    tekDalgaCal();
  }, 2200);
}

/**
 * 🔕 Çalan sireni anında susturur ve döngüyü sonlandırır.
 */
export function subeSireniniDurdur(): void {
  if (sirenAraligi) {
    clearInterval(sirenAraligi);
    sirenAraligi = null;
  }

  if (aktifKazanc && sesMotoru) {
    try {
      aktifKazanc.gain.cancelScheduledValues(sesMotoru.currentTime);
      aktifKazanc.gain.setValueAtTime(0.0001, sesMotoru.currentTime);
    } catch {}
  }

  for (const osc of aktifOsilatorler) {
    try {
      osc.stop();
    } catch {}
  }
  aktifOsilatorler = [];
  aktifKazanc = null;

  if (sirenCaliyor) {
    sirenCaliyor = false;
    dinleyicileriBilgilendir();
  }
}

/**
 * Geriye dönük uyumluluk: Tek atımlık çağrılarda da susturulana kadar sürekli çalar.
 */
export function subeSiparisZiliCal(): void {
  subeSireniniBaslat();
}
