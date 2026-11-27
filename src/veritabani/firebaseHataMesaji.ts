export class AlanHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'AlanHatasi';
  }
}

export function firebaseYetkiHatasiMi(hata: unknown): boolean {
  if (!hata) return false;
  const kod = String((hata as { code?: unknown })?.code || '').toLowerCase();
  const mesaj = (hata instanceof Error ? hata.message : String(hata)).toLowerCase();
  return (
    kod.includes('permission-denied') ||
    mesaj.includes('missing or insufficient permissions') ||
    mesaj.includes('permission-denied') ||
    mesaj.includes('insufficient permissions')
  );
}

export function firebaseHatasiniTurkcelestir(
  hata: unknown,
  varsayilanMesaj = 'İşlem sırasında beklenmeyen bir veritabanı hatası oluştu.'
): string {
  if (!hata) return varsayilanMesaj;
  if (hata instanceof AlanHatasi) {
    return hata.message;
  }

  const kod = String((hata as { code?: unknown })?.code || '').toLowerCase();
  const mesaj = (hata instanceof Error ? hata.message : String(hata)).trim();
  const kucuk = mesaj.toLowerCase();

  if (firebaseYetkiHatasiMi(hata)) {
    return 'Veritabanı erişim yetkisi bulunamadı veya güvenlik kuralları bu işlemi engelledi.';
  }
  if (
    kod.includes('unavailable') ||
    kucuk.includes('client is offline') ||
    kucuk.includes('failed to fetch') ||
    kucuk.includes('network')
  ) {
    return 'İnternet veya veritabanı bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.';
  }
  if (kod.includes('not-found') || kucuk.includes('no document to update')) {
    return 'İlgili veritabanı kaydı bulunamadı.';
  }
  if (kod.includes('aborted') || kucuk.includes('contention')) {
    return 'Eşzamanlı işlem çakışması oluştu. Lütfen tekrar deneyin.';
  }
  if (kod.includes('deadline-exceeded') || kucuk.includes('timeout')) {
    return 'Sunucu yanıt süresi doldu. Lütfen tekrar deneyin.';
  }

  return varsayilanMesaj;
}
