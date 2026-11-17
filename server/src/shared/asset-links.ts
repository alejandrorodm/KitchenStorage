/**
 * Android Digital Asset Links (https://developers.google.com/digital-asset-links),
 * served at `/.well-known/assetlinks.json`. They prove the Android app (a Trusted
 * Web Activity, see deploy/android/README.md) belongs to this site, so it opens
 * full screen instead of with a browser bar. The fingerprint is the SHA-256 of the
 * certificate in the release keystore that GitHub Actions signs the APK with.
 */
export const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.alejandrorodm.kitchenstorage',
      sha256_cert_fingerprints: [
        'ED:E9:D2:A7:F9:9C:BA:B1:B8:9A:18:EC:D5:9D:6B:09:0A:B8:E1:FD:A4:2E:8D:FD:0B:9B:D4:78:7B:6E:2E:B6',
      ],
    },
  },
];
