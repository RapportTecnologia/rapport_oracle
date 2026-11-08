// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

/*
 * Rapport Oracle API — biblioteca para contratos consumidores (modelo Oraclize/Provable).
 *
 * Importável diretamente do GitHub:
 *
 *   import "github.com/rapporttecnologia/rapport_oracle/contracts/evm/lib/rapportOracle.sol";
 *
 * Este arquivo é intencionalmente self-contained (sem imports externos) para
 * funcionar com resolvedores de import via URL (Remix, hardhat-remix, etc.).
 *
 * Fluxo:
 *   1. O consumidor chama `rapport_oracle_query(delay, datasource, arg)` que
 *      encaminha ao contrato conector `RapportOracle` e retorna um `rqid`.
 *   2. O middleware observa o evento `LogNewQuery`, resolve a requisição
 *      off-chain (ex.: fetch de `json(<url>).<path>`) e chama de volta o
 *      `__callback(rqid, result, proof)` do consumidor a partir do cbAddress.
 *   3. O consumidor deve exigir `msg.sender == rapport_oracle_cbAddress()`.
 *
 */

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title IRapportOracleConnector
 * @notice Interface mínima do conector, embutida para manter a lib self-contained.
 */
interface IRapportOracleConnector {
    function query(
        uint256 delay,
        string calldata datasource,
        string calldata arg
    ) external payable returns (bytes32 queryId);

    function query(
        uint256 delay,
        string calldata datasource,
        string[] calldata args
    ) external payable returns (bytes32 queryId);

    function cbAddress() external view returns (address);

    function getPrice(string calldata datasource) external view returns (uint256 price);
}

/**
 * @title usingRapportOracle
 * @notice Contrato base herdado pelos consumidores do Rapport Oracle.
 * @dev Fornece `rapport_oracle_query*`, `rapport_oracle_cbAddress`, helpers de
 *      parse/string e o contrato `__callback` a ser sobrescrito.
 */
