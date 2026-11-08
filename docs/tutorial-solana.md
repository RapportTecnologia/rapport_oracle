![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Tutorial%20Solana&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_tutorial-solana)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Tutorial Solana — Como usar o Rapport Oracle

Guia para consumir o Rapport Oracle em programas Anchor (Solana).

## 1. Dependência

```toml
[dependencies]
rapport_oracle_sdk = { git = "https://github.com/rapporttecnologia/rapport_oracle",
                       subdirectory = "contracts/solana/lib/rapport_oracle_sdk",
                       features = ["cpi"] }
```

## 2. Enviar uma query (CPI)

```rust
let cpi_ctx = CpiContext::new(
    ctx.accounts.oracle_program.to_account_info(),
    rapport_oracle_sdk::cpi_request_accounts(
        ctx.accounts.oracle_config.to_account_info(),
        ctx.accounts.query_account.to_account_info(),
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ),
);
rapport_oracle_sdk::rapport_oracle_query(cpi_ctx, 0, "URL".into(), vec!["json(<url>).USD".into()])?;
```

O `rqid` (32 bytes) é emitido no evento `QueryRequested` e gravado na PDA
`query` criada pelo oracle (seeds `["query", requester, nonce]`).

## 3. Receber o callback

```rust
pub fn __callback(ctx: Context<Callback>, query_id: [u8;32], result: String, proof: Vec<u8>) -> Result<()> {
    let config = rapport_oracle_sdk::read_config(&ctx.accounts.oracle_config.to_account_info())?;
    rapport_oracle_sdk::require_cb_authority(&ctx.accounts.oracle_signer, &config)?;
    // usar result — ex.: parse_int_scaled(&result, 2)
    Ok(())
}
```

## 4. Helpers do SDK

`config_pda`, `query_pda`, `read_config`, `require_cb_authority`,
`parse_int_scaled`, `cpi_request_accounts`, `rapport_oracle_query`.

## 5. Build e deploy

```bash
anchor build
anchor keys sync          # sincroniza declare_id! com keypairs em target/deploy
solana config set --url devnet
solana airdrop 2 <deployer>
anchor deploy --provider.cluster devnet
```

Ver exemplo completo em `contracts/solana/programs/example_consumer`.

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Documentação inicial |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
