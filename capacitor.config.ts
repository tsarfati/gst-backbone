import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.77c166dbfb3342d5a173494b5f92758d',
  appName: 'GST Punch Clock',
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