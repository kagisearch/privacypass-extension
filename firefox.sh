#!/usr/bin/env bash

DEBUG=$1
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
cp "src/popup/progress_bar_moz.css" "$unpacked_dir/popup/progress_bar.css"

if [ -z $DEBUG ];
then
  # RELEASE: disable (by removing) debug buttons
  rm "$unpacked_dir/popup/debug.js"
  touch "$unpacked_dir/popup/debug.js"
fi

rm "$outputfn.zip" || true
rm "$outputfn.xpi" || true
cd "$unpacked_dir"; zip -r "../$outputfn.zip" * ; cd ..;
mv "$outputfn.zip" "$outputfn.xpi"
