# Kagi Privacy Pass Extension

This repository contains the source code to the Firefox and Chrome extensions for Kagi Privacy Pass.

## Build using Docker

To build this library, install Docker and run
```bash
bash build.sh
```
If using Podman, run
```bash
DOCKER=podman bash build.sh
```
The output library will be found in `/build`.

## Build in host machine

To build this project directly, you need `zip`, `jq`, Rust and wasm-pack.
Run
```bash
bash make.sh
```
The output extensions will be found in `/build`.
