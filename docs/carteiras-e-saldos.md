![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Carteiras%20e%20Saldos&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_carteiras)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Carteiras e Saldos — Rapport Oracle

Endereços públicos do projeto (chaves privadas somente no `.env`, nunca aqui).

## EVM (Polygon Amoy 80002)

| Papel | Endereço | Saldo mínimo | Uso |
|---|---|---|---|
| Deployer | `0x08faec070183cDE63BE1f62d849a091023846472` | 0.5 POL | deploys de contratos |
| Relayer (`cbAddress`) | `0xf7EEEEB7f8771C53d7E4b5488904E8B5844D2B18` | 0.2 POL | `__callback` nos consumidores |
| Safe signer 1 | `0xd7C8D3AdC632446aC8F95f28f450Ed17adA24eee` | — | owner Safe 1/3 |
| Safe signer 2 | `0x7D99a66a3A3a9E965f994f8E48F7A6Aac6f9F814` | — | owner Safe 2/3 |
| Safe signer 3 | `0xAB2C9Ab2EE8E2220608915416A855865ECdA28FF` | — | owner Safe 3/3 |
| **Safe 2-de-3** | `0x8Cd4C69093428Cf4F73D8eB863950bcd15EA87dD` | — | owner do `RapportOracle` |

Faucets Amoy: https://faucet.polygon.technology · https://www.alchemy.com/faucets/polygon-amoy

## Solana (devnet)

| Papel | Pubkey | Saldo sugerido |
|---|---|---|
| Deployer | `9tnKC511n3TvoXtacaYwxtxsN9Rv7NBD8rsNCg25zkD6` | 2–5 SOL |
| Relayer (`cb_authority`) | `CSAVfNpCExchXhAFV3A8nyQsnnEZ2eaZuYx5ovF3e5Q2` | 0.5 SOL |

Airdrop: `solana airdrop 2 <pubkey> --url devnet` (ou https://faucet.solana.com).

### Programas deployados (devnet)

| Item | Valor |
|---|---|
| `rapport_oracle` | `1pyBQW1biz9AwWGLf8hj3XepnE8TMVsmvEDZCuVQQXV` |
| Config PDA | `Gc8Sq2gtYQyoZJdVcorM93w5ggcJXA7o3e6H8vsr25aL` |
| `example_consumer` | `8wpztkqU6h1SX2efUqdTSxpjKiH6KGSZgMnqbVYCQ6jg` |
| `cb_authority` | relayer, base_fee 0.001 SOL |

## Stellar (testnet)

| Papel | Public Key | Fund |
|---|---|---|
| Deployer | `GDEMEVDF44QG4566MT4IEOMWMBPMOND52JKYN7TBYS75QBLGUVTVJXFD` | Friendbot ✅ |
| Relayer (`cb_address`) | `GCV3T3N5XDKFI2QAXZRSTUFLJPIUJWDTRZJMPSI5OMPS6DRHL6PILTQ6` | Friendbot ✅ |

`stellar keys fund <identidade> --network testnet` cobre automaticamente,
ou `npm run faucet:stellar` (Friendbot direto via HTTP, sem CLI Stellar).

## Endereços on-chain (Amoy, block ~52.3M)

| Contrato | Endereço |
|---|---|
| `RapportOracle` (conector) | `0x28A50C31D01B62d4E253058d94fE133B99451a29` |
| `EthUsdPrice` (exemplo) | `0x74dA3fF51EfA21c6fcF81902a743541850Ae6596` |
| Safe multisig (owner) | `0x8Cd4C69093428Cf4F73D8eB863950bcd15EA87dD` |

## Middleware (Cloudflare Worker)

| Item | Valor |
|---|---|
| URL | `https://rapport-oracle-midleware.consultoria-451.workers.dev` |
| Health | `GET /health` |
| Status | `GET /status` |
| Cron | `* * * * *` (poll do conector Amoy a cada minuto) |
| Estado | MemoryKV por isolate (KV `ORACLE_STATE` pendente de provisionamento) |

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Documentação inicial |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
