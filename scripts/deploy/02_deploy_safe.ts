/**
 * Deploy da Safe multisig 2-de-3 que será a owner administrativa do conector.
 *
 * @file Usa @safe-global/protocol-kit v5 (`createSafeDeploymentTransaction`)
 *       com os 3 signers do .env; grava EVM_SAFE_ADDRESS em
 *       deployments/<rede>.json. Fallback: criar em https://app.safe.global.
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { ethers, network } from "hardhat";
import Safe from "@safe-global/protocol-kit";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DEPLOYMENTS_DIR = join(__dirname, "..", "..", "deployments");

function log(level: string, msg: string, params: Record<string, unknown> = {}) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const extra = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[${ts}] [02_deploy_safe:${level}] ${level} ${msg} - ${extra}`);
}

async function main() {
  const owners = [
    process.env.EVM_SAFE_SIGNER_1_ADDRESS,
    process.env.EVM_SAFE_SIGNER_2_ADDRESS,
    process.env.EVM_SAFE_SIGNER_3_ADDRESS,
  ];
  const threshold = Number(process.env.EVM_SAFE_THRESHOLD ?? "2");
  const deployerKey = process.env.EVM_DEPLOYER_PRIVATE_KEY;
  if (owners.some((o) => !o) || !deployerKey) {
    throw new Error("EVM_SAFE_SIGNER_{1,2,3}_ADDRESS e EVM_DEPLOYER_PRIVATE_KEY são obrigatórios no .env.");
  }
  const rpcUrl = (network.config as { url?: string }).url ?? process.env.POLYGON_AMOY_RPC_URL;

  const saltNonce = BigInt(Date.now()).toString();
  const protocolKit = await Safe.init({
    provider: rpcUrl!,
    signer: deployerKey,
    predictedSafe: {
      safeAccountConfig: { owners: owners as string[], threshold },
      safeDeploymentConfig: { saltNonce, safeVersion: "1.4.1" },
    },
  });
  const predictedAddress = await protocolKit.getAddress();
  log("info", "endereço previsto da Safe", { predictedAddress, owners: owners.join(","), threshold });

  const deploymentTx = await protocolKit.createSafeDeploymentTransaction();
  const [deployer] = await ethers.getSigners();
  const txResponse = await deployer.sendTransaction({
    to: deploymentTx.to,
    value: deploymentTx.value,
    data: deploymentTx.data,
  });
  const receipt = await txResponse.wait();
  log("info", "Safe implantada", {
    safeAddress: predictedAddress,
    txHash: receipt?.hash,
    block: receipt?.blockNumber,
  });

  const file = join(DEPLOYMENTS_DIR, `${network.name}.json`);
  const deployments = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  deployments.Safe = {
    address: predictedAddress,
    owners,
    threshold,
    safeVersion: "1.4.1",
    txHash: receipt?.hash,
    block: receipt?.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(deployments, null, 2));

  console.log(`\nEVM_SAFE_ADDRESS=${predictedAddress} — adicione ao .env e rode npm run transfer:ownership:amoy`);
  console.log("Fallback: a mesma Safe pode ser criada em https://app.safe.global (owners idênticos, threshold 2).");
}

main().catch((err) => {
  log("error", "falha no deploy da Safe", { error: err?.message ?? String(err) });
  process.exitCode = 1;
});
