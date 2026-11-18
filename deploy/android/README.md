# Android app (Trusted Web Activity)

The APK is a [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity): a thin Android shell that opens `https://kitchen.alejandrorodm.com` full screen, with no browser bar. It contains no app code of its own, so every web release reaches the installed app immediately. Rebuild the APK only when the shell changes (name, colours, icons).

## How it is built

The `.github/workflows/android-apk.yml` workflow runs on every push (and manually with *Run workflow*):

1. Builds `web/` and serves `web/dist` on `127.0.0.1:4555`, so the app name, colours and PNG icons come from the commit being built, not from production.
2. `generate-project.cjs` generates the Android project with [`@bubblewrap/core`](https://github.com/GoogleChromeLabs/bubblewrap) (pinned in `package.json`/`package-lock.json`), using the run number as `versionCode`.
3. `build-apk.sh` runs Gradle and aligns the APK in a step with no secrets (Gradle downloads code from the network); `sign-apk.sh` then signs it with `apksigner` in a separate step that is the only one given the signing secrets.
4. The signed APK is uploaded as the artifact `kitchen-storage-apk-<run number>` (kept 30 days).
5. On `main`, a second job without access to the signing secrets publishes it as the release `apk-<run number>`.

## Signing key

Android only installs an update when it is signed with the **same** certificate as the installed app. The release keystore (PKCS12, alias `kitchenstorage`) was generated once and lives:

- in the repository secrets `ANDROID_KEYSTORE_BASE64` (the keystore, base64) and `ANDROID_KEYSTORE_PASSWORD` (store and key password), used by the workflow;
- on the maintainer's machine, outside the repository, in `~/.local/kitchenstorage-tools/` (`android.keystore`, `keystore-password.txt`, mode 600).

Back up both files somewhere safe. If they are lost, the app can only be republished as a different app and installed copies stop receiving updates.

Certificate SHA-256 fingerprint, also served by the server at `/.well-known/assetlinks.json` (`server/src/shared/asset-links.ts`) so Android trusts the site and hides the browser bar:

```
ED:E9:D2:A7:F9:9C:BA:B1:B8:9A:18:EC:D5:9D:6B:09:0A:B8:E1:FD:A4:2E:8D:FD:0B:9B:D4:78:7B:6E:2E:B6
```

If the keystore ever changes, update that fingerprint and deploy the server before installing the new APK.

## Local build

Needs Node 24, JDK 17+ and an Android SDK with `platforms;android-36` and `build-tools;36.1.0`.

```bash
npm run build -w web
cd deploy/android && npm ci --ignore-scripts
python3 -m http.server 4555 --bind 127.0.0.1 --directory ../../web/dist &
MANIFEST_URL=http://127.0.0.1:4555/manifest.webmanifest APP_VERSION_CODE=1 node generate-project.cjs /path/to/twa
export ANDROID_HOME=/path/to/android-sdk
./build-apk.sh /path/to/twa unsigned.apk
KEYSTORE_PATH=~/.local/kitchenstorage-tools/android.keystore \
KEYSTORE_PASSWORD="$(cat ~/.local/kitchenstorage-tools/keystore-password.txt)" \
  ./sign-apk.sh unsigned.apk kitchen-storage.apk
```

Use a `APP_VERSION_CODE` higher than the installed app's, or Android refuses the update.
