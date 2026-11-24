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

  app.use('/api/zaman-damgasi', zamanDamgasiRotasi);

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
