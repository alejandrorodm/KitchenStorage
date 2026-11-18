// Generates the Android project of the Trusted Web Activity (TWA) without the
// interactive `bubblewrap init`/`build` wizard, using @bubblewrap/core directly
// (the same library the CLI uses underneath).
//
// Usage: node generate-project.cjs <output-directory>
//   MANIFEST_URL      web manifest to read name, colours and icons from. It is
//                     downloaded during generation, so CI points it at a local
//                     server of the freshly built web/dist (default: production).
//   APP_VERSION_CODE  integer Android version code; must grow on every build that
//                     should install over the previous one (CI uses the run number).
//   APP_VERSION_NAME  version shown to the user (default: 1.0.<code>).
//
// The host, start URL and scope are always the production domain: they are the
// only values the installed app uses at runtime.
const path = require('node:path');
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');

const HOST = 'kitchen.alejandrorodm.com';
const MANIFEST_URL = process.env.MANIFEST_URL || `https://${HOST}/manifest.webmanifest`;

function versionCode() {
  const code = Number(process.env.APP_VERSION_CODE ?? '1');
  if (!Number.isInteger(code) || code < 1) throw new Error(`APP_VERSION_CODE must be a positive integer, got "${process.env.APP_VERSION_CODE}"`);
  return code;
}

async function main() {
  const outputDirectory = process.argv[2];
  if (!outputDirectory) throw new Error('Usage: node generate-project.cjs <output-directory>');
  const target = path.resolve(outputDirectory);

  const twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL);
  twaManifest.packageId = 'com.alejandrorodm.kitchenstorage';
  twaManifest.host = HOST;
  twaManifest.startUrl = '/';
  twaManifest.fullScopeUrl = new URL(`https://${HOST}/`);
  twaManifest.appVersionCode = versionCode();
  twaManifest.appVersionName = process.env.APP_VERSION_NAME || `1.0.${twaManifest.appVersionCode}`;
  // Signing happens after the Gradle build (apksigner), not inside it.
  twaManifest.signingKey = { path: './android.keystore', alias: 'kitchenstorage' };
  // The default (21) is below the minimum androidbrowserhelper requires (24).
  // Lets the web app's push notifications show as Android notifications.
  twaManifest.enableNotifications = true;
  twaManifest.minSdkVersion = 24;

  const generator = new TwaGenerator();
  await generator.removeTwaProject(target);
  await generator.createTwaProject(target, twaManifest, new ConsoleLog('generate'), () => {});
  console.log(`Android project for ${twaManifest.packageId} ${twaManifest.appVersionName} (${twaManifest.appVersionCode}) generated in ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
