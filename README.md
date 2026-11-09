![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Rapport%20Oracle%20-%20Smart%20Contracts&fontSize=36&fontAlignY=35&animation=twinkling)

[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Rapport Oracle — Smart Contracts

Oracle genérico multi-chain (EVM, Solana, Stellar) no modelo Oraclize/Provable:
contratos conectores on-chain + bibliotecas para desenvolvedores + exemplos.

Em construção — consulte `docs/` para tutoriais e documentação.

## Utilitários

### Consulta de saldos das carteiras

`scripts/utils/query_balances.ts` consulta o saldo nativo das carteiras do
`.env` (deployer, relayer, signers e Safe nas EVM; deployer e relayer na
Solana e na Stellar) em uma ou mais redes, identificadas por nome amigável
ou chainId (EVM) / cluster (Solana) / network (Stellar):

```bash
npm run check:balance:net -- "Polygon Amoy"
npm run check:balance:net -- "Polygon PoS"        # ou 137
npm run check:balance:net -- solana devnet
npm run check:balance:net -- stellar              # ou "stellar testnet", "xlm"
npm run check:balance:net -- "polygon testnet" 0xAbC... 9tnK... GABC...
npm run check:balance:net -- all                  # todas as redes conhecidas
```

Redes conhecidas: Polygon PoS (137), Polygon Amoy (80002), Hardhat/localhost
(31337), Solana Devnet, Solana Testnet, Solana Mainnet Beta, Stellar
Testnet, Stellar Futurenet e Stellar Pubnet. Outras chains EVM podem ser
consultadas pelo chainId definindo `RPC_URL_<chainId>` no `.env`. O script
tenta cada RPC/Horizon configurado e cai para endpoints públicos de fallback
quando o primário falha. Tutorial completo em
[`docs/query-balances.md`](docs/query-balances.md).

Para a checagem atrelada ao `--network` do Hardhat (mesmos mínimos), use
`npm run check:balance:amoy` ou `npm run check:balance:polygon`.

### Faucet Stellar (Friendbot)

`npm run faucet:stellar` financia as contas `STELLAR_*_ADDRESS` do `.env` na
testnet via Friendbot (cria a conta com 10 000 XLM quando ela ainda não
existe). Use `npm run faucet:stellar -- futurenet` para a futurenet; a
pubnet não possui Friendbot.

## Faucets para teste

Precisa de tokens de teste para experimentar o oracle — POL na Polygon
Amoy, SOL na devnet da Solana ou XLM na testnet da Stellar? Solicite
diretamente
[abrindo uma issue neste repositório](https://github.com/RapportTecnologia/rapport_oracle/issues/new?title=Solicita%C3%A7%C3%A3o%20de%20Faucet%20para%20teste&body=Rede%3A%20(ex.%3A%20Polygon%20Amoy%2C%20Solana%20devnet%2C%20Stellar%20testnet)%0AEndere%C3%A7o%20da%20carteira%3A%0AQuantidade%20estimada%3A)
ou pela página [Crypto Faucets](https://rapport.tec.br/crypto-faucets/)
da Rapport.

## Apoie o Projeto — Doação via Pix

O Rapport Oracle é mantido de forma independente. Se o projeto é útil para
você, apoie com uma doação via Pix a título de retribuição e incentivo:
**todo o valor obtido é utilizado para manter as APIs de resposta e custear
os servidores**.

<p align="center">
  <img src="docs/assets/pix-doacao-qrcode.png" alt="QR Code Pix — Doação Rapport Oracle" width="240" />
</p>

- **Chave Pix (CNPJ):** `67.904.299/0001-80`
- **Recebedor:** Rapport Tecnologia
- **Mensagem embutida no QR:** `DOACAO APIS E SERVIDORES RAPPORT ORACLE`
- Valor livre — também é possível doar usando a chave Pix diretamente no
  app do seu banco.

<details>
<summary>Pix copia e cola</summary>

```
00020101021126790014br.gov.bcb.pix0114679042990001800239DOACAO APIS E SERVIDORES RAPPORT ORACLE5204000053039865802BR5918RAPPORT TECNOLOGIA6009FORTALEZA62230519DOACAORAPPORTORACLE63044FBA
```

</details>

O QR Code é gerado por `scripts/generate_pix_qrcode.py` (raiz do monorepo).

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-07 | 0.1.0 | Estrutura inicial do subprojeto |
| 2026-11-08 | 0.1.1 | Script `query_balances.ts` para saldos por nome/chainId de rede |
| 2026-11-08 | 0.1.2 | `query_balances.ts` passa a cobrir Solana (devnet, testnet, mainnet-beta) |
| 2026-11-08 | 0.1.2 | Seção de doação via Pix com QR Code |
| 2026-11-09 | 0.1.3 | `query_balances.ts` passa a cobrir Stellar (testnet, futurenet, pubnet) e script `stellar_friendbot.ts` (`npm run faucet:stellar`) |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
