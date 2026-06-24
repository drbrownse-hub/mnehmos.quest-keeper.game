#!/bin/bash
set -euo pipefail
source "$HOME/.cargo/env"
export PKG_CONFIG_PATH="/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
npm install
npm run tauri dev
