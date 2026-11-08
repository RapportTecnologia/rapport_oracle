![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Security%20Checklist&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_security-checklist)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Security Checklist — Rapport Oracle

**Última revisão:** 2026-11-08 — Responsável: Devin (agente)

Arquivo espelho obrigatório conforme `rules/smartcontracts-solidity-security.md`.

## Modelo de ameaça

- **Ativos:** taxas acumuladas no conector; integridade das respostas do oracle;
  autoridade administrativa (Safe) e operacional (relayer/cbAddress).
- **Ameaças:** callback forjado (mitigado por `require(msg.sender == cbAddress)`
  + `verifyProof`); reentrância no saque de taxas; query replay (mitigado por
  nonce no queryId); frontrunning de `acceptOwnership` (mitigado por 2 etapas);
  resposta maliciosa da fonte externa (risco inerente ao modelo Oraclize —
  mitigar com provas em versões futuras).

## Checklist de segurança (26 seções — itens verificados marcados)

| # | Item | Status |
|---|---|---|
| 1 | Checks-Effects-Interactions respeitado | [x] `_query` emite após estado; `withdrawFees` zera via `call` único após emit |
| 2 | ReentrancyGuard em chamadas externas | [x] sem calls externas a contratos arbitrários (consumidor recebe via relayer) |
| 3 | Access control em funções administrativas | [x] `onlyOwner`, `onlyRapportOracle`, 2-step ownership |
| 4 | Validação de inputs | [x] `EmptyDatasource`, `EmptyArgs`, `ZeroAddress`, `InsufficientFee` |
| 5 | Custom errors | [x] todos os reverts |
| 6 | Eventos em mutações | [x] `LogNewQuery`, `Ownership*`, `BaseFeeUpdated`, `FeesWithdrawn` |
| 7 | Sem `tx.origin` | [x] |
| 8 | Sem `delegatecall`/`selfdestruct` | [x] |
| 9 | Assembly auditado | [x] apenas `ecrecover` em `verifyProof` (read-only, retorna bool) |
| 10 | Sem dados pessoais on-chain | [x] |
| 11 | `block.timestamp` não crítico | [x] `executeAfter` é aproximação por design |
| 12 | Overflow | [x] solc 0.8.24; `unchecked` apenas no incremento de nonce |
| 13 | Multisig para admin | [x] Safe 2-de-3 `0x8Cd4C6...87dD` é owner em Amoy |
| 14 | Relayer sem privilégios admin | [x] `cbAddress` imutável, só chama `__callback` |
| 15 | Chaves fora do repo | [x] `.env` gitignored |
| 16 | Bytecode reprodutível | [x] solc 0.8.24, optimizer 200 |
| 17 | Testes: unit + integração + fuzz + invariant | [x] 23 Hardhat + 12 Foundry (256 runs fuzz) |
| 18 | Slither/solhint sem alertas não justificados | [x] configs criadas; relatório em `reports/` |
| 19 | Verificação no explorador | [ ] pendente (Polygonscan Amoy) |
| 20 | Timelock | [ ] mainnet (checklist de produção) |
| 21 | Pausa | [ ] avaliar necessidade — documentado como melhoria |
| 22 | Prova forte (TLSNotary/zk) | [ ] roadmap — v1 usa assinatura do relayer |
| 23 | Rate limit de queries | [ ] roadmap |
| 24 | Monitoramento de eventos | [x] middleware /status |
| 25 | Resposta a incidentes | [x] `fail`/`complete` pelo relayer em Solana/Stellar |
| 26 | Auditoria externa | [ ] antes de mainnet (contratos controlam taxas) |

## Invariantes documentadas

1. Todo `queryId` é único (nonce global monotônico no keccak).
2. `cbAddress` é imutável após deploy — só o owner muda indiretamente via redeploy.
3. `owner` só muda via `transferOwnership` + `acceptOwnership` pelo novo owner.
4. `msg.value < baseFee` sempre reverte.

## Prioridades específicas do projeto

- [ ] Verificação do contrato no Polygonscan Amoy.
- [ ] Endpoint RPC secundário configurado (`POLYGON_AMOY_RPC_URL_FALLBACK`).
- [ ] Deploy equivalente em mainnet só após auditoria externa.

## Histórico de revisões

| Data | Responsável | Alterações |
|---|---|---|
| 2026-11-08 | Devin | Checklist inicial pós-deploy Amoy |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
