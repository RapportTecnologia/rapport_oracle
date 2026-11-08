/**
 * Testes unitários do conector RapportOracle (Hardhat + ethers v6).
 *
 * @file REQ-EVM-01: query emite LogNewQuery e retorna rqid único.
 *       REQ-EVM-02: taxas baseFee cobradas/ajustáveis pelo owner.
 *       REQ-EVM-03: transferência de titularidade em duas etapas.
 *       REQ-EVM-04: verifyProof valida assinatura do relayer.
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { RapportOracle } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RapportOracle", function () {
  let oracle: RapportOracle;
  let owner: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let consumer: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, relayer, consumer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RapportOracle");
    oracle = await Factory.deploy(relayer.address);
    await oracle.waitForDeployment();
  });

  it("REQ-EVM-01: query(datasource,arg) emite LogNewQuery e retorna rqid", async function () {
    const tx = oracle
      .connect(consumer)
      ["query(uint256,string,string)"](0, "URL", "json(https://example.com).USD");
    await expect(tx)
      .to.emit(oracle, "LogNewQuery")
      .withArgs(
        (v: string) => v.startsWith("0x") && v.length === 66,
        consumer.address,
        0n,
        (v: bigint) => v > 0n,
        "URL",
        ["json(https://example.com).USD"]
      );
  });

  it("REQ-EVM-01: queryIds são únicos entre requisições consecutivas", async function () {
    const q1 = await oracle
      .connect(consumer)
      ["query(uint256,string,string)"].staticCall(0, "URL", "a");
    const q2 = await oracle
      .connect(consumer)
      ["query(uint256,string,string)"].staticCall(0, "URL", "b");
    expect(q1).to.not.equal(q2);
  });

  it("REQ-EVM-01: query com lista de args emite args completos", async function () {
    const args = ["json(x).A", "json(y).B"];
    const tx = oracle
      .connect(consumer)
      ["query(uint256,string,string[])"](60, "URL", args);
    await expect(tx)
      .to.emit(oracle, "LogNewQuery")
      .withArgs((v: string) => v.length === 66, consumer.address, 60n, (v: bigint) => v > 0n, "URL", args);
  });

  it("REQ-EVM-01: query com args vazio reverte EmptyArgs", async function () {
    await expect(
      oracle.connect(consumer)["query(uint256,string,string[])"](0, "URL", [])
    ).to.be.revertedWithCustomError(oracle, "RapportOracle__EmptyArgs");
  });

  it("REQ-EVM-01: query com datasource vazio reverte EmptyDatasource", async function () {
    await expect(
      oracle.connect(consumer)["query(uint256,string,string)"](0, "", "x")
    ).to.be.revertedWithCustomError(oracle, "RapportOracle__EmptyDatasource");
  });

  it("REQ-EVM-02: getPrice retorna 0 por padrão", async function () {
    expect(await oracle.getPrice("URL")).to.equal(0n);
  });

  it("REQ-EVM-02: baseFee cobrada na query e sacável pelo owner", async function () {
    const fee = ethers.parseEther("0.001");
    await oracle.setBaseFee(fee);
    await expect(
      oracle.connect(consumer)["query(uint256,string,string)"](0, "URL", "x", { value: fee - 1n })
    ).to.be.revertedWithCustomError(oracle, "RapportOracle__InsufficientFee");
    await oracle.connect(consumer)["query(uint256,string,string)"](0, "URL", "x", { value: fee });
    const before = await ethers.provider.getBalance(consumer.address);
    await oracle.withdrawFees(consumer.address);
    expect(await ethers.provider.getBalance(consumer.address)).to.equal(before + fee);
  });

  it("REQ-EVM-02: setBaseFee só pelo owner", async function () {
    await expect(oracle.connect(consumer).setBaseFee(1n)).to.be.revertedWithCustomError(
      oracle,
      "RapportOracle__NotOwner"
    );
  });

  it("REQ-EVM-03: transferência de ownership em duas etapas", async function () {
    await oracle.transferOwnership(consumer.address);
    await expect(oracle.connect(owner).acceptOwnership()).to.be.revertedWithCustomError(
      oracle,
      "RapportOracle__NotPendingOwner"
    );
    await expect(oracle.connect(consumer).acceptOwnership())
      .to.emit(oracle, "OwnershipTransferred")
      .withArgs(owner.address, consumer.address);
    expect(await oracle.owner()).to.equal(consumer.address);
  });

  it("REQ-EVM-04: verifyProof valida assinatura ECDSA do relayer", async function () {
    const queryId = ethers.keccak256(ethers.toUtf8Bytes("q1"));
    const result = "3123.45";
    const digest = ethers.keccak256(
      ethers.solidityPacked(["bytes32", "string", "address"], [queryId, result, consumer.address])
    );
    const proof = await relayer.signMessage(ethers.getBytes(digest));
    expect(await oracle.verifyProof(queryId, result, consumer.address, proof)).to.equal(true);
    const badProof = await owner.signMessage(ethers.getBytes(digest));
    expect(await oracle.verifyProof(queryId, result, consumer.address, badProof)).to.equal(false);
    expect(await oracle.verifyProof(queryId, result, consumer.address, "0x1234")).to.equal(false);
  });

  it("REQ-EVM-03: constructor rejeita cbAddress zero", async function () {
    const Factory = await ethers.getContractFactory("RapportOracle");
    await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      oracle,
      "RapportOracle__ZeroAddress"
    );
  });
});
