import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gst.pmobile',
  appName: 'GST PM Mobile',
  webDir: 'dist',
  server: {
    url: 'https://77c166db-fb33-42d5-a173-494b5f92758d.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
