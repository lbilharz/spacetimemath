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
    LiveUpdate: {
      appId: 'eu.bilharz.oneup',
      autoDeleteBundles: true,
      enabled: true,
      publicKey: undefined,        // no bundle signing for now — add later if needed
      readyTimeout: 10_000,
      resetOnUpdate: false,
      url: 'REPLACE_WITH_VERCEL_BLOB_MANIFEST_URL',
    },
  },
};

export default config;
