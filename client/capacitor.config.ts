import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bettermarks.noggin',
  appName: 'noggin',
  webDir: 'dist',
  ios: {
    backgroundColor: '#F5F4F0',   // matches --bg
    contentInset: 'always',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FBBA00',        // matches --accent
    },
  },
};

export default config;
