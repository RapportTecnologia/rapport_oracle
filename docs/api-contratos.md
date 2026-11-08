![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=API%20dos%20Contratos&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_api-contratos)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# API dos Contratos — Rapport Oracle

Referência das superfícies públicas por chain.

## EVM — `RapportOracle` (conector)

| Assinatura | Descrição | Auth |
|---|---|---|
| `query(uint256 delay, string datasource, string arg) payable → bytes32` | Registra requisição; retorna `rqid` | público |
| `query(uint256 delay, string datasource, string[] args) payable → bytes32` | Multi-argumento | público |
| `cbAddress() → address` | Relayer autorizado ao `__callback` | view |
| `getPrice(string datasource) → uint256` | Taxa por query em wei (0 na v1) | view |
| `verifyProof(bytes32, string, address, bytes) → bool` | Valida assinatura do relayer | view |
| `transferOwnership(address)` / `acceptOwnership()` | Ownership 2 etapas | owner / pendingOwner |
| `setBaseFee(uint256)` | Ajusta taxa | owner (Safe) |
| `withdrawFees(address)` | Saca taxas | owner (Safe) |

**Evento:** `LogNewQuery(bytes32 indexed queryId, address indexed sender, uint256 delay, uint256 executeAfter, string datasource, string[] args)`

**Callback do consumidor:** `__callback(bytes32 _queryId, string _result, bytes _proof)` — exige `msg.sender == rapport_oracle_cbAddress()`.

## Solana — programa `rapport_oracle` (Anchor)

| Instrução | Descrição | Auth |
|---|---|---|
| `initialize(cb_authority, base_fee)` | Cria PDA `config` | admin |
| `query(delay, datasource, args)` | Cria PDA `query` + evento `QueryRequested` | público |
| `complete(query_id)` / `fail(query_id)` | Fecha ciclo da query | `cb_authority` |
| `set_cb_authority(new)` / `set_base_fee(fee)` | Admin | admin |

**Callback consumidor:** `__callback(query_id, result, proof)` — exige
`oracle_signer == config.cb_authority` (via SDK `require_cb_authority`).

## Stellar — contrato `rapport-oracle` (Soroban)

| Função | Descrição | Auth |
|---|---|---|
| `initialize(admin, cb_address)` | Inicializa storage | admin |
| `query(requester, delay, datasource, args) → BytesN<32>` | `rqid` + evento `("query", requester, rqid)` | `requester.require_auth()` |
| `complete(query_id)` / `fail(query_id)` | Fecha ciclo | `cb_address.require_auth()` |
| `cb_address() → Address` / `admin() → Address` | Leitura | view |
| `set_cb_address(new)` | Admin | admin |

**Callback consumidor:** `__callback(caller, query_id, result, proof)` — valida
`caller == cb_address` via `require_cb_address` + `require_auth`.

## Datasources (v1)

| Nome | Formato | Resolução |
|---|---|---|
| `URL` | `json(<url>).<path>` | GET + extrai `<path>` |
| `URL` | `<url>` crua | corpo como string |

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Documentação inicial |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
