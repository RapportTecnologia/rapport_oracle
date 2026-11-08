// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title IRapportOracle
 * @notice Interface pública do contrato conector RapportOracle.
 * @dev Definida separadamente para que a biblioteca `rapportOracle.sol`
 *      (importável via github.com) e outros contratos dependam apenas da
 *      interface, e não da implementação.
 *
 */
interface IRapportOracle {
    /**
     * @notice Emitido quando um consumidor registra uma requisição ao oracle.
     * @dev O middleware observa este evento para resolver a requisição off-chain.
     * @param queryId Identificador único da requisição (rqid).
     * @param sender Contrato consumidor que criou a requisição.
     * @param delay Atraso mínimo em segundos antes da execução pelo middleware.
     * @param executeAfter Timestamp aproximado a partir do qual a requisição
     *        pode ser executada (block.timestamp + delay).
     * @param datasource Fonte de dados requisitada (ex.: "URL").
     * @param args Argumentos da requisição (ex.: "json(<url>).<path>").
     */
    event LogNewQuery(
        bytes32 indexed queryId,
        address indexed sender,
        uint256 delay,
        uint256 executeAfter,
        string datasource,
        string[] args
    );

    /**
     * @notice Registra uma requisição ao oracle com um único argumento.
     * @param delay Atraso mínimo em segundos antes da execução (0 = imediata).
     * @param datasource Fonte de dados (ex.: "URL").
     * @param arg Argumento da requisição (ex.: "json(https://...).USD").
     * @return queryId Identificador único da requisição criada.
     */
    function query(
        uint256 delay,
        string calldata datasource,
        string calldata arg
    ) external payable returns (bytes32 queryId);

    /**
     * @notice Registra uma requisição ao oracle com múltiplos argumentos.
     * @param delay Atraso mínimo em segundos antes da execução (0 = imediata).
     * @param datasource Fonte de dados (ex.: "URL").
     * @param args Lista de argumentos da requisição.
     * @return queryId Identificador único da requisição criada.
     */
    function query(
        uint256 delay,
        string calldata datasource,
        string[] calldata args
    ) external payable returns (bytes32 queryId);

    /**
     * @notice Endereço autorizado a chamar `__callback` nos consumidores.
     * @dev Corresponde à carteira relayer operada pelo middleware. O consumidor
     *      deve exigir `msg.sender == rapport_oracle_cbAddress()` no callback.
     */
    function cbAddress() external view returns (address);

    /**
     * @notice Preço em wei cobrado por requisição em um datasource.
     * @param datasource Fonte de dados consultada.
     * @return price Valor em wei exigido como `msg.value` na query (0 na v1).
     */
    function getPrice(string calldata datasource) external view returns (uint256 price);
}
