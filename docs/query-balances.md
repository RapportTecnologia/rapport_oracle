---
tags:
  - smartcontracts
  - tutorial
  - evm
  - stellar
  - balances
---

![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Consulta%20de%20Saldos%20por%20Rede&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.RapportOracle.smartcontracts_query-balances)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Language: Portuguese](https://img.shields.io/badge/Language-Portuguese-brightgreen.svg)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Tutorial — Consulta de saldos das carteiras por rede (`query_balances.ts`)

O script `scripts/utils/query_balances.ts` consulta o **saldo nativo** (POL,
SOL, ETH, XLM, etc.) das carteiras do projeto em uma ou mais redes **EVM,
Solana e Stellar**, identificadas por **nome amigável ou chainId** (EVM) /
**cluster** (Solana) / **network** (Stellar). Ele lê as carteiras do `.env`
(deployer, relayer, signers do Safe e o próprio Safe nas EVM; deployer e
relayer na Solana e na Stellar) e também aceita endereços avulsos passados
na linha de comando — `0x...` para EVM, base58 para Solana e `G...` para
Stellar.

Diferente dos scripts `check:balance:amoy` / `check:balance:polygon` — que
rodam via `hardhat run` presos à flag `--network` — este script roda
diretamente via `tsx`, porque o Hardhat não aceita argumentos posicionais
extras após o caminho do script. A Stellar é consultada pela API REST do
**Horizon** (sem `@stellar/stellar-sdk`); uma conta inexistente (HTTP 404)
aparece com saldo zero — na testnet/futurenet ela é criada e financiada pelo
Friendbot (ver seção [Faucet Stellar](#faucet-stellar-friendbot)).

## Pré-requisitos

- Node 22 via NVM (o `.nvmrc` do módulo já fixa a versão):

  ```bash
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use
  ```

- Arquivo `.env` na raiz de `smartcontracts/` com as carteiras e RPCs
  (veja `.env.example`). Apenas os `*_ADDRESS` e `*_RPC_URL` são usados
  por este script — nenhuma chave privada é lida ou necessária.

## Uso básico

Sempre a partir da raiz de `smartcontracts/`:

```bash
# por nome amigável (case-insensitive, ignora espaços e pontuação)
npx tsx scripts/utils/query_balances.ts "Polygon Amoy"

# por chainId (EVM)
npx tsx scripts/utils/query_balances.ts 137

# clusters Solana
npx tsx scripts/utils/query_balances.ts solana devnet

# networks Stellar
npx tsx scripts/utils/query_balances.ts stellar
npx tsx scripts/utils/query_balances.ts futurenet pubnet

# várias redes de uma vez
npx tsx scripts/utils/query_balances.ts "Polygon PoS" "polygon testnet" devnet

# todas as redes conhecidas
npx tsx scripts/utils/query_balances.ts all

# carteiras do .env + endereços avulsos (0x EVM, base58 Solana, G... Stellar)
npx tsx scripts/utils/query_balances.ts 137 0xAbC123...
npx tsx scripts/utils/query_balances.ts devnet 9tnKC511...
npx tsx scripts/utils/query_balances.ts stellar GDEMEVDF...
```

Ou pelo atalho npm (o `--` repassa os argumentos ao script):

```bash
npm run check:balance:net -- "Polygon Amoy"
npm run check:balance:net -- 137 all 0xAbC123...
```

## Redes e aliases reconhecidos

O identificador é normalizado para comparação: letras minúsculas e sem
nenhum caractere que não seja `[a-z0-9]`. Por isso `"Polygon TestNet"`,
`"polygon testnet"` e `"polygon-testnet"` resolvem para a mesma rede.

| Id | Rede | Família | Moeda | Exemplos de nomes aceitos |
|---|---|---|---|---|
| 137 | Polygon PoS | EVM | POL | `polygon`, `polygon pos`, `matic`, `pos` |
| 80002 | Polygon Amoy | EVM | POL | `amoy`, `polygon amoy`, `polygon testnet`, `testnet` |
| 31337 | Hardhat/localhost | EVM | ETH | `hardhat`, `localhost`, `local`, `dev` |
| devnet | Solana Devnet | Solana | SOL | `solana`, `sol`, `solana devnet`, `devnet` |
| testnet | Solana Testnet | Solana | SOL | `solana testnet` |
| mainnet-beta | Solana Mainnet Beta | Solana | SOL | `solana mainnet`, `mainnet beta` |
| testnet | Stellar Testnet | Stellar | XLM | `stellar`, `xlm`, `stellar testnet` |
| futurenet | Stellar Futurenet | Stellar | XLM | `futurenet`, `stellar futurenet` |
| pubnet | Stellar Pubnet | Stellar | XLM | `pubnet`, `stellar mainnet`, `stellar pubnet` |

> **Nota:** neste projeto `solana`/`sol` resolvem para a **devnet**, pois
> `SOLANA_RPC_URL` aponta para ela; `stellar`/`xlm` resolvem para a
> **testnet**, pois `STELLAR_HORIZON_URL` aponta para ela. As mainnets são
> sempre explícitas (`solana mainnet`/`mainnet beta`, `pubnet`/`stellar
> mainnet`). O alias `testnet` sozinho continua resolvendo para a Polygon
> Amoy — para a Stellar use `stellar testnet` ou `xlm`.

Endereços avulsos são detectados pelo formato: `0x` + 40 hex vai para as
redes EVM; base58 de 32-44 caracteres vai para os clusters Solana; `G` +
55 caracteres base32 (StrKey) vai para as networks Stellar. Um endereço só
é consultado nas redes da própria família.

### Redes genéricas por chainId

Qualquer chainId EVM pode ser consultado definindo um RPC no `.env`:

```dotenv
RPC_URL_1=https://eth.llamarpc.com
RPC_URL_56=https://bsc-dataseed.binance.org
```

```bash
npx tsx scripts/utils/query_balances.ts 1 56
```

A lista completa de aliases aparece ao rodar o script sem argumentos
(ou com um nome desconhecido), junto com o `next step` sugerido.

## Carteiras consultadas

Os endereços são lidos do `.env`, com um mínimo recomendado por papel
(herdado da política pré-deploy do `check_balance.ts`):

| Variável | Família | Papel | Mínimo |
|---|---|---|---|
| `EVM_DEPLOYER_ADDRESS` | EVM | deploy conector + exemplo + Safe | 0.5 |
| `EVM_RELAYER_ADDRESS` | EVM | callbacks `__callback` | 0.2 |
| `EVM_SAFE_SIGNER_1..3_ADDRESS` | EVM | signers do Safe | 0 |
| `EVM_SAFE_ADDRESS` | EVM | multisig Safe | 0 |
| `SOLANA_DEPLOYER_ADDRESS` | Solana | deploy de programas/PDAs | 0.5 |
| `SOLANA_RELAYER_ADDRESS` | Solana | callbacks | 0.2 |
| `STELLAR_DEPLOYER_ADDRESS` | Stellar | deploy de contratos Soroban | 5 |
| `STELLAR_RELAYER_ADDRESS` | Stellar | callbacks | 2 |

Variáveis não definidas aparecem como `-- não definido no .env`, sem erro.
Na Stellar, uma conta ainda não financiada (inexistente no Horizon) aparece
como `FALTA` com saldo `0.0` — use o [Friendbot](#faucet-stellar-friendbot)
para criá-la na testnet/futurenet.

## Ordem de resolução do RPC e fallback

Para cada rede o script tenta os RPCs nesta ordem, parando no primeiro
que responder:

1. variáveis de ambiente definidas no `.env`, na ordem da tabela
   (`POLYGON_RPC_URL`, `POLYGON_AMOY_RPC_URL`,
   `POLYGON_AMOY_RPC_URL_FALLBACK`, `LOCALHOST_RPC_URL`, `HARDHAT_RPC_URL`,
   `SOLANA_RPC_URL`, `SOLANA_DEVNET_RPC_URL`, `SOLANA_TESTNET_RPC_URL`,
   `SOLANA_MAINNET_RPC_URL`, `STELLAR_HORIZON_URL`,
   `STELLAR_TESTNET_HORIZON_URL`, `STELLAR_FUTURENET_HORIZON_URL`,
   `STELLAR_PUBNET_HORIZON_URL`, `STELLAR_MAINNET_HORIZON_URL`);
2. endpoints públicos de fallback embutidos no script
   (ex.: `polygon-bor-rpc.publicnode.com`, `api.devnet.solana.com`,
   `solana-rpc.publicnode.com`, `horizon-testnet.stellar.org`).

Cada tentativa gera um log `warn` estruturado; se **todos** os RPCs de uma
rede falharem, o erro é registrado e as demais redes continuam sendo
consultadas.

## Interpretando a saída

```text
Polygon Amoy (chainId 80002) via https://polygon-amoy.drpc.org:
  OK    0x08fa...6472  5.0 POL  (mín 0.5) — deployer
  FALTA 0xf7EE...2B18  0.0 POL  (mín 0.2) — relayer (callbacks __callback)
  --    EVM_SAFE_ADDRESS: não definido no .env
```

- `OK` — saldo ≥ mínimo do papel;
- `FALTA` — saldo abaixo do mínimo (em redes de teste o script aponta as
  faucets ao final do bloco — Amoy, `faucet.solana.com`/`solana airdrop`
  nos clusters Solana, `npm run faucet:stellar`/Friendbot nas networks
  Stellar);
- `--` — variável ausente no `.env`;
- endereços avulsos sempre aparecem como `OK`, sem mínimo associado.

### Códigos de saída

| Código | Significado |
|---|---|
| 0 | todas as redes consultadas com sucesso |
| 1 | erro de uso (sem argumentos ou rede desconhecida) |
| 2 | ao menos uma rede ficou inacessível em todos os RPCs |

Útil em CI: `npm run check:balance:net -- amoy || echo "rede indisponível"`.
`FALTA` de saldo **não** altera o exit code — é um relatório, não um gate.

## Faucet Stellar (Friendbot)

O script `scripts/utils/stellar_friendbot.ts` (atalho `npm run
faucet:stellar`) solicita fundos ao **Friendbot** — o faucet oficial da
Stellar — para as contas `STELLAR_DEPLOYER_ADDRESS` e
`STELLAR_RELAYER_ADDRESS` do `.env`, ou para endereços `G...` avulsos:

```bash
# testnet (default), contas do .env
npm run faucet:stellar

# futurenet, contas do .env
npm run faucet:stellar -- futurenet

# endereço avulso
npx tsx scripts/utils/stellar_friendbot.ts testnet GABC...
```

Diferente de um airdrop EVM/Solana, na Stellar a conta **não existe** até o
primeiro funding — o Friendbot cria a conta já com XLM (10 000 XLM na
testnet). Após cada solicitação o script consulta o Horizon e confirma o
saldo resultante: `OK` quando a conta termina financiada (mesmo que o
Friendbot responda 400/429 por já ter financiado antes), `FALTA` quando o
saldo continua zero. A **pubnet não possui Friendbot** — o script a recusa
explicitamente; financie por transferência real de XLM.

Os códigos de saída seguem o mesmo padrão do `query_balances.ts`: `0`
todas financiadas, `1` erro de uso, `2` alguma conta ficou sem saldo
(Friendbot ou Horizon indisponível, rate limit persistente).

## Erros comuns

| Erro no log | Causa | Ação |
|---|---|---|
| `getaddrinfo ENOTFOUND <rpc>` | DNS não resolve o endpoint | script tenta o próximo RPC; se persistir, ajuste o `*_RPC_URL` no `.env` |
| `401 Unauthorized` / `tenant disabled` | endpoint exige API key | configure um RPC próprio (drpc, Alchemy, Infura) no `.env` |
| `connect ECONNREFUSED 127.0.0.1:8545` | nó local não está rodando | suba `npx hardhat node` antes de consultar `localhost` |
| `rede não reconhecida` | nome/chainId sem alias nem `RPC_URL_<id>` | confira a tabela de aliases ou defina o RPC da chain |
| `HTTP 429` / `RPC -32005` | rate limit do endpoint público | aguarde e repita, ou configure RPC dedicado no `.env` |
| `friendbot HTTP 429` | rate limit do Friendbot | aguarde ~1 min e repita `npm run faucet:stellar` |
| `friendbot HTTP 400` + `OK` | conta já financiada anteriormente | nenhuma — é só a recusa idempotente do Friendbot |

## Segurança e boas práticas

- Nunca passe **chaves privadas** na linha de comando nem as coloque em
  variáveis usadas por este script — ele só precisa de endereços e RPCs.
- Endpoints públicos podem estar fora de sincronia ou com rate limit;
  para operação séria configure RPCs dedicados no `.env`.
- Saldos lidos são apenas informativos; para gates de deploy use
  `npm run check:balance:amoy` / `check:balance:polygon` (exit code 2
  quando abaixo do mínimo).

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Documentação inicial do `query_balances.ts` |
| 2026-11-08 | 0.2.0 | Suporte a clusters Solana (devnet, testnet, mainnet-beta) |
| 2026-11-08 | 0.3.0 | Suporte a networks Stellar (testnet, futurenet, pubnet) via Horizon e script `stellar_friendbot.ts` |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
