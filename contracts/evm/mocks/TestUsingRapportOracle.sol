// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

import {usingRapportOracle} from "../lib/rapportOracle.sol";

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title TestUsingRapportOracle
 * @notice Harness de teste que expõe os helpers internos da biblioteca.
 * @dev Usado apenas em testes (Hardhat/Foundry); não faz parte da API publicada.
 *
 */
contract TestUsingRapportOracle is usingRapportOracle {
    constructor(address connector) {
        if (connector != address(0)) {
            rapport_oracle_setConnector(connector);
        }
    }

    function exposedParseInt(string memory s) external pure returns (uint256) {
        return parseInt(s);
    }

    function exposedParseIntDecimals(string memory s, uint256 d) external pure returns (uint256) {
        return parseInt(s, d);
    }

    function exposedUint2str(uint256 i) external pure returns (string memory) {
        return uint2str(i);
    }

    function exposedParseAddr(string memory a) external pure returns (address) {
        return parseAddr(a);
    }

    function exposedStrcmp(string memory a, string memory b) external pure returns (bool) {
        return strcmp(a, b);
    }

    function exposedIndexOf(string memory h, string memory n) external pure returns (int256) {
        return indexOf(h, n);
    }

    function exposedSubstring(string memory s, uint256 a, uint256 b) external pure returns (string memory) {
        return substring(s, a, b);
    }

    function exposedStrConcat(string memory a, string memory b) external pure returns (string memory) {
        return strConcat(a, b);
    }

    function exposedParseTimestamp(string memory t) external pure returns (uint256) {
        return parseTimestamp(t);
    }

    function exposedCbAddress() external view returns (address) {
        return rapport_oracle_cbAddress();
    }

    function exposedGetPrice(string memory ds) external view returns (uint256) {
        return rapport_oracle_getPrice(ds);
    }

    /// @dev Emite uma query real via conector (para testes de integração).
    function sendQuery(uint256 delay, string memory ds, string memory arg) external returns (bytes32) {
        return rapport_oracle_query(delay, ds, arg);
    }
}
