DEBUG=$1

rm -rf build
mkdir -p build/chrome
mkdir -p build/firefox

# compile wasm dependency
git submodule init && git submodule update
(cd privacypass-lib/src; bash build.sh)

rm -rf src/scripts/kagippjs
cp -r privacypass-lib/src/wasm/pkg src/scripts/kagippjs

BUILDDIR=build/chrome bash chrome.sh $DEBUG
BUILDDIR=build/firefox bash firefox.sh $DEBUG
