// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

import {usingRapportOracle} from "../lib/rapportOracle.sol";

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title EthUsdPrice
 * @notice Exemplo canônico de consumidor do Rapport Oracle: preço ETH/USD.
 * @dev Reproduz o fluxo clássico do Oraclize/Provable:
 *      `update()` agenda uma query `json(<url>).USD` e o middleware retorna
 *      o valor no `__callback`, validado via `rapport_oracle_cbAddress()`.
 *
 */
contract EthUsdPrice is usingRapportOracle {
    /// @notice Preço ETH/USD escalado por 100 (ex.: 312345 = US$ 3.123,45).
    uint256 public ethUsd;
    /// @notice rqid da última requisição emitida.
    bytes32 public lastQueryId;
    /// @notice Timestamp do último callback recebido.
    uint256 public lastUpdated;

    /// @notice Emitido quando uma nova requisição é enviada ao oracle.
    event QueryScheduled(bytes32 indexed queryId, string datasource, string arg);
    /// @notice Emitido quando o preço é atualizado pelo callback do oracle.
    event PriceUpdated(bytes32 indexed queryId, uint256 priceCents, string rawResult);

    /**
     * @param connector Endereço do RapportOracle; `address(0)` usa a tabela
     *        de conectores oficiais por chainId da biblioteca.
     */
    constructor(address connector) {
        if (connector != address(0)) {
            rapport_oracle_setConnector(connector);
        }
    }

    /**
     * @notice Agenda a consulta do preço ETH/USD com delay de 10 minutos.
     * @dev O datasource "URL" interpreta `json(<endpoint>).<path>`: o middleware
     *      faz o GET e extrai a propriedade indicada após o último ponto.
     * @return rqid Identificador da requisição, útil para multi-consultas.
     */
    function update() public returns (bytes32 rqid) {
        rqid = rapport_oracle_query(
            60 * 10,
            "URL",
            "json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD,EUR,GBP).USD"
        );
        lastQueryId = rqid;
        emit QueryScheduled(rqid, "URL", "cryptocompare.USD");
    }

    /**
     * @notice Callback do oracle — só o relayer oficial pode invocar.
     * @param _queryId rqid retornado por `update()`.
     * @param _result Resultado em string (ex.: "3123.45").
     * @param _proof Prova assinada pelo relayer (ECDSA do resultado).
     */
    function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public override {
        require(msg.sender == rapport_oracle_cbAddress(), "Apenas oracle da rapport pode usar esta funcao");
        _proof; // prova disponível para verificação adicional via RapportOracle.verifyProof
        ethUsd = parseInt(_result, 2);
        lastUpdated = block.timestamp;
        emit PriceUpdated(_queryId, ethUsd, _result);
    }
}
