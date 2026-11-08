![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Requirements&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_requirements)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# REQUIREMENTS — Rapport Oracle Smart Contracts

Fonte viva de requisitos do subprojeto `smartcontracts`.

## Requisitos funcionais

| ID | Requisito | Status | Teste |
|---|---|---|---|
| REQ-EVM-01 | `query(delay, datasource, arg)` emite `LogNewQuery` e retorna `rqid` único | ✅ | `RapportOracle.test.ts`, `RapportOracle.t.sol` (fuzz) |
| REQ-EVM-02 | Taxa base configurável pelo owner e sacável | ✅ | idem |
| REQ-EVM-03 | Ownership em duas etapas; admin sob multisig Safe | ✅ | idem + deploy Amoy |
| REQ-EVM-04 | `verifyProof` valida assinatura ECDSA do relayer | ✅ | idem |
| REQ-LIB-01 | Lib `usingRapportOracle` self-contained com helpers de parse/string | ✅ | `usingRapportOracle.test.ts`, `RapportOracleLib.t.sol` |
| REQ-LIB-02 | Lib importável via `github.com/rapporttecnologia/rapport_oracle/...` | ✅ | caminho `contracts/evm/lib/rapportOracle.sol` na `main` |
| REQ-LIB-03 | `__callback` exige `msg.sender == rapport_oracle_cbAddress()` | ✅ | exemplos testados |
| REQ-SOL-01 | Programa Anchor `rapport_oracle` com `query` → PDA + evento | ✅ | `anchor build` |
| REQ-SOL-02 | SDK `rapport_oracle_sdk` com `require_cb_authority` + parse | ✅ | idem |
| REQ-XLM-01 | Contrato Soroban `rapport-oracle` com `query` → `BytesN<32>` + evento | ✅ | `cargo build wasm32v1-none` |
| REQ-XLM-02 | Crate `rapport-oracle-lib` com `require_cb_address` + parse | ✅ | idem |
| REQ-DEP-01 | Deploy Amoy + Safe 2-de-3 + transferência de ownership | ✅ | `deployments/polygonAmoy.json` |
| REQ-DEP-02 | Deploy Solana devnet + Stellar testnet prontos para teste | ⏳ | scripts/documentados |

## Requisitos não funcionais

- Solidity `^0.8.24`, custom errors, eventos em mutações de estado.
- Segredos somente em `.env` (gitignored); nunca em código/logs/docs.
- Owner administrativo = Safe multisig (threshold 2-de-3) já na testnet.
- `cbAddress`/relayer operacional sem privilégios administrativos.
- Datasource v1: `"URL"` (`json(url).path` ou URL crua).
- Delay honrado com granularidade do cron do middleware (~1 min).

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Requisitos iniciais |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
