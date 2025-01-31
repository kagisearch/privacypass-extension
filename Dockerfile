FROM rust:1.84 AS builder

# Install dependencies

RUN update-ca-certificates && apt-get update && apt-get install -y --no-install-recommends jq zip

# Copy source

COPY chrome.sh /extension/chrome.sh
COPY firefox.sh /extension/firefox.sh
COPY src /extension/src
COPY privacypass-lib/build/wasm /extension/src/scripts/kagippjs

# Build extension

WORKDIR /extension
RUN mkdir chrome
RUN BUILDDIR=chrome bash chrome.sh
RUN mkdir firefox
RUN BUILDDIR=firefox bash firefox.sh

# Copy extension to host

CMD [ "cp", "-r", "/extension/chrome", "/extension/firefox", "/build" ]
