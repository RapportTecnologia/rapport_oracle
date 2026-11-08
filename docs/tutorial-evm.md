![header](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=Tutorial%20EVM&fontSize=36&fontAlignY=35&animation=twinkling)

![visitors](https://visitor-badge.laobi.icu/badge?page_id=RapportTecnologia.rapport_oracle.docs_tutorial-evm)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-blue.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
![Status](https://img.shields.io/badge/Status-Ongoing-yellow)
[![GitHub Issues](https://img.shields.io/github/issues/RapportTecnologia/rapport_oracle)](https://github.com/RapportTecnologia/rapport_oracle/issues)

# Tutorial EVM — Como usar o Rapport Oracle

Guia para desenvolvedores de smart contracts consumirem o Rapport Oracle em
redes EVM, no modelo Oraclize/Provable.

## 1. Importar a biblioteca

```solidity
import "github.com/rapporttecnologia/rapport_oracle/contracts/evm/lib/rapportOracle.sol";
```

## 2. Contrato consumidor mínimo

```solidity
contract MeuConsumidor is usingRapportOracle {
    uint256 public ethUsd;

    function update() public returns (bytes32 rqid) {
        rqid = rapport_oracle_query(
            60 * 10,
            "URL",
            "json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD).USD"
        );
    }

    function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public override {
        require(msg.sender == rapport_oracle_cbAddress(), "Apenas oracle da rapport pode usar esta funcao");
        ethUsd = parseInt(_result, 2);
    }
}
```

## 3. Como funciona

1. `rapport_oracle_query(delay, datasource, arg)` chama o conector
   `RapportOracle`, emite `LogNewQuery` e retorna um `rqid` único.
2. O middleware observa o evento, espera `delay`, faz o fetch da URL e extrai
   o path JSON (`.USD`).
3. O relayer (`cbAddress`) chama `__callback(rqid, result, proof)` no seu
   contrato. Valide sempre `msg.sender == rapport_oracle_cbAddress()`.

## 4. Datasource "URL"

| Formato | Resultado |
|---|---|
| `json(<url>).<path>` | GET + extrai `<path>` (ex.: `.USD`, `.a.b[0]`) |
| `<url>` (crua) | Corpo da resposta como texto |

## 5. Endereços oficiais

| Rede | chainId | Conector |
|---|---|---|
| Polygon Amoy | 80002 | `0x28A50C31D01B62d4E253058d94fE133B99451a29` |

Redes fora da tabela: passe o conector no constructor e use
`rapport_oracle_setConnector(addr)`.

## 6. Helpers disponíveis

`parseInt`, `parseInt(_,decimals)`, `parseAddr`, `strConcat` (2–5 args),
`uint2str`, `strcmp`, `indexOf`, `substring`, `parseTimestamp`,
`rapport_oracle_getPrice`, `onlyRapportOracle`.

Ver exemplos completos em `contracts/evm/examples/`.

## Changelog

| Data | Versão | Descrição |
|---|---|---|
| 2026-11-08 | 0.1.0 | Documentação inicial |

![footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&height=100&section=footer&animation=twinkling)
