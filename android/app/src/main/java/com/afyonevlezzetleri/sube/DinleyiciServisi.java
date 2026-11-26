package com.afyonevlezzetleri.sube;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class DinleyiciServisi extends Service {

    public static final String TERCIH_ADI = "afyon_sube_tercihleri";
    public static final String ANAHTAR_KULLANICI_ID = "kullanici_id";
    public static final String ANAHTAR_AD_SOYAD = "ad_soyad";
    public static final String ANAHTAR_ROL = "rol";
    public static final String ANAHTAR_SUBE_ID = "sube_id";
    public static final String ANAHTAR_FIREBASE_BELIRTEC = "firebase_belirtec";
    public static final String ANAHTAR_UYGULAMA_ON_PLANDA = "uygulamaOnPlanda";
    public static final String ANAHTAR_SECILI_ZIL = "secili_zil_kimlik";
    public static final String ANAHTAR_ZIL_SES_SEVIYESI = "zil_ses_seviyesi";
    public static final String ANAHTAR_OZEL_ZIL_MEVCUT = "ozel_zil_mevcut";
    public static final String OZEL_ZIL_DOSYA_ADI = "ozel_zil_sesi.audio";

    public static final String EYLEM_BASLAT = "com.afyonevlezzetleri.sube.eylem.BASLAT";
    public static final String EYLEM_DURDUR = "com.afyonevlezzetleri.sube.eylem.DURDUR";
    public static final String EYLEM_ZIL_CAL = "com.afyonevlezzetleri.sube.eylem.ZIL_CAL";
    public static final String EYLEM_ZIL_SUSTUR = "com.afyonevlezzetleri.sube.eylem.ZIL_SUSTUR";

    public static final String EKSTRA_BASLIK = "baslik";
    public static final String EKSTRA_DETAY = "detay";
    public static final String EKSTRA_KESINTISIZ = "kesintisiz";
    public static final String EKSTRA_SURE_SN = "sure_sn";

    private static final String KANAL_SERVIS_ID = "afyon_sube_servis_kanali";
    private static final String KANAL_ALARM_ID = "afyon_sube_acil_alarm_kanali";
    private static final int SERVIS_BILDIRIM_ID = 2001;
    private static final int ALARM_BILDIRIM_ID = 2002;

    private static final String FIRESTORE_SORGU_URL =
            "https://firestore.googleapis.com/v1/projects/tfy-smart-fishing-511521/databases/"
                    + "ai-studio-afyonevlezzetler-373e291d-b34e-4126-ac5e-613533550d71/documents:runQuery";

    private ScheduledExecutorService zamanlayici;
    private final Map<String, String> bilinenSiparisDurumlari = new HashMap<>();
    private boolean ilkTaramaTamam = false;
    private String aktifDinlenenSubeId = "";

    private MediaPlayer zilCalar;
    private Vibrator titresimMotoru;
    private PowerManager.WakeLock uyanikTutucu;
    private final Handler anaIsParcacigi = new Handler(Looper.getMainLooper());
    private Runnable otomatikSusturmaGorevi;

    @Override
    public void onCreate() {
        super.onCreate();
        bildirimKanallariniOlustur();
        onPlanServisiniBaslat();
    }

    @Override
    public int onStartCommand(Intent niyet, int bayraklar, int baslatmaId) {
        onPlanServisiniBaslat();

        String eylem = (niyet != null && niyet.getAction() != null) ? niyet.getAction() : EYLEM_BASLAT;

        if (EYLEM_DURDUR.equals(eylem)) {
            alarmiSustur();
            zamanlayiciyiDurdur();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (EYLEM_ZIL_SUSTUR.equals(eylem)) {
            alarmiSustur();
            return START_STICKY;
        }

        if (EYLEM_ZIL_CAL.equals(eylem) && niyet != null) {
            String baslik = niyet.getStringExtra(EKSTRA_BASLIK);
            String detay = niyet.getStringExtra(EKSTRA_DETAY);
            boolean kesintisiz = niyet.getBooleanExtra(EKSTRA_KESINTISIZ, true);
            int sureSn = niyet.getIntExtra(EKSTRA_SURE_SN, 0);
            alarmCalVeBildir(
                    baslik != null && !baslik.isEmpty() ? baslik : "Afyon Şube Alarmı",
                    detay != null ? detay : "Yeni şube siparişi bildirimi.",
                    kesintisiz,
                    sureSn
            );
            return START_STICKY;
        }

        SharedPreferences tercihler = getSharedPreferences(TERCIH_ADI, MODE_PRIVATE);
        String subeId = tercihler.getString(ANAHTAR_SUBE_ID, "").trim();
        if (subeId.isEmpty()) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!subeId.equals(aktifDinlenenSubeId)) {
            aktifDinlenenSubeId = subeId;
            bilinenSiparisDurumlari.clear();
            ilkTaramaTamam = false;
        }

        sorguDongusunuBaslat();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        alarmiSustur();
        zamanlayiciyiDurdur();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent niyet) {
        return null;
    }

    private void bildirimKanallariniOlustur() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager yonetici = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (yonetici == null) {
            return;
        }

        NotificationChannel servisKanali = new NotificationChannel(
                KANAL_SERVIS_ID,
                "Afyon Şube Arka Plan Dinleyicisi",
                NotificationManager.IMPORTANCE_LOW
        );
        servisKanali.setDescription("Şube siparişlerini arka planda kesintisiz dinler.");
        servisKanali.setSound(null, null);
        yonetici.createNotificationChannel(servisKanali);

        NotificationChannel alarmKanali = new NotificationChannel(
                KANAL_ALARM_ID,
                "Afyon Şube Kritik Sipariş Alarmı",
                NotificationManager.IMPORTANCE_HIGH
        );
        alarmKanali.setDescription("Yeni sipariş ve iptallerde tam ekran acil uyarı gösterir.");
        alarmKanali.enableVibration(true);
        alarmKanali.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alarmKanali.setSound(null, null);
        yonetici.createNotificationChannel(alarmKanali);
    }

    private void onPlanServisiniBaslat() {
        Intent anaEkranNiyeti = new Intent(this, MainActivity.class);
        anaEkranNiyeti.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent icerikNiyeti = PendingIntent.getActivity(
                this,
                101,
                anaEkranNiyeti,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder kurucu = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, KANAL_SERVIS_ID)
                : new Notification.Builder(this);

        kurucu.setContentTitle(getString(R.string.servis_baslik))
                .setContentText(getString(R.string.servis_detay))
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentIntent(icerikNiyeti)
                .setOngoing(true);

        Notification bildirim = kurucu.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    SERVIS_BILDIRIM_ID,
                    bildirim,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            );
        } else {
            startForeground(SERVIS_BILDIRIM_ID, bildirim);
        }
    }

    private void sorguDongusunuBaslat() {
        if (zamanlayici != null && !zamanlayici.isShutdown()) {
            return;
        }
        zamanlayici = Executors.newSingleThreadScheduledExecutor();
        zamanlayici.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                firestoreSiparisleriniTara();
            }
        }, 0, 6, TimeUnit.SECONDS);
    }

    private void zamanlayiciyiDurdur() {
        if (zamanlayici != null) {
            zamanlayici.shutdownNow();
            zamanlayici = null;
        }
    }

    private void firestoreSiparisleriniTara() {
        SharedPreferences tercihler = getSharedPreferences(TERCIH_ADI, MODE_PRIVATE);
        String subeId = tercihler.getString(ANAHTAR_SUBE_ID, "").trim();
        if (subeId.isEmpty()) {
            return;
        }
        String firebaseBelirtec = tercihler.getString(ANAHTAR_FIREBASE_BELIRTEC, "").trim();

        HttpURLConnection baglanti = null;
        try {
            JSONObject sorguGovdesi = new JSONObject();
            JSONObject yapilandirilmis = new JSONObject();
            JSONArray kaynakDizi = new JSONArray();
            kaynakDizi.put(new JSONObject().put("collectionId", "sube_siparisleri"));
            yapilandirilmis.put("from", kaynakDizi);

            JSONObject alanFiltre = new JSONObject();
            alanFiltre.put("field", new JSONObject().put("fieldPath", "sube_id"));
            alanFiltre.put("op", "EQUAL");
            alanFiltre.put("value", new JSONObject().put("stringValue", subeId));

            JSONObject filtre = new JSONObject();
            filtre.put("fieldFilter", alanFiltre);
            yapilandirilmis.put("where", filtre);
            sorguGovdesi.put("structuredQuery", yapilandirilmis);

            URL adres = new URL(FIRESTORE_SORGU_URL);
            baglanti = (HttpURLConnection) adres.openConnection();
            baglanti.setRequestMethod("POST");
            baglanti.setConnectTimeout(7000);
            baglanti.setReadTimeout(7000);
            baglanti.setDoOutput(true);
            baglanti.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (!firebaseBelirtec.isEmpty()) {
                baglanti.setRequestProperty("Authorization", "Bearer " + firebaseBelirtec);
            }

            byte[] gonderilenBaytlar = sorguGovdesi.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream cikis = baglanti.getOutputStream()) {
                cikis.write(gonderilenBaytlar);
            }

            int durumKodu = baglanti.getResponseCode();
            if (durumKodu < 200 || durumKodu >= 300) {
                return;
            }

            StringBuilder yanitTamponu = new StringBuilder();
            try (BufferedReader okuyucu = new BufferedReader(
                    new InputStreamReader(baglanti.getInputStream(), StandardCharsets.UTF_8))) {
                String satir;
                while ((satir = okuyucu.readLine()) != null) {
                    yanitTamponu.append(satir);
                }
            }

            JSONArray sonuclar = new JSONArray(yanitTamponu.toString());
            Map<String, String> guncelHarita = new HashMap<>();
            String kritikBaslik = null;
            String kritikDetay = null;

            for (int i = 0; i < sonuclar.length(); i++) {
                JSONObject oge = sonuclar.optJSONObject(i);
                if (oge == null || !oge.has("document")) {
                    continue;
                }
                JSONObject belge = oge.optJSONObject("document");
                if (belge == null) {
                    continue;
                }
                String belgeAdi = belge.optString("name", "");
                JSONObject alanlar = belge.optJSONObject("fields");
                if (belgeAdi.isEmpty() || alanlar == null) {
                    continue;
                }

                String durum = metinAlaniOku(alanlar, "durum", "hazirlaniyor");
                String siparisKodu = metinAlaniOku(alanlar, "siparis_kodu", "Yeni");
                String musteriAdi = metinAlaniOku(alanlar, "musteri_adi", "Müşteri");
                String tutarMetni = tutarAlaniOku(alanlar, "toplam_tutar");

                guncelHarita.put(belgeAdi, durum);

                if (ilkTaramaTamam) {
                    String oncekiDurum = bilinenSiparisDurumlari.get(belgeAdi);
                    if (oncekiDurum == null) {
                        if (!"teslim_edildi".equals(durum) && !"iptal".equals(durum)) {
                            kritikBaslik = "Yeni Şube Siparişi! (#" + siparisKodu + ")";
                            kritikDetay = musteriAdi + (tutarMetni.isEmpty() ? "" : " • " + tutarMetni + " TL");
                        }
                    } else if (!"iptal".equals(oncekiDurum) && "iptal".equals(durum)) {
                        kritikBaslik = "Sipariş İptal Edildi! (#" + siparisKodu + ")";
                        kritikDetay = musteriAdi + " siparişi iptal statüsüne geçti.";
                    }
                }
            }

            bilinenSiparisDurumlari.clear();
            bilinenSiparisDurumlari.putAll(guncelHarita);

            if (!ilkTaramaTamam) {
                ilkTaramaTamam = true;
                return;
            }

            if (kritikBaslik != null) {
                boolean onPlanda = tercihler.getBoolean(ANAHTAR_UYGULAMA_ON_PLANDA, false);
                PowerManager gucYoneticisi = (PowerManager) getSystemService(Context.POWER_SERVICE);
                boolean ekranAcik = gucYoneticisi != null && gucYoneticisi.isInteractive();

                if (!(onPlanda && ekranAcik)) {
                    final String baslikKopya = kritikBaslik;
                    final String detayKopya = kritikDetay;
                    anaIsParcacigi.post(new Runnable() {
                        @Override
                        public void run() {
                            alarmCalVeBildir(baslikKopya, detayKopya, true, 0);
                        }
                    });
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (baglanti != null) {
                baglanti.disconnect();
            }
        }
    }

    private String metinAlaniOku(JSONObject alanlar, String anahtar, String varsayilan) {
        JSONObject alanObjesi = alanlar.optJSONObject(anahtar);
        if (alanObjesi == null) {
            return varsayilan;
        }
        String deger = alanObjesi.optString("stringValue", "");
        return deger.isEmpty() ? varsayilan : deger;
    }

    private String tutarAlaniOku(JSONObject alanlar, String anahtar) {
        JSONObject alanObjesi = alanlar.optJSONObject(anahtar);
        if (alanObjesi == null) {
            return "";
        }
        if (alanObjesi.has("doubleValue")) {
            return String.format(java.util.Locale.US, "%.2f", alanObjesi.optDouble("doubleValue", 0.0));
        }
        if (alanObjesi.has("integerValue")) {
            return alanObjesi.optString("integerValue", "");
        }
        return "";
    }

    private synchronized void alarmCalVeBildir(
            String baslik,
            String detay,
            boolean kesintisiz,
            int sureSn
    ) {
        alarmiSustur();
        uyanikTutucuAl();

        SharedPreferences tercihler = getSharedPreferences(TERCIH_ADI, MODE_PRIVATE);
        String seciliKimlik = tercihler.getString(ANAHTAR_SECILI_ZIL, "nukleer_siren");
        float sesSeviyesi = tercihler.getFloat(ANAHTAR_ZIL_SES_SEVIYESI, 0.95f);
        sesSeviyesi = Math.max(0.2f, Math.min(1.0f, sesSeviyesi));

        acilBildirimGoster(baslik, detay);
        titresimiBaslat();
        sesCalmayiBaslat(seciliKimlik, sesSeviyesi, kesintisiz);

        if (!kesintisiz || sureSn > 0) {
            int beklemeMs = (sureSn > 0 ? sureSn : 15) * 1000;
            otomatikSusturmaGorevi = new Runnable() {
                @Override
                public void run() {
                    alarmiSustur();
                }
            };
            anaIsParcacigi.postDelayed(otomatikSusturmaGorevi, beklemeMs);
        }
    }

    private void sesCalmayiBaslat(String seciliKimlik, float sesSeviyesi, boolean kesintisiz) {
        try {
            zilCalar = new MediaPlayer();
            AudioAttributes nitelikler = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            zilCalar.setAudioAttributes(nitelikler);

            File ozelDosya = new File(getFilesDir(), OZEL_ZIL_DOSYA_ADI);
            if ("ozel_ses".equals(seciliKimlik) && ozelDosya.exists() && ozelDosya.length() > 64) {
                zilCalar.setDataSource(ozelDosya.getAbsolutePath());
                zilCalar.prepare();
            } else {
                int hamKaynakId = getResources().getIdentifier(seciliKimlik, "raw", getPackageName());
                if (hamKaynakId == 0) {
                    hamKaynakId = R.raw.nukleer_siren;
                }
                android.content.res.AssetFileDescriptor afd = getResources().openRawResourceFd(hamKaynakId);
                if (afd == null) {
                    return;
                }
                zilCalar.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                afd.close();
                zilCalar.prepare();
            }

            zilCalar.setLooping(kesintisiz);
            zilCalar.setVolume(sesSeviyesi, sesSeviyesi);
            zilCalar.start();
        } catch (Exception hata) {
            try {
                if (zilCalar != null) {
                    zilCalar.release();
                    zilCalar = null;
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void titresimiBaslat() {
        try {
            titresimMotoru = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (titresimMotoru == null || !titresimMotoru.hasVibrator()) {
                return;
            }
            long[] desen = new long[]{0, 600, 300, 600, 300};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                titresimMotoru.vibrate(VibrationEffect.createWaveform(desen, 0));
            } else {
                titresimMotoru.vibrate(desen, 0);
            }
        } catch (Exception ignored) {
        }
    }

    private void uyanikTutucuAl() {
        try {
            PowerManager gucYoneticisi = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (gucYoneticisi == null) {
                return;
            }
            if (uyanikTutucu == null) {
                uyanikTutucu = gucYoneticisi.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "AfyonSube:AcilAlarmKilidi"
                );
            }
            if (!uyanikTutucu.isHeld()) {
                uyanikTutucu.acquire(180000L);
            }
        } catch (Exception ignored) {
        }
    }

    private void acilBildirimGoster(String baslik, String detay) {
        NotificationManager yonetici = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (yonetici == null) {
            return;
        }

        Intent tamEkranNiyeti = new Intent(this, MainActivity.class);
        tamEkranNiyeti.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tamEkranBekleyen = PendingIntent.getActivity(
                this,
                202,
                tamEkranNiyeti,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent susturNiyeti = new Intent(this, DinleyiciServisi.class);
        susturNiyeti.setAction(EYLEM_ZIL_SUSTUR);
        PendingIntent susturBekleyen = PendingIntent.getService(
                this,
                203,
                susturNiyeti,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder kurucu = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(this, KANAL_ALARM_ID)
                : new Notification.Builder(this);

        kurucu.setContentTitle(baslik)
                .setContentText(detay)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(tamEkranBekleyen)
                .setFullScreenIntent(tamEkranBekleyen, true)
                .addAction(android.R.drawable.ic_lock_silent_mode, "SİRENİ SUSTUR", susturBekleyen);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            kurucu.setPriority(Notification.PRIORITY_MAX);
        }

        yonetici.notify(ALARM_BILDIRIM_ID, kurucu.build());
    }

    public synchronized void alarmiSustur() {
        if (otomatikSusturmaGorevi != null) {
            anaIsParcacigi.removeCallbacks(otomatikSusturmaGorevi);
            otomatikSusturmaGorevi = null;
        }
        if (zilCalar != null) {
            try {
                if (zilCalar.isPlaying()) {
                    zilCalar.stop();
                }
            } catch (Exception ignored) {
            }
            try {
                zilCalar.release();
            } catch (Exception ignored) {
            }
            zilCalar = null;
        }
        if (titresimMotoru != null) {
            try {
                titresimMotoru.cancel();
            } catch (Exception ignored) {
            }
        }
        if (uyanikTutucu != null && uyanikTutucu.isHeld()) {
            try {
                uyanikTutucu.release();
            } catch (Exception ignored) {
            }
        }
        NotificationManager yonetici = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (yonetici != null) {
            yonetici.cancel(ALARM_BILDIRIM_ID);
        }
    }
}
