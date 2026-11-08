#!/usr/bin/env bash
#
# Executa Slither nos contratos EVM do Rapport Oracle.
#
# Author:  Carlos Delfino
# Email:   consultoria@carlosdelfino.eti.br
# WhatsApp: +55 (85) 98520-5490
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p reports

if ! command -v slither >/dev/null 2>&1; then
  echo "[slither_analyze] slither não instalado; use: pip install slither-analyzer" >&2
  exit 3
fi

slither contracts/evm \
  --config-file slither.config.json \
  --solc-args "--optimize" 2>&1 | tee reports/slither.log

echo "[slither_analyze] relatório em reports/slither.log e reports/slither-report.json"
