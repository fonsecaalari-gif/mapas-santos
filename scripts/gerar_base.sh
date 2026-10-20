#!/usr/bin/env bash
# Simplifica bairros e limite municipal (mantendo as divisas compartilhadas) e gera data/santos-base.js
# Uso: python3 scripts/preparar_dados.py && bash scripts/gerar_base.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes mapshaper@0.6 -i data/build/bairros.geojson data/build/limite.geojson combine-files \
  -simplify 18% visvalingam keep-shapes target=* \
  -clean target=bairros \
  -o format=topojson quantization=60000 target=* data/build/base.topojson
python3 scripts/montar_js.py
