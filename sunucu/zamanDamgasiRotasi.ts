import express from 'express';
import type { Request, Response } from 'express';
import { zamanDamgasiOlustur } from './ZamanDamgasiServisi.ts';

export const zamanDamgasiRotasi = express.Router();

function gercekIpAdresiAl(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  let hamIp = '';

  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    hamIp = xForwardedFor.split(',')[0].trim();
  } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    hamIp = String(xForwardedFor[0]).split(',')[0].trim();
  } else if (req.ip) {
    hamIp = req.ip;
  } else if (req.socket?.remoteAddress) {
    hamIp = req.socket.remoteAddress;
  }

  if (hamIp.startsWith('::ffff:')) {
    hamIp = hamIp.slice(7);
  }

  return hamIp.slice(0, 64) || 'bilinmiyor';
}

function temizMetin(deger: unknown, maksUzunluk: number): string {
  if (typeof deger !== 'string') return '';
  return deger.trim().slice(0, maksUzunluk);
}

zamanDamgasiRotasi.post('/damgala', async (req: Request, res: Response) => {
  try {
    const govde = req.body;
    if (!govde || typeof govde !== 'object' || Array.isArray(govde)) {
      res.status(400).json({ basarili: false, hata: 'Geçersiz istek gövdesi.' });
      return;
    }

    const islemTuru = temizMetin(govde.islemTuru, 64);
    const sozlesmeTuru = temizMetin(govde.sozlesmeTuru, 100);
    const sozlesmeVersiyonu = temizMetin(govde.sozlesmeVersiyonu, 24) || '1.0';
    const ilgiliKayitId = temizMetin(govde.ilgiliKayitId, 128);

    if (!islemTuru || !sozlesmeTuru || !ilgiliKayitId) {
      res.status(400).json({
        basarili: false,
        hata: 'islemTuru, sozlesmeTuru ve ilgiliKayitId alanları zorunludur.',
      });
      return;
    }

    const sozlesmeMetni = temizMetin(govde.sozlesmeMetni, 8000);
    const sozlesmeMetinHash = temizMetin(govde.sozlesmeMetinHash, 128);
    const kullaniciKimlik = temizMetin(govde.kullaniciKimlik, 128);
    const ekDetay = temizMetin(govde.ekDetay, 1500);
    const ipAdresi = gercekIpAdresiAl(req);

    const sonuc = await zamanDamgasiOlustur({
      islemTuru,
      sozlesmeTuru,
      sozlesmeVersiyonu,
      ilgiliKayitId,
      sozlesmeMetni: sozlesmeMetni || undefined,
      sozlesmeMetinHash: sozlesmeMetinHash || undefined,
      kullaniciKimlik: kullaniciKimlik || undefined,
      ekDetay: ekDetay || undefined,
      ipAdresi,
    });

    res.status(200).json({
      basarili: true,
      ...sonuc,
    });
  } catch (hata) {
    console.error('Zaman damgası rota hatası:', hata);
    res.status(500).json({
      basarili: false,
      hata: 'Zaman damgası oluşturulurken sunucu hatası oluştu.',
    });
  }
});
