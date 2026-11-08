// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

import {usingRapportOracle} from "../lib/rapportOracle.sol";

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title MultiQueryExample
 * @notice Exemplo de consumidor com múltiplas requisições simultâneas.
 * @dev Demonstra o uso do `rqid` para despachar respostas: cada query
 *      registrada é associada a um propósito e o `__callback` direciona o
 *      resultado pelo identificador, como no modelo Oraclize/Provable.
 *
 */
contract MultiQueryExample is usingRapportOracle {
    enum Purpose {
        EthUsd,
        BtcUsd,
        EurUsd
    }

    /// @notice Propósito associado a cada rqid pendente.
    mapping(bytes32 => Purpose) public purposeOf;
    /// @notice Últimos resultados crus por propósito (índice = uint8(Purpose)).
    string[3] public lastResult;

    /// @notice Emitido quando uma requisição é registrada.
    event QueryRegistered(bytes32 indexed queryId, Purpose purpose);
    /// @notice Emitido quando o resultado chega no callback.
    event ResultArrived(bytes32 indexed queryId, Purpose purpose, string result);

    constructor(address connector) {
        if (connector != address(0)) {
            rapport_oracle_setConnector(connector);
        }
    }

    /**
     * @notice Emite três requisições distintas de uma vez.
     * @return rqids Os três identificadores retornados pelo oracle.
     */
    function requestAll() public returns (bytes32[3] memory rqids) {
        string
            memory base = "json(https://min-api.cryptocompare.com/data/price?fsym=";
        string memory tail = "&tsyms=USD).USD";

        rqids[0] = _register(rapport_oracle_query(0, "URL", strConcat(base, "ETH", tail)), Purpose.EthUsd);
        rqids[1] = _register(rapport_oracle_query(0, "URL", strConcat(base, "BTC", tail)), Purpose.BtcUsd);
        rqids[2] = _register(rapport_oracle_query(0, "URL", strConcat(base, "EUR", tail)), Purpose.EurUsd);
    }

    /// @notice Callback do oracle — despacha o resultado pelo rqid registrado.
    function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public override {
        require(msg.sender == rapport_oracle_cbAddress(), "Apenas oracle da rapport pode usar esta funcao");
        _proof; // prova disponível para verificação adicional via RapportOracle.verifyProof
        Purpose purpose = purposeOf[_queryId];
        lastResult[uint8(purpose)] = _result;
        delete purposeOf[_queryId];
        emit ResultArrived(_queryId, purpose, _result);
    }

    /// @dev Registra o propósito do rqid e emite evento de auditoria.
    function _register(bytes32 rqid, Purpose purpose) internal returns (bytes32) {
        purposeOf[rqid] = purpose;
        emit QueryRegistered(rqid, purpose);
        return rqid;
    }
}
