import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.afyonevlezzetleri.subepaneli',
  appName: 'Afyon Şube Paneli',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#180A1F',
  },
};

export default config;
