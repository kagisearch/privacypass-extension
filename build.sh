#!/bin/bash

# build privacypass-lib
# git submodule init && git submodule update
# bash -c "(cd privacypass-lib; DOCKER=${DOCKER} bash build.sh)"

# build the extension

DOCKERCMD=${DOCKER:-docker}
BASENAME=kagi-privacypass-extension

$DOCKERCMD container stop  ${BASENAME}-container
$DOCKERCMD container rm    ${BASENAME}-container
$DOCKERCMD rmi             ${BASENAME}-image
$DOCKERCMD build --platform=linux/amd64 -t        ${BASENAME}-image .

rm -rf build
mkdir build

$DOCKERCMD run -it -v ./build:/build --name ${BASENAME}-container ${BASENAME}-image
