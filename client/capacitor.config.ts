import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bettermarks.oneup',
  appName: '1UP',
  webDir: 'dist',
  ios: {
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FBBA00',        // matches --accent
    },
  },
};

export default config;
