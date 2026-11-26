package com.afyonevlezzetleri.sube;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context baglam, Intent niyet) {
        if (baglam == null || niyet == null) {
            return;
        }
        String eylem = niyet.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(eylem)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(eylem)) {
            return;
        }

        SharedPreferences tercihler = baglam.getSharedPreferences(
                DinleyiciServisi.TERCIH_ADI,
                Context.MODE_PRIVATE
        );
        String subeId = tercihler.getString(DinleyiciServisi.ANAHTAR_SUBE_ID, "");
        if (subeId == null || subeId.trim().isEmpty()) {
            return;
        }

        Intent servisNiyeti = new Intent(baglam, DinleyiciServisi.class);
        servisNiyeti.setAction(DinleyiciServisi.EYLEM_BASLAT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            baglam.startForegroundService(servisNiyeti);
        } else {
            baglam.startService(servisNiyeti);
        }
    }
}
