import type { CapacitorConfig } from '@capacitor/cli';
import { READY_TIMEOUT_MS } from './src/app/config/live-update.const';

const config: CapacitorConfig = {
  appId: 'com.sabeeapp.goapp',
  appName: 'SabeeApp Go',
  webDir: 'www',
  ios: {
    backgroundColor: '#f9fafb'
  },
  plugins: {
    LiveUpdate: {
      // Capawesome Cloud app ID (org: thePass Ltd) — not the bundle identifier above.
      appId: '65afcebf-188f-4000-a966-a07d671bd66f',
      // Verifies bundle signatures. Public by design; the matching private key never enters this
      // repo (see scripts/publish-liveupdate.sh). Effectively permanent — it is compiled into
      // every binary, so rotating it costs a store release plus an adoption wait.
      publicKey: '-----BEGIN PUBLIC KEY-----MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwQJ+fETluHowvaRcz2ZlsQbuOarOiRPOE1RclxYAuen+lxy3n0kVVmht0oyhwrtUbsc6rWZaFImr73AF7idabr6SpJ6CNHEO37zV7WAQu5fOTEDAPtXsegKPDQl5bIAY6rxxK3hYpVP0e5WOIhh6kA9odgoseMCu7T3t7VdDOmwjco6jUpGl+zAKxnrpqalHh2jIUjfdLNZ8AmsuQRnY+HQCt/k2aop05wtKi6htyIseCZYslX+kx7H6/sg5mylSQr1q/egkILt3otYOsJFglPPxdH2vvCnLoueO6ScxZvJZjWoVAXJ43WgLTjnxJ8gtf2gLq/kR9x3TGdFi1UpvwELtaroVlzj4OwiclI/biXo3lwVyBkdfHFCUsFnHiUx2v9xdvCcLwWsSb8IKEMoy+UDTNlEDuLmKZ4ET4dHDW9VoeeMm55g+P09O6mN7kodpbm2oRlcfuVD+zKMSTSgZQd+xmtwFDrdR2a4PFKknXYL/5LW0kUVVzcYOkWwgEVbV+ktmU/AItYtv02TJF+YEt4GFr72GUUymbMqKCNUEjhoVCBpnkGjMC2WI12nVK8Lhloa5rbCeEFARS6J4M/7hjWK5uQIvCs8lZtfdJseHaeO7TLzQeEK+wtTNL4KRoiz2F0XuLrJKz7kK7g1sznF2Z2H60Bntaagrj8NuWCTaGQ8CAwEAAQ==-----END PUBLIC KEY-----',
      // Lowest-priority fallback in the plugin's channel-resolution chain. The real channel is
      // resolved per-property at runtime via setChannel() (see LiveUpdateService), so a fresh
      // install, a logged-out device, or any failed lookup lands here rather than on early/dev.
      // dev = internal testing, early = early adopters, prod = everyone else (renamed 2026-08-31
      // from dev/beta/production).
      defaultChannel: 'prod',
      // Never let the plugin reload the webview on its own schedule — it would eventually do it
      // mid-scan. The trigger is ours: resume only, gated by the busy guard (LiveUpdateService).
      autoUpdateStrategy: 'none',
      // Must be non-zero or rollback is disabled entirely (and autoBlockRolledBackBundles below
      // has no effect). See the const file for why this value is shared rather than inlined.
      readyTimeout: READY_TIMEOUT_MS,
      // Left on, but no longer permanent: each block is one rollback that LiveUpdateService counts
      // and then clears at the next boot (countRollbacksAndClearBlocks). A bundle is retried up
      // to BUNDLE_ROLLBACK_LIMIT times in 24h, then held back for 24h. Before Android 1.0.8 one
      // false rollback (see READY_TIMEOUT_MS) blocked a bundle for good, stranding the device on
      // native until a newer bundle was published.
      autoBlockRolledBackBundles: true,
      // Explicit rather than relying on the plugin default (which is also false): the retention
      // policy is ours. LiveUpdateService prunes to {current, next, previous} after each boot
      // reconcile, keeping one previous bundle deliberately — it is the evidence recorded in
      // live_update_events on a rollback, and the candidate the last-working fallback will use.
      // Letting the plugin delete unused bundles would remove both.
      autoDeleteBundles: false,
    },
  },
};

export default config;
