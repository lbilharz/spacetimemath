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
      // Self-hosted mode: no appId (that's for Capawesome Cloud only).
      // The manifest URL is managed manually in App.tsx — the plugin itself
      // never contacts Capawesome servers when appId is omitted.
      autoDeleteBundles: true,   // clean up old bundles after ready()
      readyTimeout: 10_000,      // roll back if ready() not called within 10 s
    },
  },
};

export default config;
