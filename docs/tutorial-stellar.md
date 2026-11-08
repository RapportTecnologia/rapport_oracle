![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Tutorial%20Stellar&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_tutorial-stellar)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Tutorial Stellar — Como usar o Rapport Oracle

Guia para consumir o Rapport Oracle em contratos Soroban (Stellar).

## 1. Dependência

```toml
[dependencies]
rapport-oracle-lib = { git = "https://github.com/rapporttecnologia/rapport_oracle",
                       subdirectory = "contracts/stellar/lib/rapport-oracle" }
```

## 2. Enviar uma query

```rust
let rqid = rapport_oracle_lib::rapport_oracle_query(
    &env, &oracle_addr, &requester, 600,
    String::from_str(&env, "URL"),
    vec![&env, String::from_str(&env, "json(https://...).USD")],
);
```

Retorna `BytesN<32>` (rqid); o evento `("query", requester, rqid)` é publicado
para o middleware.

## 3. Receber o callback

```rust
pub fn __callback(env: Env, caller: Address, query_id: BytesN<32>, result: String, proof: Bytes) {
    rapport_oracle_lib::require_cb_address(&env, &caller, &oracle_addr);
    let cents = rapport_oracle_lib::parse_int_scaled(&env, &result, 2).unwrap();
    // usar cents
}
```

`require_cb_address` lê o `cb_address` do conector on-chain, compara com
`caller` e exige `caller.require_auth()`.

## 4. Build e deploy

```bash
cargo build --target wasm32v1-none --release
stellar contract deploy --wasm target/wasm32v1-none/release/rapport_oracle.wasm \
    --source rapport-deployer --network testnet
stellar contract invoke --id <CONTRACT_ID> --source rapport-deployer --network testnet -- \
    initialize --admin <ADMIN> --cb_address <RELAYER>
```

Financiar contas de teste: `stellar keys fund <identidade> --network testnet`
(Friendbot automático).

Ver exemplo completo em `contracts/stellar/example-consumer`.

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Documentação inicial |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
