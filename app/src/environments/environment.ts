export const environment = {
  production: false,
  apiUrl: 'https://api.sabeeapp.com/go',
  testApiUrl: 'https://smart.sabeeapp.com/api2/go',
  sentryDsn: 'https://6e6a2b41670d77c50c0793ab1785c90b@o301987.ingest.us.sentry.io/4511412888141824',
  supabaseUrl: 'https://qiwhynwwgicpyeszecuj.supabase.co',
  supabaseAnonKey: 'sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h',
  // Same project token as prod for now so dev/serve events flow and are verifiable
  // (filterable via the `environment` super property). TODO: replace with a
  // dedicated DEV-project token once a separate Mixpanel dev project exists.
  mixpanelToken: '03021fbbdcc35a8b657f5b91d4ad93b2',
};
