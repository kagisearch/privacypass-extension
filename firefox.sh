#!/usr/bin/env bash

BUILDDIR=${BUILDDIR:-build}

set -xeou pipefail

version="$(cat src/firefox_manifest.json | jq -r .version)"
inputs=(
  images
  popup
  scripts
  pages
  background.js
  background.html
)
outputfn="kagi_privacypass_firefox_${version}"
unpacked_dir="${BUILDDIR}/unpacked_firefox"

rm -rf "$unpacked_dir" || true
mkdir "$unpacked_dir"

for item in ${inputs[@]}
do
  cp -r "src/$item" "$unpacked_dir"
done
cp "src/firefox_manifest.json" "$unpacked_dir/manifest.json"

rm "$outputfn.zip" || true
rm "$outputfn.xpi" || true
cd "$unpacked_dir"; zip -r "../$outputfn.zip" * ; cd ..;
mv "$outputfn.zip" "$outputfn.xpi"
