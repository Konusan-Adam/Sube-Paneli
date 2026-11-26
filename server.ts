import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zamanDamgasiRotasi } from './sunucu/zamanDamgasiRotasi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sunucuyuBaslat() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const uretimModu = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  const izinliApkKokenleri = new Set([
    'https://appassets.androidplatform.net',
    'https://localhost',
    'http://localhost',
  ]);
  app.use('/api/zaman-damgasi', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && izinliApkKokenleri.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use('/api/zaman-damgasi', zamanDamgasiRotasi);

  const ciktiDizini = path.resolve(__dirname, 'android', 'cikti');
  app.use('/apk', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && izinliApkKokenleri.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/apk/apk-meta.json', (_req, res) => {
    const metaYolu = path.resolve(ciktiDizini, 'apk-meta.json');
    if (!metaYolu.startsWith(ciktiDizini + path.sep)) {
      res.status(403).end();
      return;
    }
    if (fs.existsSync(metaYolu)) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.sendFile(metaYolu);
    } else {
      res.status(404).json({ hata: 'APK üstverisi henüz oluşturulmadı.' });
    }
  });

  app.get('/apk/afyon-sube.apk', (_req, res) => {
    const apkYolu = path.resolve(ciktiDizini, 'afyon-sube.apk');
    if (!apkYolu.startsWith(ciktiDizini + path.sep)) {
      res.status(403).end();
      return;
    }
    if (fs.existsSync(apkYolu)) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.download(apkYolu, 'afyon-sube.apk');
    } else {
      res.status(404).send('APK dosyası henüz üretilmedi. Lütfen npm run build:apk çalıştırın.');
    }
  });

  if (!uretimModu) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDizini = path.resolve(__dirname, 'dist');
    app.use(express.static(distDizini));
    app.get('*', (_req, res) => {
      const indexYolu = path.join(distDizini, 'index.html');
      if (fs.existsSync(indexYolu)) {
        res.sendFile(indexYolu);
      } else {
        res.status(404).send('Uygulama derlemesi bulunamadı.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Şube Paneli sunucusu http://0.0.0.0:${port} adresinde çalışıyor.`);
  });
}

sunucuyuBaslat().catch((err) => {
  console.error('Sunucu başlatılamadı:', err);
  process.exit(1);
});
