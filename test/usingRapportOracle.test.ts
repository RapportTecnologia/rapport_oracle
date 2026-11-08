/**
 * Testes da biblioteca usingRapportOracle e do fluxo de callback.
 *
 * @file REQ-LIB-01: helpers de parse (parseInt, uint2str, strcmp, indexOf,
 *       substring, parseAddr, strConcat, parseTimestamp).
 *       REQ-LIB-02: rapport_oracle_query encaminha ao conector.
 *       REQ-LIB-03: __callback só aceita o cbAddress do conector.
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { RapportOracle, TestUsingRapportOracle, EthUsdPrice, MultiQueryExample } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("usingRapportOracle (lib)", function () {
  let oracle: RapportOracle;
  let lib: TestUsingRapportOracle;
  let relayer: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  beforeEach(async function () {
    [, relayer, other] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("RapportOracle");
    oracle = await Oracle.deploy(relayer.address);
    await oracle.waitForDeployment();
    const Lib = await ethers.getContractFactory("TestUsingRapportOracle");
    lib = await Lib.deploy(await oracle.getAddress());
    await lib.waitForDeployment();
  });

  it("REQ-LIB-01: parseInt sem decimais", async function () {
    expect(await lib.exposedParseInt("12345")).to.equal(12345n);
    expect(await lib.exposedParseInt("0")).to.equal(0n);
  });

  it("REQ-LIB-01: parseInt com escala decimal (preço com casas)", async function () {
    expect(await lib.exposedParseIntDecimals("3123.45", 2)).to.equal(312345n);
    expect(await lib.exposedParseIntDecimals("1.5", 3)).to.equal(1500n);
    expect(await lib.exposedParseIntDecimals("42", 2)).to.equal(4200n);
  });

  it("REQ-LIB-01: uint2str e roundtrip com parseInt", async function () {
    expect(await lib.exposedUint2str(0n)).to.equal("0");
    expect(await lib.exposedUint2str(987654321n)).to.equal("987654321");
    expect(await lib.exposedParseInt(await lib.exposedUint2str(777n))).to.equal(777n);
  });

  it("REQ-LIB-01: strcmp, indexOf e substring", async function () {
    expect(await lib.exposedStrcmp("URL", "URL")).to.equal(true);
    expect(await lib.exposedStrcmp("URL", "WolframAlpha")).to.equal(false);
    expect(await lib.exposedIndexOf("json(x).USD", "USD")).to.equal(8n);
    expect(await lib.exposedIndexOf("abc", "z")).to.equal(-1n);
    expect(await lib.exposedSubstring("json(x).USD", 8, 11)).to.equal("USD");
  });

  it("REQ-LIB-01: parseAddr decodifica hex 0x", async function () {
    const target = relayer.address;
    expect(await lib.exposedParseAddr(target.toLowerCase())).to.equal(target);
    expect(await lib.exposedParseAddr(target)).to.equal(target);
  });

  it("REQ-LIB-01: strConcat junta duas strings", async function () {
    expect(await lib.exposedStrConcat("json(", "x).USD")).to.equal("json(x).USD");
  });

  it("REQ-LIB-01: parseTimestamp converte ISO-8601 para unix", async function () {
    // 2021-09-16T00:00:00Z = 1631750400
    expect(await lib.exposedParseTimestamp("2021-09-16T00:00:00Z")).to.equal(1631750400n);
  });

  it("REQ-LIB-02: rapport_oracle_query emite LogNewQuery no conector", async function () {
    await expect(lib.sendQuery(0, "URL", "json(x).USD")).to.emit(oracle, "LogNewQuery");
  });

  it("REQ-LIB-02: rapport_oracle_getPrice reflete a taxa do conector", async function () {
    expect(await lib.exposedGetPrice("URL")).to.equal(0n);
    await oracle.setBaseFee(1000n);
    expect(await lib.exposedGetPrice("URL")).to.equal(1000n);
  });

  it("REQ-LIB-03: cbAddress lido do conector", async function () {
    expect(await lib.exposedCbAddress()).to.equal(relayer.address);
  });
});

describe("EthUsdPrice (exemplo)", function () {
  it("REQ-LIB-03: __callback aceita apenas o relayer e guarda preço escalado", async function () {
    const [owner, relayer, stranger] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("RapportOracle");
    const oracle = await Oracle.deploy(relayer.address);
    await oracle.waitForDeployment();
    const Price = await ethers.getContractFactory("EthUsdPrice");
    const price = await Price.deploy(await oracle.getAddress());
    await price.waitForDeployment();

    await expect(price.connect(owner).update()).to.emit(price, "QueryScheduled");

    await expect(
      price.connect(stranger).__callback(ethers.ZeroHash, "3123.45", "0x")
    ).to.be.revertedWith("Apenas oracle da rapport pode usar esta funcao");

    const rqid = await price.lastQueryId();
    await expect(price.connect(relayer).__callback(rqid, "3123.45", "0x"))
      .to.emit(price, "PriceUpdated")
      .withArgs(rqid, 312345n, "3123.45");
    expect(await price.ethUsd()).to.equal(312345n);
  });
});

describe("MultiQueryExample (exemplo)", function () {
  it("REQ-LIB-03: despacha resultados por rqid", async function () {
    const [, relayer] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("RapportOracle");
    const oracle = await Oracle.deploy(relayer.address);
    const Multi = await ethers.getContractFactory("MultiQueryExample");
    const multi = await Multi.deploy(await oracle.getAddress());

    const tx = await multi.requestAll();
    const receipt = await tx.wait();
    const registered = receipt!.logs
      .map((l: any) => {
        try {
          return multi.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .filter((e: any) => e && e.name === "QueryRegistered");
    expect(registered.length).to.equal(3);

    const [rqidEth, , rqidEur] = registered.map((e: any) => e.args.queryId);
    await multi.connect(relayer).__callback(rqidEth, "3123.45", "0x");
    await multi.connect(relayer).__callback(rqidEur, "1.08", "0x");

    expect(await multi.lastResult(0)).to.equal("3123.45");
    expect(await multi.lastResult(2)).to.equal("1.08");
  });
});
