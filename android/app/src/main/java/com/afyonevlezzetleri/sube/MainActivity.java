package com.afyonevlezzetleri.sube;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {

    private static final String SANAL_KONAK = "appassets.androidplatform.net";
    private static final String BASLANGIC_ADRESI = "https://appassets.androidplatform.net/index.html";
    private static final int BILDIRIM_IZIN_KODU = 3101;
    private static final int AZAMI_OZEL_SES_BAYT = 3500000;

    private WebView webTarayici;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle kayitliDurum) {
        super.onCreate(kayitliDurum);

        kilitEkraniBayraklariniAyarla();
        bildirimIzniniIste();

        webTarayici = new WebView(this);
        webTarayici.setBackgroundColor(0xFF180A1F);
        setContentView(webTarayici);

        WebSettings ayarlar = webTarayici.getSettings();
        ayarlar.setJavaScriptEnabled(true);
        ayarlar.setDomStorageEnabled(true);
        ayarlar.setDatabaseEnabled(true);
        ayarlar.setMediaPlaybackRequiresUserGesture(false);
        ayarlar.setAllowFileAccess(false);
        ayarlar.setAllowContentAccess(false);
        ayarlar.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webTarayici.setWebChromeClient(new WebChromeClient());
        webTarayici.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView gorunum, WebResourceRequest istek) {
                Uri uri = istek.getUrl();
                if (uri != null && SANAL_KONAK.equalsIgnoreCase(uri.getHost())) {
                    return yerliVarlikYanitiUret(uri.getPath());
                }
                return super.shouldInterceptRequest(gorunum, istek);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView gorunum, WebResourceRequest istek) {
                Uri uri = istek.getUrl();
                if (uri == null) {
                    return false;
                }
                String konak = uri.getHost();
                if (SANAL_KONAK.equalsIgnoreCase(konak)) {
                    return false;
                }
                String sema = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.US) : "";
                if ("https".equals(sema) || "tel".equals(sema) || "mailto".equals(sema)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return true;
            }
        });

        webTarayici.addJavascriptInterface(new KopruArayuzu(), "AfyonAndroidKopru");
        webTarayici.loadUrl(BASLANGIC_ADRESI);

        oturumVarsaServisiBaslat();
    }

    @Override
    protected void onNewIntent(Intent yeniNiyet) {
        super.onNewIntent(yeniNiyet);
        setIntent(yeniNiyet);
        Intent durdurNiyeti = new Intent(this, DinleyiciServisi.class);
        durdurNiyeti.setAction(DinleyiciServisi.EYLEM_ZIL_SUSTUR);
        startService(durdurNiyeti);
        if (webTarayici != null) {
            webTarayici.post(new Runnable() {
                @Override
                public void run() {
                    webTarayici.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('afyon-android-sustur'));",
                            null
                    );
                }
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        onPlanDurumunuKaydet(true);
        Intent susturNiyeti = new Intent(this, DinleyiciServisi.class);
        susturNiyeti.setAction(DinleyiciServisi.EYLEM_ZIL_SUSTUR);
        try {
            startService(susturNiyeti);
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onPause() {
        onPlanDurumunuKaydet(false);
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webTarayici != null && webTarayici.canGoBack()) {
            webTarayici.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    private void kilitEkraniBayraklariniAyarla() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
    }

    private void bildirimIzniniIste() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, BILDIRIM_IZIN_KODU);
            }
        }
    }

    private void onPlanDurumunuKaydet(boolean onPlanda) {
        SharedPreferences tercihler = getSharedPreferences(DinleyiciServisi.TERCIH_ADI, MODE_PRIVATE);
        tercihler.edit().putBoolean(DinleyiciServisi.ANAHTAR_UYGULAMA_ON_PLANDA, onPlanda).apply();
    }

    private void oturumVarsaServisiBaslat() {
        SharedPreferences tercihler = getSharedPreferences(DinleyiciServisi.TERCIH_ADI, MODE_PRIVATE);
        String subeId = tercihler.getString(DinleyiciServisi.ANAHTAR_SUBE_ID, "").trim();
        if (!subeId.isEmpty()) {
            servisBaslatVeyaGuncelle();
        }
    }

    private void servisBaslatVeyaGuncelle() {
        Intent servisNiyeti = new Intent(this, DinleyiciServisi.class);
        servisNiyeti.setAction(DinleyiciServisi.EYLEM_BASLAT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(servisNiyeti);
        } else {
            startService(servisNiyeti);
        }
    }

    private WebResourceResponse yerliVarlikYanitiUret(String hamYol) {
        String yol = (hamYol == null) ? "" : hamYol.replaceFirst("^/+", "");
        if (yol.contains("..") || yol.contains("\\") || yol.contains("\0")) {
            return new WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    403,
                    "Yasak",
                    null,
                    new ByteArrayInputStream("Yasakli yol".getBytes(StandardCharsets.UTF_8))
            );
        }
        if (yol.isEmpty()) {
            yol = "index.html";
        }

        try {
            InputStream akis;
            String gercekYol = yol;
            try {
                akis = getAssets().open("www/" + gercekYol);
            } catch (Exception bulunamadi) {
                if (!gercekYol.contains(".")) {
                    gercekYol = "index.html";
                    akis = getAssets().open("www/" + gercekYol);
                } else {
                    return new WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            404,
                            "Bulunamadi",
                            null,
                            new ByteArrayInputStream("Bulunamadi".getBytes(StandardCharsets.UTF_8))
                    );
                }
            }

            Map<String, String> basliklar = new HashMap<>();
            if ("index.html".equals(gercekYol)) {
                basliklar.put("Cache-Control", "no-store");
            } else {
                basliklar.put("Cache-Control", "public, max-age=31536000");
            }
            return new WebResourceResponse(
                    mimeTuruBelirle(gercekYol),
                    "UTF-8",
                    200,
                    "OK",
                    basliklar,
                    akis
            );
        } catch (Exception hata) {
            return new WebResourceResponse(
                    "text/plain",
                    "UTF-8",
                    500,
                    "Hata",
                    null,
                    new ByteArrayInputStream("Varlik yuklenemedi".getBytes(StandardCharsets.UTF_8))
            );
        }
    }

    private String mimeTuruBelirle(String yol) {
        String kucuk = yol.toLowerCase(Locale.US);
        if (kucuk.endsWith(".html")) return "text/html";
        if (kucuk.endsWith(".js") || kucuk.endsWith(".mjs")) return "application/javascript";
        if (kucuk.endsWith(".css")) return "text/css";
        if (kucuk.endsWith(".json")) return "application/json";
        if (kucuk.endsWith(".svg")) return "image/svg+xml";
        if (kucuk.endsWith(".png")) return "image/png";
        if (kucuk.endsWith(".jpg") || kucuk.endsWith(".jpeg")) return "image/jpeg";
        if (kucuk.endsWith(".webp")) return "image/webp";
        if (kucuk.endsWith(".wav")) return "audio/wav";
        if (kucuk.endsWith(".mp3")) return "audio/mpeg";
        if (kucuk.endsWith(".ogg")) return "audio/ogg";
        if (kucuk.endsWith(".woff2")) return "font/woff2";
        if (kucuk.endsWith(".woff")) return "font/woff";
        return "application/octet-stream";
    }

    private void tarayiciOlayGonder(final String olayAdi, final String detayJson) {
        if (webTarayici == null) return;
        webTarayici.post(new Runnable() {
            @Override
            public void run() {
                String betik = "window.dispatchEvent(new CustomEvent("
                        + JSONObject.quote(olayAdi)
                        + ", { detail: " + detayJson + " }));";
                webTarayici.evaluateJavascript(betik, null);
            }
        });
    }

    private class KopruArayuzu {

        @JavascriptInterface
        public boolean oturumAyarla(
                String kullaniciId,
                String adSoyad,
                String rol,
                String subeId,
                String firebaseBelirtec
        ) {
            String temizSubeId = (subeId != null) ? subeId.trim() : "";
            if (temizSubeId.isEmpty()) {
                return false;
            }
            SharedPreferences tercihler = getSharedPreferences(DinleyiciServisi.TERCIH_ADI, MODE_PRIVATE);
            tercihler.edit()
                    .putString(DinleyiciServisi.ANAHTAR_KULLANICI_ID, kullaniciId != null ? kullaniciId : "")
                    .putString(DinleyiciServisi.ANAHTAR_AD_SOYAD, adSoyad != null ? adSoyad : "")
                    .putString(DinleyiciServisi.ANAHTAR_ROL, rol != null ? rol : "")
                    .putString(DinleyiciServisi.ANAHTAR_SUBE_ID, temizSubeId)
                    .putString(DinleyiciServisi.ANAHTAR_FIREBASE_BELIRTEC, firebaseBelirtec != null ? firebaseBelirtec : "")
                    .apply();
            servisBaslatVeyaGuncelle();
            return true;
        }

        @JavascriptInterface
        public void oturumKapat() {
            SharedPreferences tercihler = getSharedPreferences(DinleyiciServisi.TERCIH_ADI, MODE_PRIVATE);
            tercihler.edit()
                    .remove(DinleyiciServisi.ANAHTAR_KULLANICI_ID)
                    .remove(DinleyiciServisi.ANAHTAR_AD_SOYAD)
                    .remove(DinleyiciServisi.ANAHTAR_ROL)
                    .remove(DinleyiciServisi.ANAHTAR_SUBE_ID)
                    .remove(DinleyiciServisi.ANAHTAR_FIREBASE_BELIRTEC)
                    .apply();
            Intent servisNiyeti = new Intent(MainActivity.this, DinleyiciServisi.class);
            servisNiyeti.setAction(DinleyiciServisi.EYLEM_DURDUR);
            startService(servisNiyeti);
        }

        @JavascriptInterface
        public boolean zilAyarla(String seciliKimlik, double sesSeviyesi, String ozelSesVeriUrl) {
            String temizKimlik = (seciliKimlik != null && !seciliKimlik.trim().isEmpty())
                    ? seciliKimlik.trim()
                    : "nukleer_siren";
            float sinirliSes = (float) Math.max(0.2, Math.min(1.0, sesSeviyesi));

            SharedPreferences tercihler = getSharedPreferences(DinleyiciServisi.TERCIH_ADI, MODE_PRIVATE);
            SharedPreferences.Editor duzenleyici = tercihler.edit()
                    .putString(DinleyiciServisi.ANAHTAR_SECILI_ZIL, temizKimlik)
                    .putFloat(DinleyiciServisi.ANAHTAR_ZIL_SES_SEVIYESI, sinirliSes);

            File ozelDosya = new File(getFilesDir(), DinleyiciServisi.OZEL_ZIL_DOSYA_ADI);
            if ("temizle".equals(ozelSesVeriUrl)) {
                if (ozelDosya.exists()) {
                    ozelDosya.delete();
                }
                duzenleyici.putBoolean(DinleyiciServisi.ANAHTAR_OZEL_ZIL_MEVCUT, false);
            } else if (ozelSesVeriUrl != null && ozelSesVeriUrl.startsWith("data:audio/")) {
                int virgulKonum = ozelSesVeriUrl.indexOf(",");
                if (virgulKonum <= 0) {
                    return false;
                }
                String ustBilgi = ozelSesVeriUrl.substring(0, virgulKonum).toLowerCase(Locale.US);
                if (!ustBilgi.contains(";base64")) {
                    return false;
                }
                String hamBase64 = ozelSesVeriUrl.substring(virgulKonum + 1);
                byte[] cozulmus = Base64.decode(hamBase64, Base64.DEFAULT);
                if (cozulmus.length < 64 || cozulmus.length > AZAMI_OZEL_SES_BAYT) {
                    return false;
                }
                try (FileOutputStream cikis = new FileOutputStream(ozelDosya)) {
                    cikis.write(cozulmus);
                    cikis.flush();
                    duzenleyici.putBoolean(DinleyiciServisi.ANAHTAR_OZEL_ZIL_MEVCUT, true);
                } catch (Exception hata) {
                    return false;
                }
            }

            duzenleyici.apply();
            return true;
        }

        @JavascriptInterface
        public void zilCal(String baslik, String detay, boolean kesintisiz, int sureSn) {
            Intent niyet = new Intent(MainActivity.this, DinleyiciServisi.class);
            niyet.setAction(DinleyiciServisi.EYLEM_ZIL_CAL);
            niyet.putExtra(DinleyiciServisi.EKSTRA_BASLIK, baslik != null ? baslik : "Afyon Şube Alarmı");
            niyet.putExtra(DinleyiciServisi.EKSTRA_DETAY, detay != null ? detay : "");
            niyet.putExtra(DinleyiciServisi.EKSTRA_KESINTISIZ, kesintisiz);
            niyet.putExtra(DinleyiciServisi.EKSTRA_SURE_SN, sureSn);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(niyet);
            } else {
                startService(niyet);
            }
        }

        @JavascriptInterface
        public void zilSustur() {
            Intent niyet = new Intent(MainActivity.this, DinleyiciServisi.class);
            niyet.setAction(DinleyiciServisi.EYLEM_ZIL_SUSTUR);
            startService(niyet);
        }

        @SuppressLint("BatteryLife")
        @JavascriptInterface
        public String pilOptimizasyonuIste() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                return "desteklenmiyor";
            }
            PowerManager gucYoneticisi = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (gucYoneticisi != null && gucYoneticisi.isIgnoringBatteryOptimizations(getPackageName())) {
                return "zaten_muaf";
            }
            try {
                Intent niyet = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                niyet.setData(Uri.parse("package:" + getPackageName()));
                startActivity(niyet);
                return "istek_acildi";
            } catch (Exception hata) {
                return "hata";
            }
        }

        @JavascriptInterface
        public String uygulamaSurumu() {
            try {
                PackageInfo bilgi = getPackageManager().getPackageInfo(getPackageName(), 0);
                JSONObject json = new JSONObject();
                long kod = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                        ? bilgi.getLongVersionCode()
                        : bilgi.versionCode;
                json.put("surumKodu", kod);
                json.put("surumAdi", bilgi.versionName != null ? bilgi.versionName : "1.0.0");
                json.put("paketAdi", getPackageName());
                json.put("native", true);
                return json.toString();
            } catch (Exception hata) {
                return "{\"surumKodu\":1,\"surumAdi\":\"1.0.0\",\"paketAdi\":\"com.afyonevlezzetleri.sube\",\"native\":true}";
            }
        }

        @JavascriptInterface
        public String apkGuncelleIndirVeKur(final String indirmeUrl) {
            if (indirmeUrl == null || indirmeUrl.trim().isEmpty()) {
                return "gecersiz_adres";
            }
            final Uri parsed = Uri.parse(indirmeUrl.trim());
            String sema = parsed.getScheme() != null ? parsed.getScheme().toLowerCase(Locale.US) : "";
            String konak = parsed.getHost() != null ? parsed.getHost() : "";
            if (!"https".equals(sema) || konak.isEmpty()) {
                return "yalnizca_https";
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !getPackageManager().canRequestPackageInstalls()) {
                try {
                    Intent izinNiyeti = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName())
                    );
                    startActivity(izinNiyeti);
                } catch (Exception ignored) {
                }
                return "kurulum_izni_gerekli";
            }

            new Thread(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection baglanti = null;
                    try {
                        tarayiciOlayGonder("afyon-ota-durum", "{\"durum\":\"indiriliyor\"}");
                        File guncellemeKlasoru = new File(getCacheDir(), "apk_guncelleme");
                        if (!guncellemeKlasoru.exists()) {
                            guncellemeKlasoru.mkdirs();
                        }
                        File hedefApk = new File(guncellemeKlasoru, "guncel.apk");
                        File geciciApk = new File(guncellemeKlasoru, "guncel.apk.tmp");

                        URL adres = new URL(parsed.toString());
                        baglanti = (HttpURLConnection) adres.openConnection();
                        baglanti.setConnectTimeout(15000);
                        baglanti.setReadTimeout(60000);
                        baglanti.setInstanceFollowRedirects(true);
                        int kod = baglanti.getResponseCode();
                        if (kod < 200 || kod >= 300) {
                            tarayiciOlayGonder("afyon-ota-durum", "{\"durum\":\"hata\",\"mesaj\":\"Sunucu HTTP " + kod + "\"}");
                            return;
                        }

                        long toplamBayt = 0;
                        byte[] ilkDort = new byte[4];
                        int ilkOkunan = 0;

                        try (InputStream giris = baglanti.getInputStream();
                             FileOutputStream cikis = new FileOutputStream(geciciApk)) {
                            byte[] tampon = new byte[8192];
                            int okunan;
                            while ((okunan = giris.read(tampon)) != -1) {
                                if (ilkOkunan < 4) {
                                    int kopyalanacak = Math.min(4 - ilkOkunan, okunan);
                                    System.arraycopy(tampon, 0, ilkDort, ilkOkunan, kopyalanacak);
                                    ilkOkunan += kopyalanacak;
                                }
                                toplamBayt += okunan;
                                if (toplamBayt > 160L * 1024L * 1024L) {
                                    throw new SecurityException("APK boyutu sınırı aşıldı.");
                                }
                                cikis.write(tampon, 0, okunan);
                            }
                            cikis.flush();
                        }

                        boolean gecerliZip = ilkOkunan == 4
                                && ilkDort[0] == 0x50
                                && ilkDort[1] == 0x4B
                                && ilkDort[2] == 0x03
                                && ilkDort[3] == 0x04;
                        if (!gecerliZip || toplamBayt < 50000) {
                            geciciApk.delete();
                            tarayiciOlayGonder("afyon-ota-durum", "{\"durum\":\"hata\",\"mesaj\":\"Geçersiz APK paketi.\"}");
                            return;
                        }

                        if (hedefApk.exists()) {
                            hedefApk.delete();
                        }
                        if (!geciciApk.renameTo(hedefApk)) {
                            tarayiciOlayGonder("afyon-ota-durum", "{\"durum\":\"hata\",\"mesaj\":\"Dosya taşınamadı.\"}");
                            return;
                        }

                        Uri icerikUri = ApkDosyaSaglayici.dosyaIcinUriOlustur(MainActivity.this, hedefApk);
                        Intent kurNiyeti = new Intent(Intent.ACTION_VIEW);
                        kurNiyeti.setDataAndType(icerikUri, "application/vnd.android.package-archive");
                        kurNiyeti.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(kurNiyeti);
                        tarayiciOlayGonder("afyon-ota-durum", "{\"durum\":\"kurulum_baslatildi\"}");
                    } catch (Exception hata) {
                        tarayiciOlayGonder(
                                "afyon-ota-durum",
                                "{\"durum\":\"hata\",\"mesaj\":" + JSONObject.quote(String.valueOf(hata.getMessage())) + "}"
                        );
                    } finally {
                        if (baglanti != null) {
                            baglanti.disconnect();
                        }
                    }
                }
            }).start();

            return "baslatildi";
        }
    }
}
