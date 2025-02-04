# Kagi Privacy Pass Extension

This repository contains the source code to the [Firefox](https://addons.mozilla.org/firefox/addon/kagi-privacy-pass/) and [Chrome](https://chromewebstore.google.com/detail/kagi-search/cdglnehniifkbagbbombnjghhcihifij) extensions for [Kagi Privacy Pass](https://blog.kagi.com/kagi-privacy-pass).

## Building using Docker

To build this library, install Docker and run
```bash
bash build.sh
```
If using Podman, run
```bash
DOCKER=podman bash build.sh
```
The output library will be found in `/build`.

## Building on host machine

### Installing the build dependencies

To build this project directly on your host machine, you need [zip](https://infozip.sourceforge.net/), [jq](https://jqlang.org/), [rust](https://www.rust-lang.org/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/).

On Debian, you can obtain zip and jq by running `sudo apt install -y zip jq`, Rust by using [rustup](https://rustup.rs/), and wasm-pack by using its [installer](https://rustwasm.github.io/wasm-pack/installer/).

### Building the extension

Once the above dependencies were obtained, run
```bash
bash make.sh
```
The output extensions will be found in `/build`.
