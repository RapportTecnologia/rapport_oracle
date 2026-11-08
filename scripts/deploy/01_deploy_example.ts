/**
 * Deploy do consumidor de exemplo EthUsdPrice.
 *
 * @file Implanta o exemplo apontando para o conector registrado em
 *       deployments/<rede>.json (ou EVM_RAPPORT_ORACLE_ADDRESS no .env).
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DEPLOYMENTS_DIR = join(__dirname, "..", "..", "deployments");

function log(level: string, msg: string, params: Record<string, unknown> = {}) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const extra = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[${ts}] [01_deploy_example:${level}] ${level} ${msg} - ${extra}`);
}

async function main() {
  const file = join(DEPLOYMENTS_DIR, `${network.name}.json`);
  const deployments = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const connector = process.env.EVM_RAPPORT_ORACLE_ADDRESS ?? deployments?.RapportOracle?.address;
  if (!connector) {
    throw new Error("Endereço do conector não encontrado (deployments/*.json ou EVM_RAPPORT_ORACLE_ADDRESS).");
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  log("info", "deploy de EthUsdPrice", {
    network: network.name,
    connector,
    deployer: deployer.address,
    balance: ethers.formatEther(balance),
  });

  const Factory = await ethers.getContractFactory("EthUsdPrice");
  const example = await Factory.deploy(connector);
  const receipt = await example.deploymentTransaction()!.wait();
  const address = await example.getAddress();
  log("info", "EthUsdPrice implantado", {
    address,
    txHash: receipt!.hash,
    block: receipt!.blockNumber,
  });

  deployments.EthUsdPrice = {
    address,
    connector,
    deployer: deployer.address,
    txHash: receipt!.hash,
    block: receipt!.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(deployments, null, 2));
  console.log(`\nExemplo: chame update() em ${address} e observe __callback via middleware.`);
}

main().catch((err) => {
  log("error", "falha no deploy do exemplo", { error: err?.message ?? String(err) });
  process.exitCode = 1;
});
