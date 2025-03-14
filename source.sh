#!/usr/bin/env bash

DEBUG=$1
SRCRELEASEDIR=${SRCRELEASEDIR:-source_release}

set -xeou pipefail

version="$(cat src/firefox_manifest.json | jq -r .version)"
inputs=(
    src
    build.sh
    CHANGELOG.md
    Dockerfile
    chrome.sh
    firefox.sh
    LICENSE
    make.sh
    README.md
)
outputfn="source_kagi_privacypass_firefox_${version}"
unpacked_dir="${SRCRELEASEDIR}/unpacked_firefox"

rm -rf "$unpacked_dir" || true
mkdir -p "$unpacked_dir"

for item in ${inputs[@]}
do
  cp -r "$item" "$unpacked_dir"
done
cp "src/firefox_manifest.json" "$unpacked_dir/src/manifest.json"
cp "src/popup/progress_bar_moz.css" "$unpacked_dir/src/popup/progress_bar.css"

inputs=(
    privacypass-lib/src
    privacypass-lib/build.sh
    privacypass-lib/Dockerfile
    privacypass-lib/LICENSE
    privacypass-lib/README.md
)
mkdir -p "$unpacked_dir/privacypass-lib"
for item in ${inputs[@]}
do
  cp -r "$item" "$unpacked_dir/privacypass-lib"
done
(cd "$unpacked_dir/privacypass-lib/src/" ; bash clean.sh) 

if [ -z $DEBUG ];
then
  # RELEASE: disable (by removing) debug buttons
  rm "$unpacked_dir/src/popup/debug.js"
  touch "$unpacked_dir/src/popup/debug.js"
fi

rm "$outputfn.zip" || true
rm "$outputfn.xpi" || true
cd "$unpacked_dir"; zip -r "../$outputfn.zip" * ; cd ..;