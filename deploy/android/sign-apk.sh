#!/usr/bin/env bash
# Signs an aligned APK built by build-apk.sh with the release keystore.
# Usage: deploy/android/sign-apk.sh <unsigned.apk> <signed.apk>
# Needs: ANDROID_HOME with build-tools 36.1.0, KEYSTORE_PATH (PKCS12, alias
#        "kitchenstorage") and KEYSTORE_PASSWORD.
set -euo pipefail

INPUT="${1:?unsigned apk path}"
OUTPUT="${2:?signed apk path}"
BUILD_TOOLS="${ANDROID_HOME:?ANDROID_HOME is not set}/build-tools/36.1.0"
: "${KEYSTORE_PATH:?KEYSTORE_PATH is not set}"
: "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD is not set}"

# The password is passed through the environment, never on the command line.
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE_PATH" --ks-key-alias kitchenstorage \
  --ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEYSTORE_PASSWORD --out "$OUTPUT" "$INPUT"
"$BUILD_TOOLS/apksigner" verify --print-certs "$OUTPUT" | grep -E 'Signer #1 certificate (DN|SHA-256)'
rm -f "$OUTPUT.idsig"
