import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.bilharz.oneup',
  appName: '1UP',
  webDir: 'dist',
  ios: {
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,               // route fetch/XHR through native → bypasses WKWebView CORS
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FBBA00',        // matches --accent
    },
  },
};

export default config;
