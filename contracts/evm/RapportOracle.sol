// SPDX-License-Identifier: CC-BY-SA-4.0
pragma solidity ^0.8.24;

import {IRapportOracle} from "./interfaces/IRapportOracle.sol";

//
//  Author:   Carlos Delfino
//  Email:    consultoria@carlosdelfino.eti.br
//  WhatsApp: +55 (85) 98520-5490
//

/**
 * @title RapportOracle
 * @notice Contrato conector do Rapport Oracle (modelo Oraclize/Provable).
 * @dev Recebe requisições dos contratos consumidores via `query`, emite
 *      `LogNewQuery` observado pelo middleware off-chain e expõe o `cbAddress`
 *      (carteira relayer) que os consumidores devem exigir no `__callback`.
 *
 *      O contrato não retransmite callbacks: o relayer chama diretamente o
 *      `__callback` do consumidor, que valida `msg.sender == cbAddress()`.
 *
 *      Papéis (ver rules/smartcontracts-deploy.md):
 *      - owner: administrativo (Safe multisig em produção). Ajusta taxas.
 *      - cbAddress/relayer: operacional, sem privilégios administrativos.
 *
 */
contract RapportOracle is IRapportOracle {
    // --- Errors ---
    error RapportOracle__NotOwner();
    error RapportOracle__NotPendingOwner();
    error RapportOracle__ZeroAddress();
    error RapportOracle__InsufficientFee(uint256 required, uint256 sent);
    error RapportOracle__EmptyDatasource();
    error RapportOracle__EmptyArgs();
    error RapportOracle__NothingToWithdraw();

    // --- State ---
    /// @notice Carteira relayer autorizada a executar `__callback` nos consumidores.
    address public immutable cbAddress;
    /// @notice Administrador do conector (transferir para a Safe multisig pós-deploy).
    address public owner;
    /// @notice Candidato a owner em transferência em duas etapas.
    address public pendingOwner;
    /// @notice Taxa base por requisição em wei (0 enquanto o serviço for gratuito).
    uint256 public baseFee;
    /// @notice Nonce global usado na derivação de queryId (garante unicidade).
    uint256 private _nonce;

    // --- Events ---
    /// @notice Emitido quando a titularidade inicia transferência em duas etapas.
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    /// @notice Emitido quando a titularidade é transferida.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    /// @notice Emitido quando a taxa base é alterada.
    event BaseFeeUpdated(uint256 previousFee, uint256 newFee);
    /// @notice Emitido quando o saldo acumulado de taxas é sacado.
    event FeesWithdrawn(address indexed to, uint256 amount);

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert RapportOracle__NotOwner();
        _;
    }

    // --- Constructor ---
    /**
     * @param _cbAddress Endereço do relayer que executará os `__callback`.
     *        Deve corresponder a `EVM_RELAYER_ADDRESS` no `.env`.
     */
    constructor(address _cbAddress) {
        if (_cbAddress == address(0)) revert RapportOracle__ZeroAddress();
        cbAddress = _cbAddress;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // --- External functions ---
    /// @inheritdoc IRapportOracle
    function query(
        uint256 delay,
        string calldata datasource,
        string calldata arg
    ) external payable returns (bytes32 queryId) {
        string[] memory args = new string[](1);
        args[0] = arg;
        return _query(delay, datasource, args);
    }

    /// @inheritdoc IRapportOracle
    function query(
        uint256 delay,
        string calldata datasource,
        string[] calldata args
    ) external payable returns (bytes32 queryId) {
        if (args.length == 0) revert RapportOracle__EmptyArgs();
        return _query(delay, datasource, args);
    }

    /// @inheritdoc IRapportOracle
    function getPrice(string calldata datasource) public view returns (uint256 price) {
        datasource; // datasources têm o mesmo preço na v1
        return baseFee;
    }

    /**
     * @notice Inicia a transferência de titularidade (2 etapas).
     * @param newOwner Novo administrador (Safe multisig em produção).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert RapportOracle__ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Conclui a transferência de titularidade; chamada pelo novo owner.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert RapportOracle__NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /**
     * @notice Ajusta a taxa base por requisição.
     * @param newFee Novo valor em wei (0 = serviço gratuito).
     */
    function setBaseFee(uint256 newFee) external onlyOwner {
        emit BaseFeeUpdated(baseFee, newFee);
        baseFee = newFee;
    }

    /**
     * @notice Saca as taxas acumuladas para um destinatário.
     * @param to Destino dos fundos (tipicamente a Safe).
     */
    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert RapportOracle__ZeroAddress();
        uint256 amount = address(this).balance;
        if (amount == 0) revert RapportOracle__NothingToWithdraw();
        emit FeesWithdrawn(to, amount);
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "RapportOracle: withdraw failed");
    }

    /**
     * @notice Verifica off-chain a assinatura de prova do relayer.
     * @dev A prova é `sign(recover)` de keccak256(abi.encodePacked(queryId, result, consumer))
     *      pelo `cbAddress`. Consumidores podem usá-la para checagem extra.
     * @param queryId Identificador da requisição assinada.
     * @param result Resultado entregue no callback.
     * @param consumer Contrato consumidor de destino.
     * @param proof Assinatura ECDSA (65 bytes, v+rs) produzida pelo relayer.
     * @return valid Verdadeiro se o signatário da prova é o `cbAddress`.
     */
    function verifyProof(
        bytes32 queryId,
        string calldata result,
        address consumer,
        bytes calldata proof
    ) external view returns (bool valid) {
        if (proof.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(proof.offset)
            s := calldataload(add(proof.offset, 32))
            v := byte(0, calldataload(add(proof.offset, 64)))
        }
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(queryId, result, consumer)))
        );
        address signer = ecrecover(digest, v, r, s);
        return signer == cbAddress;
    }

    // --- Internal functions ---
    /**
     * @dev Gera o queryId determinístico, cobra a taxa e emite `LogNewQuery`.
     *      `keccak256(sender, nonce, datasource, args)` — unicidade garantida
     *      pelo nonce global monotônico.
     */
    function _query(
        uint256 delay,
        string calldata datasource,
        string[] memory args
    ) internal returns (bytes32 queryId) {
        if (bytes(datasource).length == 0) revert RapportOracle__EmptyDatasource();
        uint256 fee = getPrice(datasource);
        if (msg.value < fee) revert RapportOracle__InsufficientFee(fee, msg.value);
        queryId = keccak256(abi.encode(msg.sender, _nonce, datasource, args));
        unchecked {
            _nonce++;
        }
        emit LogNewQuery(queryId, msg.sender, delay, block.timestamp + delay, datasource, args);
    }
}
