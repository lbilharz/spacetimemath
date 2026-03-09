import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bilharz.mathsprint',
  appName: 'Math Sprint',
  webDir: 'dist',
  ios: {
    backgroundColor: '#0d0d1a',   // matches --bg
    contentInset: 'always',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#00d4aa',        // matches --accent
    },
  },
};

export default config;
