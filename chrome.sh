#!/usr/bin/env bash

BUILDDIR=${BUILDDIR:-build}

set -xeou pipefail

version="$(cat src/chrome_manifest.json | jq -r .version)"
inputs=(
  images
  popup
  scripts
  pages
  background.js
)
outputfn="kagi_privacypass_chrome_${version}.zip"
unpacked_dir="${BUILDDIR}/unpacked_chrome"

rm -rf "$unpacked_dir" || true
mkdir "$unpacked_dir"

for item in ${inputs[@]}
do
  cp -r "src/$item" "$unpacked_dir"
done
cp "src/chrome_manifest.json" "$unpacked_dir/manifest.json"

rm "$outputfn" || true
(cd "$unpacked_dir"; zip -r "../$outputfn" *)