contract usingRapportOracle {
    /// @notice Versão da API da biblioteca (semver).
    string public constant RAPPORT_ORACLE_API_VERSION = "0.1.0";

    /// @dev Instância do conector resolvida no deploy (ou via setConnector).
    IRapportOracleConnector internal _rapportConnector;

    /**
     * @dev Resolve o conector pela tabela `chainId -> endereço`. Redes sem
     *      entrada devem configurar via `rapport_oracle_setConnector` no
     *      constructor do consumidor.
     */
    constructor() {
        address connector = _rapportOracleDefaultConnector(block.chainid);
        if (connector != address(0)) {
            _rapportConnector = IRapportOracleConnector(connector);
        }
    }

    // ------------------------------------------------------------------
    // Resolução do conector
    // ------------------------------------------------------------------

    /**
     * @notice Tabela de conectores oficiais por chainId.
     * @dev Mantida pela Rapport Tecnologia a cada deploy. Retorna address(0)
     *      quando a rede não possui conector registrado.
     * @param chainId Identificador EIP-155 da rede.
     */
    function _rapportOracleDefaultConnector(uint256 chainId) internal pure returns (address) {
        if (chainId == 80002) {
            // Polygon Amoy testnet — conector oficial Rapport Oracle.
            return 0x28A50C31D01B62d4E253058d94fE133B99451a29;
        }
        if (chainId == 137) {
            // Polygon mainnet — pendente de deploy oficial.
            return address(0);
        }
        return address(0);
    }

    /**
     * @notice Define/substitui o endereço do conector a ser usado.
     * @dev Chamar no constructor do consumidor quando a rede não estiver na
     *      tabela (ex.: redes locais, fork, deploy próprio do conector).
     * @param connector Endereço do `RapportOracle` na rede alvo.
     */
    function rapport_oracle_setConnector(address connector) internal {
        require(connector != address(0), "RapportOracle: connector zero");
        _rapportConnector = IRapportOracleConnector(connector);
    }

    /**
     * @notice Endereço do conector efetivamente configurado.
     */
    function rapport_oracle_connector() internal view returns (address) {
        return address(_rapportConnector);
    }

    /**
     * @notice Endereço autorizado a chamar `__callback` (relayer do oracle).
     * @dev Equivalente ao `oraclize_cbAddress()` do Oraclize/Provable.
     * @return addr cbAddress lido on-chain do conector.
     */
    function rapport_oracle_cbAddress() internal view returns (address addr) {
        return _rapportConnector.cbAddress();
    }

    /**
     * @notice Preço em wei cobrado por uma query no datasource informado.
     * @param datasource Fonte de dados (ex.: "URL").
     * @return price Valor em wei a enviar como msg.value na query (0 na v1).
     */
    function rapport_oracle_getPrice(string memory datasource) internal view returns (uint256 price) {
        return _rapportConnector.getPrice(datasource);
    }

    // ------------------------------------------------------------------
    // Modificadores de segurança para o callback
    // ------------------------------------------------------------------

    /**
     * @dev Restringe a função ao cbAddress oficial do oracle.
     *      Alternativa ao `require(msg.sender == rapport_oracle_cbAddress())`.
     */
    modifier onlyRapportOracle() {
        require(msg.sender == rapport_oracle_cbAddress(), "RapportOracle: caller is not the oracle relayer");
        _;
    }

    // ------------------------------------------------------------------
    // rapport_oracle_query — criação de requisições
    // ------------------------------------------------------------------

    /**
     * @notice Cria uma requisição ao oracle com um único argumento.
     * @param delay Segundos mínimos até a execução off-chain (0 = imediata;
     *        granularidade efetiva definida pelo middleware).
     * @param datasource Fonte de dados (ex.: "URL").
     * @param arg Argumento (ex.: "json(https://api.com/data).USD").
     * @return rqid Identificador único da requisição (request query id).
     */
    function rapport_oracle_query(
        uint256 delay,
        string memory datasource,
        string memory arg
    ) internal returns (bytes32 rqid) {
        return _rapportConnector.query(delay, datasource, arg);
    }

    /// @notice Sobrecarga com dois argumentos.
    function rapport_oracle_query(
        uint256 delay,
        string memory datasource,
        string memory arg1,
        string memory arg2
    ) internal returns (bytes32 rqid) {
        string[] memory args = new string[](2);
        args[0] = arg1;
        args[1] = arg2;
        return _rapportConnector.query(delay, datasource, args);
    }

    /// @notice Sobrecarga com três argumentos.
    function rapport_oracle_query(
        uint256 delay,
        string memory datasource,
        string memory arg1,
        string memory arg2,
        string memory arg3
    ) internal returns (bytes32 rqid) {
        string[] memory args = new string[](3);
        args[0] = arg1;
        args[1] = arg2;
        args[2] = arg3;
        return _rapportConnector.query(delay, datasource, args);
    }

    /// @notice Sobrecarga com quatro argumentos.
    function rapport_oracle_query(
        uint256 delay,
        string memory datasource,
        string memory arg1,
        string memory arg2,
        string memory arg3,
        string memory arg4
    ) internal returns (bytes32 rqid) {
        string[] memory args = new string[](4);
        args[0] = arg1;
        args[1] = arg2;
        args[2] = arg3;
        args[3] = arg4;
        return _rapportConnector.query(delay, datasource, args);
    }

    /// @notice Sobrecarga com cinco argumentos.
    function rapport_oracle_query(
        uint256 delay,
        string memory datasource,
        string memory arg1,
        string memory arg2,
        string memory arg3,
        string memory arg4,
        string memory arg5
    ) internal returns (bytes32 rqid) {
        string[] memory args = new string[](5);
        args[0] = arg1;
        args[1] = arg2;
        args[2] = arg3;
        args[3] = arg4;
        args[4] = arg5;
        return _rapportConnector.query(delay, datasource, args);
    }

    /**
     * @notice Cria uma requisição com lista dinâmica de argumentos.
     * @param delay Segundos mínimos até a execução.
     * @param datasource Fonte de dados.
     * @param args Lista de argumentos.
     * @return rqid Identificador único da requisição.
     */
    function rapport_oracle_query(
        uint256 delay,
        string memory datasource,
        string[] memory args
    ) internal returns (bytes32 rqid) {
        return _rapportConnector.query(delay, datasource, args);
    }

    // ------------------------------------------------------------------
    // Callback — sobrescrever no consumidor
    // ------------------------------------------------------------------

    /**
     * @notice Callback invocado pelo relayer do oracle com o resultado.
     * @dev Implementação default (vazia) seguindo o modelo do Provable;
     *      o consumidor sobrescreve e valida o remetente:
     *
     *      function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public override {
     *          require(msg.sender == rapport_oracle_cbAddress(), "Apenas oracle da rapport pode usar esta funcao");
     *          // ...usar _result
     *      }
     *
     * @param _queryId rqid da requisição original.
     * @param _result Resultado serializado em string.
     * @param _proof Prova/assinatura produzida pelo relayer (v1: ECDSA sobre o resultado).
     */
    function __callback(bytes32 _queryId, string memory _result, bytes memory _proof) public virtual {
        _queryId;
        _result;
        _proof;
    }

    // ------------------------------------------------------------------
    // Helpers de conversão/parse (conjunto clássico do Oraclize/Provable)
    // ------------------------------------------------------------------

    /**
     * @notice Converte string numérica em uint256 (sem casas decimais).
     * @param _a String de entrada (ex.: "12345").
     * @return n Valor inteiro extraído; para no primeiro caractere não numérico.
     */
    function parseInt(string memory _a) internal pure returns (uint256 n) {
        return parseInt(_a, 0);
    }

    /**
     * @notice Converte string decimal em inteiro escalado (`parseFloat * 10^_b`).
     * @dev Ex.: parseInt("123.45", 2) == 12345.
     * @param _a String de entrada.
     * @param _b Casas decimais a preservar como fator de escala.
     * @return n Inteiro escalado resultante.
     */
    function parseInt(string memory _a, uint256 _b) internal pure returns (uint256 n) {
        bytes memory bresult = bytes(_a);
        uint256 mint = 0;
        bool decimals = false;
        for (uint256 i = 0; i < bresult.length; i++) {
            if ((uint8(bresult[i]) >= 48) && (uint8(bresult[i]) <= 57)) {
                if (decimals) {
                    if (_b == 0) {
                        break;
                    } else {
                        _b--;
                    }
                }
                mint *= 10;
                mint += uint256(uint8(bresult[i])) - 48;
            } else if (uint8(bresult[i]) == 46) {
                decimals = true;
            }
        }
        if (_b > 0) {
            mint *= 10 ** _b;
        }
        return mint;
    }

    /**
     * @notice Converte uma string hexadecimal "0x..." em address.
     * @param _a String de 42 caracteres com prefixo 0x.
     * @return addr Endereço decodificado.
     */
    function parseAddr(string memory _a) internal pure returns (address addr) {
        bytes memory tmp = bytes(_a);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) b1 -= 87;
            else if ((b1 >= 65) && (b1 <= 70)) b1 -= 55;
            else if ((b1 >= 48) && (b1 <= 57)) b1 -= 48;
            if ((b2 >= 97) && (b2 <= 102)) b2 -= 87;
            else if ((b2 >= 65) && (b2 <= 70)) b2 -= 55;
            else if ((b2 >= 48) && (b2 <= 57)) b2 -= 48;
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    /**
     * @notice Converte string hexadecimal em bytes32.
     * @param source String hex sem prefixo (até 64 chars).
     */
    function parseBytes32(string memory source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }

    /**
     * @notice Converte uint256 em string decimal.
     * @param _i Inteiro de entrada.
     */
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        return string(bstr);
    }

    /**
     * @notice Compara duas strings por keccak256.
     * @return equal Verdadeiro quando idênticas.
     */
    function strcmp(string memory _a, string memory _b) internal pure returns (bool equal) {
        return keccak256(bytes(_a)) == keccak256(bytes(_b));
    }

    /**
     * @notice Índice da primeira ocorrência de `_needle` em `_haystack` ou -1.
     * @return pos Índice base-0 ou int256(-1) quando ausente.
     */
    function indexOf(string memory _haystack, string memory _needle) internal pure returns (int256 pos) {
        bytes memory h = bytes(_haystack);
        bytes memory n = bytes(_needle);
        if (n.length < 1 || h.length < 1 || (n.length > h.length)) {
            return -1;
        } else if (h.length > (2 ** 128 - 1)) {
            return -1;
        }
        uint256 subindex = 0;
        for (uint256 i = 0; i < h.length; i++) {
            if (h[i] == n[0]) {
                subindex = 1;
                while (subindex < n.length && (i + subindex) < h.length && h[i + subindex] == n[subindex]) {
                    subindex++;
                }
                if (subindex == n.length) {
                    return int256(i);
                }
            }
        }
        return -1;
    }

    /**
     * @notice Extrai substring de `_str` entre `_startIndex` (incl.) e `_endIndex` (excl.).
     */
    function substring(
        string memory _str,
        uint256 _startIndex,
        uint256 _endIndex
    ) internal pure returns (string memory) {
        bytes memory strBytes = bytes(_str);
        bytes memory result = new bytes(_endIndex - _startIndex);
        for (uint256 i = _startIndex; i < _endIndex; i++) {
            result[i - _startIndex] = strBytes[i];
        }
        return string(result);
    }

    /**
     * @notice Converte data/hora ISO-8601 ("YYYY-MM-DDTHH:MM:SSZ") em unix timestamp.
     * @param _timestamp String ISO-8601.
     * @return ts Segundos desde 1970-01-01 UTC.
     */
    function parseTimestamp(string memory _timestamp) internal pure returns (uint256 ts) {
        bytes memory b = bytes(_timestamp);
        require(b.length >= 20, "RapportOracle: timestamp too short");
        uint256 year = _substrToUint(b, 0, 4);
        uint256 month = _substrToUint(b, 5, 7);
        uint256 day = _substrToUint(b, 8, 10);
        uint256 hour = _substrToUint(b, 11, 13);
        uint256 minute = _substrToUint(b, 14, 16);
        uint256 second = _substrToUint(b, 17, 19);
        uint256 tsDays = _daysFromEpoch(year, month, day);
        return tsDays * 86400 + hour * 3600 + minute * 60 + second;
    }

    // ------------------------------------------------------------------
    // strConcat — concatenação de strings (overloads 2..5)
    // ------------------------------------------------------------------

    function strConcat(string memory _a, string memory _b) internal pure returns (string memory) {
        bytes memory ba = bytes(_a);
        bytes memory bb = bytes(_b);
        string memory ret = new string(ba.length + bb.length);
        bytes memory bret = bytes(ret);
        uint256 k = 0;
        for (uint256 i = 0; i < ba.length; i++) {
            bret[k++] = ba[i];
        }
        for (uint256 i = 0; i < bb.length; i++) {
            bret[k++] = bb[i];
        }
        return ret;
    }

    function strConcat(string memory _a, string memory _b, string memory _c) internal pure returns (string memory) {
        return strConcat(strConcat(_a, _b), _c);
    }

    function strConcat(
        string memory _a,
        string memory _b,
        string memory _c,
        string memory _d
    ) internal pure returns (string memory) {
        return strConcat(strConcat(_a, _b), strConcat(_c, _d));
    }

    function strConcat(
        string memory _a,
        string memory _b,
        string memory _c,
        string memory _d,
        string memory _e
    ) internal pure returns (string memory) {
        return strConcat(strConcat(strConcat(_a, _b), strConcat(_c, _d)), _e);
    }

    // ------------------------------------------------------------------
    // Internos
    // ------------------------------------------------------------------

    function _substrToUint(bytes memory _b, uint256 _start, uint256 _end) private pure returns (uint256 v) {
        for (uint256 i = _start; i < _end; i++) {
            uint8 c = uint8(_b[i]);
            require(c >= 48 && c <= 57, "RapportOracle: bad timestamp digit");
            v = v * 10 + (c - 48);
        }
    }

    /**
     * @dev Dias desde 1970-01-01 para (ano, mês, dia) — algoritmo
     *      `days_from_civil` de Howard Hinnant (mesmo das libs de datetime).
     */
    function _daysFromEpoch(uint256 year, uint256 month, uint256 day) private pure returns (uint256 days_) {
        require(year >= 1970, "RapportOracle: year < 1970");
        int256 y = int256(year);
        int256 m = int256(month);
        int256 d = int256(day);
        if (m <= 2) {
            y -= 1;
        }
        int256 era = (y >= 0 ? y : y - 399) / 400;
        int256 yoe = y - era * 400;
        int256 mp = (m + 9) % 12;
        int256 doy = ((153 * mp) + 2) / 5 + d - 1;
        int256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        int256 dayCount = era * 146097 + doe - 719468;
        require(dayCount >= 0, "RapportOracle: date before epoch");
        return uint256(dayCount);
    }
}
