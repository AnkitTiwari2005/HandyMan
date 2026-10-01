import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.handyman.partner',
  appName: 'HandyMan',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
