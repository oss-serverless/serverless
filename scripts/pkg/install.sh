#!/usr/bin/env bash
#
# Download and install standalone binary.
# The binary version can be specified by setting a VERSION variable.
# e.g. VERSION=2.21.1 bash install.sh
# If VERSION is unspecified it will download the latest version.

set -e

reset="\033[0m"
red="\033[31m"
green="\033[32m"
yellow="\033[33m"
cyan="\033[36m"
white="\033[37m"

printf "\n$yellow Installing Serverless!$reset\n\n"

# Detect platform
if [[ $OSTYPE == "linux-gnu" ]]; then
  PLATFORM="linux"
elif [[ $OSTYPE == "darwin"* ]]; then
  PLATFORM="macos"
else
  echo "$red Sorry, there's no serverless binary installer available for this platform. Please open request for it at https://github.com/oss-serverless/serverless/issues.$reset"
  exit 1
fi

# Detect architecture
MACHINE_TYPE=`uname -m`
if [[ $MACHINE_TYPE == "x86_64" ]]; then
  ARCH='x64'
elif [[ $OSTYPE == "darwin"* ]] && [[ $MACHINE_TYPE == "arm64" ]]; then
  ARCH='x64'
  echo "There is no native binary installer available for $MACHINE_TYPE architecture. Version for x86_64 architecture will be installed instead. In order to use it, you need to have Rosetta installed."
else
  echo "$red Sorry, there's no serverless binary installer available for $MACHINE_TYPE architecture. Please open request for it at https://github.com/oss-serverless/serverless/issues.$reset"
  exit 1
fi

if [[ -z "${VERSION}" ]]
then
  # Get latest tag
  TAG='v3.39.0'
  VERSION=${TAG:1}
else
  TAG=v$VERSION
fi

BINARY_URL=https://github.com/serverless/serverless/releases/download/$TAG/serverless-$PLATFORM-$ARCH

# Download binary
BINARIES_DIR_PATH=$HOME/.serverless/bin
BINARY_PATH=$BINARIES_DIR_PATH/serverless
mkdir -p $BINARIES_DIR_PATH
printf "$yellow Downloading binary for version $VERSION...$reset\n"

version_error_msg (){
  echo "Could not download binary. Is the version correct?"
}
trap version_error_msg ERR
curl --fail -L -o $BINARY_PATH.tmp $BINARY_URL
trap - ERR
mv $BINARY_PATH.tmp $BINARY_PATH
chmod +x $BINARY_PATH

# Ensure aliases
ln -sf serverless $BINARIES_DIR_PATH/sls

# Add to $PATH
SOURCE_STR="# Added by serverless binary installer\nexport PATH=\"\$HOME/.serverless/bin:\$PATH\"\n"
add_to_path () {
  command printf "\n$SOURCE_STR" >> "$1"
  printf "\n$yellow Added the following to $1:\n\n$SOURCE_STR$reset"
}
SHELLTYPE="$(basename "/$SHELL")"
if [[ $SHELLTYPE = "fish" ]]; then
  command fish -c 'set -U fish_user_paths $fish_user_paths ~/.serverless/bin'
  printf "\n$yellow Added ~/.serverless/bin to fish_user_paths universal variable$reset."
elif [[ $SHELLTYPE = "zsh" ]]; then
  SHELL_CONFIG=$HOME/.zshrc
  if [ ! -r $SHELL_CONFIG ] || (! `grep -q '.serverless/bin' $SHELL_CONFIG`); then
    add_to_path $SHELL_CONFIG
  fi
else
  SHELL_CONFIG=$HOME/.bashrc
  if [ ! -r $SHELL_CONFIG ] || (! `grep -q '.serverless/bin' $SHELL_CONFIG`); then
    add_to_path $SHELL_CONFIG
  fi
  SHELL_CONFIG=$HOME/.bash_profile
  if [[ -r $SHELL_CONFIG ]]; then
    if [[ ! $(grep -q '.serverless/bin' $SHELL_CONFIG) ]]; then
      add_to_path $SHELL_CONFIG
    fi
  else
    SHELL_CONFIG=$HOME/.bash_login
    if [[ -r $SHELL_CONFIG ]]; then
      if [[ ! $(grep -q '.serverless/bin' $SHELL_CONFIG) ]]; then
        add_to_path $SHELL_CONFIG
      fi
    else
      SHELL_CONFIG=$HOME/.profile
      if [ ! -r $SHELL_CONFIG ] || (! `grep -q '.serverless/bin' $SHELL_CONFIG`); then
        add_to_path $SHELL_CONFIG
      fi
    fi
  fi
fi
