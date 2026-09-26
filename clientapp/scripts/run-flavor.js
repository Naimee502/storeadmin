#!/usr/bin/env node
/**
 * Runs a single Android flavor and makes sure it is the only one on the device.
 *
 * The flavors have different applicationIds, so Android happily keeps both
 * installed side by side. That gets confusing fast when you are testing branding
 * or the auto-activation admin code, so we uninstall the sibling flavor first.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FLAVORS = {
  rudraerp: { mode: 'rudraerpDebug', appId: 'com.app.rudraerp' },
  rkn: { mode: 'rknDebug', appId: 'com.app.rkn' },
  powergold: { mode: 'powergoldDebug', appId: 'com.app.powergoldagroproduct' },
  arsi: { mode: 'arsiDebug', appId: 'com.arsi.agarbatti' },
};

const flavor = process.argv[2];
const config = FLAVORS[flavor];

if (!config) {
  console.error(`Unknown flavor "${flavor}". Expected one of: ${Object.keys(FLAVORS).join(', ')}`);
  process.exit(1);
}

// react-native run-android finds adb the same way: PATH first, then the SDK.
function resolveAdb() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const fromSdk = path.join(sdk, 'platform-tools', 'adb');
    if (fs.existsSync(fromSdk)) return fromSdk;
  }
  return 'adb';
}

const adb = resolveAdb();

// Uninstall every flavor except the one we are about to run. `adb uninstall`
// exits non-zero when the package was never installed, which is not an error here.
for (const [name, other] of Object.entries(FLAVORS)) {
  if (name === flavor) continue;
  process.stdout.write(`Removing other flavor ${other.appId} ... `);
  const { status } = spawnSync(adb, ['uninstall', other.appId], { stdio: 'pipe' });
  console.log(status === 0 ? 'uninstalled' : 'not installed');
}

// Local dev: the app's debug SERVER_URL is http://localhost:4000 and Metro is
// on 8081 — both are the Mac's ports, so forward them to the device/emulator.
// Must be re-done after every USB re-plug or reboot; doing it on every run
// means nobody has to remember. Harmless if no device is attached yet.
for (const port of ['4000', '8081']) {
  spawnSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'ignore' });
}

const { status } = spawnSync(
  'react-native',
  ['run-android', '--mode', config.mode, '--appId', config.appId],
  { stdio: 'inherit', shell: true },
);

// Again, now that a device is certainly up. When no emulator was running,
// run-android launches one AFTER the reverse above — which then had nothing to
// attach to, so the app came up with "Network request failed" on localhost:4000.
for (const port of ['4000', '8081']) {
  spawnSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'ignore' });
}
if (status === 0) console.log('adb reverse tcp:4000 / tcp:8081 set — reload the app if it opened before this.');
process.exit(status ?? 1);
