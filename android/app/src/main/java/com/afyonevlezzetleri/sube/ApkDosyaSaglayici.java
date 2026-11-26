package com.afyonevlezzetleri.sube;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

public class ApkDosyaSaglayici extends ContentProvider {

    public static final String YETKI = "com.afyonevlezzetleri.sube.dosyasaglayici";
    private static final String GUNCELLEME_KLASORU = "apk_guncelleme";

    public static Uri dosyaIcinUriOlustur(Context baglam, File hedefDosya) throws IOException {
        File kokKlasor = new File(baglam.getCacheDir(), GUNCELLEME_KLASORU).getCanonicalFile();
        File gercekDosya = hedefDosya.getCanonicalFile();
        String kokYolu = kokKlasor.getPath() + File.separator;
        if (!gercekDosya.getPath().startsWith(kokYolu)) {
            throw new SecurityException("APK dosyası izinli önbellek dizini dışında.");
        }
        String goreliYol = gercekDosya.getPath().substring(kokYolu.length());
        return new Uri.Builder()
                .scheme("content")
                .authority(YETKI)
                .appendPath(GUNCELLEME_KLASORU)
                .appendEncodedPath(goreliYol)
                .build();
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    private File guvenliDosyaCoz(Uri uri) throws FileNotFoundException {
        Context baglam = getContext();
        if (baglam == null || uri == null) {
            throw new FileNotFoundException("Geçersiz dosya isteği.");
        }
        String yolParcasi = uri.getPath();
        if (yolParcasi == null || yolParcasi.contains("..") || yolParcasi.contains("\0")) {
            throw new FileNotFoundException("Güvensiz dosya yolu.");
        }
        String temizYol = yolParcasi.replaceFirst("^/+", "");
        String beklenenOnEk = GUNCELLEME_KLASORU + "/";
        if (!temizYol.startsWith(beklenenOnEk)) {
            throw new FileNotFoundException("Erişim yalnızca güncelleme klasörüne açıktır.");
        }
        String dosyaAdi = temizYol.substring(beklenenOnEk.length());
        if (dosyaAdi.isEmpty() || dosyaAdi.contains("/")) {
            throw new FileNotFoundException("Geçersiz APK dosya adı.");
        }
        try {
            File kokKlasor = new File(baglam.getCacheDir(), GUNCELLEME_KLASORU).getCanonicalFile();
            File hedefDosya = new File(kokKlasor, dosyaAdi).getCanonicalFile();
            if (!hedefDosya.getPath().startsWith(kokKlasor.getPath() + File.separator)) {
                throw new FileNotFoundException("Dizin sınırı aşıldı.");
            }
            if (!hedefDosya.exists() || !hedefDosya.isFile()) {
                throw new FileNotFoundException("APK dosyası bulunamadı.");
            }
            return hedefDosya;
        } catch (IOException hata) {
            throw new FileNotFoundException("Dosya çözümlenemedi.");
        }
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mod) throws FileNotFoundException {
        if (mod == null || !"r".equals(mod)) {
            throw new SecurityException("Yalnızca salt okunur erişime izin verilir.");
        }
        File dosya = guvenliDosyaCoz(uri);
        return ParcelFileDescriptor.open(dosya, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public Cursor query(Uri uri, String[] sutunlar, String secim, String[] secimArgumanlari, String siralama) {
        File dosya;
        try {
            dosya = guvenliDosyaCoz(uri);
        } catch (FileNotFoundException hata) {
            return null;
        }
        String[] hedefSutunlar = (sutunlar != null) ? sutunlar : new String[]{
                OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE
        };
        MatrixCursor imlec = new MatrixCursor(hedefSutunlar, 1);
        Object[] satir = new Object[hedefSutunlar.length];
        for (int i = 0; i < hedefSutunlar.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(hedefSutunlar[i])) {
                satir[i] = dosya.getName();
            } else if (OpenableColumns.SIZE.equals(hedefSutunlar[i])) {
                satir[i] = dosya.length();
            }
        }
        imlec.addRow(satir);
        return imlec;
    }

    @Override
    public Uri insert(Uri uri, ContentValues degerler) {
        throw new UnsupportedOperationException("Salt okunur sağlayıcı.");
    }

    @Override
    public int delete(Uri uri, String secim, String[] secimArgumanlari) {
        throw new UnsupportedOperationException("Salt okunur sağlayıcı.");
    }

    @Override
    public int update(Uri uri, ContentValues degerler, String secim, String[] secimArgumanlari) {
        throw new UnsupportedOperationException("Salt okunur sağlayıcı.");
    }
}
