#!/bin/zsh
cd "${0:A:h}"
NODE_BIN="$(command -v node)"
if [[ -z "$NODE_BIN" && -x /usr/local/bin/node ]]; then NODE_BIN=/usr/local/bin/node; fi
if [[ -z "$NODE_BIN" && -x /opt/homebrew/bin/node ]]; then NODE_BIN=/opt/homebrew/bin/node; fi
if [[ -z "$NODE_BIN" ]]; then
  echo 'Maestro needs Node.js 18 or newer. Install Node.js, then reopen this launcher.'
  read -k 1
  exit 1
fi
"$NODE_BIN" server.mjs --open
