#!/usr/bin/env node
/**
 * Runs a single Android flavor and makes sure it is the only one on the device.
 *
 * The two flavors have different applicationIds, so Android happily keeps both
 * installed side by side. That gets confusing fast when you are testing branding
 * or the auto-activation admin code, so we uninstall the sibling flavor first.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FLAVORS = {
  rudraerp: { mode: 'rudraerpDebug', appId: 'com.app.rudraerp' },
  rkn: { mode: 'rknDebug', appId: 'com.app.rkn' },
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

const { status } = spawnSync(
  'react-native',
  ['run-android', '--mode', config.mode, '--appId', config.appId],
  { stdio: 'inherit', shell: true },
);
process.exit(status ?? 1);
