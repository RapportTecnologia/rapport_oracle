/**
 * Deploy do conector RapportOracle (EVM).
 *
 * @file Implanta o conector com `cbAddress = EVM_RELAYER_ADDRESS`, confere o
 *       saldo do deployer antes de enviar e grava o endereço em
 *       deployments/<rede>.json. Simula a transação via estimateGas antes.
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { ethers, network } from "hardhat";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DEPLOYMENTS_DIR = join(__dirname, "..", "..", "deployments");
const MIN_BALANCE = ethers.parseEther("0.05"); // ~conector ~2-3M gas em Amoy

function log(level: string, msg: string, params: Record<string, unknown> = {}) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const extra = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[${ts}] [00_deploy_oracle:${level}] ${level} ${msg} - ${extra}`);
}

async function main() {
  const relayer = process.env.EVM_RELAYER_ADDRESS;
  if (!relayer) {
    throw new Error("EVM_RELAYER_ADDRESS ausente no .env — defina o cbAddress do oracle.");
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  log("info", "verificando saldo do deployer", {
    network: network.name,
    deployer: deployer.address,
    balance: ethers.formatEther(balance),
    minRequired: ethers.formatEther(MIN_BALANCE),
  });
  if (balance < MIN_BALANCE) {
    throw new Error(
      `Saldo insuficiente: ${ethers.formatEther(balance)} POL < ${ethers.formatEther(MIN_BALANCE)} POL. ` +
        `Alimente ${deployer.address} via faucet (https://faucet.polygon.technology) e rode de novo.`
    );
  }

  const Factory = await ethers.getContractFactory("RapportOracle");
  const deployTx = await Factory.getDeployTransaction(relayer);
  const gasEstimate = await ethers.provider.estimateGas({
    ...deployTx,
    from: deployer.address,
  });
  log("info", "gas estimado do deploy", { gas: gasEstimate.toString() });

  const oracle = await Factory.deploy(relayer);
  const receipt = await oracle.deploymentTransaction()!.wait();
  const address = await oracle.getAddress();
  log("info", "RapportOracle implantado", {
    address,
    txHash: receipt!.hash,
    block: receipt!.blockNumber,
    gasUsed: receipt!.gasUsed.toString(),
    cbAddress: relayer,
  });

  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const file = join(DEPLOYMENTS_DIR, `${network.name}.json`);
  const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  current.RapportOracle = {
    address,
    cbAddress: relayer,
    deployer: deployer.address,
    txHash: receipt!.hash,
    block: receipt!.blockNumber,
    deployedAt: new Date().toISOString(),
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
  };
  writeFileSync(file, JSON.stringify(current, null, 2));
  log("info", "deployment registrado", { file });

  console.log("\nPróximos passos:");
  console.log(`  1. Registrar EVM_RAPPORT_ORACLE_ADDRESS=${address} no .env`);
  console.log("  2. Verificar no explorador: npm run verify:amoy -- <args>");
  console.log("  3. Deploy do exemplo: npm run deploy:example:amoy");
  console.log("  4. Multisig + transferência: npm run deploy:safe:amoy && npm run transfer:ownership:amoy");
}

main().catch((err) => {
  log("error", "falha no deploy", { error: err?.message ?? String(err) });
  process.exitCode = 1;
});
