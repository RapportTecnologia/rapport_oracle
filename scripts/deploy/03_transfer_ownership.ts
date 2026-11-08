/**
 * Transfere a titularidade do RapportOracle para a Safe multisig.
 *
 * @file Fluxo: (1) deployer EOA chama transferOwnership(safe) — pendingOwner;
 *       (2) a Safe executa acceptOwnership() on-chain com assinaturas de
 *       threshold signers coletadas off-chain via protocol-kit.
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { ethers, network } from "hardhat";
import Safe from "@safe-global/protocol-kit";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const DEPLOYMENTS_DIR = join(__dirname, "..", "..", "deployments");

function log(level: string, msg: string, params: Record<string, unknown> = {}) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const extra = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[${ts}] [03_transfer_ownership:${level}] ${level} ${msg} - ${extra}`);
}

async function main() {
  const file = join(DEPLOYMENTS_DIR, `${network.name}.json`);
  const deployments = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const oracleAddress = process.env.EVM_RAPPORT_ORACLE_ADDRESS ?? deployments?.RapportOracle?.address;
  const safeAddress = process.env.EVM_SAFE_ADDRESS ?? deployments?.Safe?.address;
  const deployerKey = process.env.EVM_DEPLOYER_PRIVATE_KEY;
  const signerKeys = [
    process.env.EVM_SAFE_SIGNER_1_PRIVATE_KEY,
    process.env.EVM_SAFE_SIGNER_2_PRIVATE_KEY,
    process.env.EVM_SAFE_SIGNER_3_PRIVATE_KEY,
  ].filter(Boolean) as string[];
  const threshold = Number(process.env.EVM_SAFE_THRESHOLD ?? "2");

  if (!oracleAddress || !safeAddress || !deployerKey || signerKeys.length < threshold) {
    throw new Error(
      "Requer: EVM_RAPPORT_ORACLE_ADDRESS, EVM_SAFE_ADDRESS, EVM_DEPLOYER_PRIVATE_KEY e >= threshold signer keys."
    );
  }
  const rpcUrl = (network.config as { url?: string }).url ?? process.env.POLYGON_AMOY_RPC_URL!;

  // (1) pendingOwner = Safe
  const oracle = await ethers.getContractAt("RapportOracle", oracleAddress);
  const currentOwner = await oracle.owner();
  if (ethers.getAddress(currentOwner) === ethers.getAddress(safeAddress)) {
    log("info", "ownership já transferida para a Safe", { safeAddress });
    return;
  }
  const tx = await oracle.transferOwnership(safeAddress);
  await tx.wait();
  log("info", "pendingOwner definido", { pendingOwner: safeAddress, txHash: tx.hash });

  // (2) Safe executa acceptOwnership() — coleta off-chain de `threshold` assinaturas
  const data = oracle.interface.encodeFunctionData("acceptOwnership");
  let signedTx;
  for (const key of signerKeys.slice(0, threshold)) {
    const safeSdk = await Safe.init({ provider: rpcUrl, signer: key, safeAddress });
    if (!signedTx) {
      signedTx = await safeSdk.createTransaction({
        transactions: [{ to: oracleAddress, value: "0", data }],
      });
    }
    signedTx = await safeSdk.signTransaction(signedTx);
  }
  const executor = await Safe.init({ provider: rpcUrl, signer: signerKeys[0], safeAddress });
  const exec = await executor.executeTransaction(signedTx!);
  const execReceipt = await exec.transactionResponse?.wait();
  log("info", "acceptOwnership executado pela Safe", {
    txHash: exec.hash,
    block: execReceipt?.blockNumber,
    newOwner: await oracle.owner(),
  });

  deployments.Safe = { ...deployments.Safe, isOracleOwner: true, ownershipTx: exec.hash };
  writeFileSync(file, JSON.stringify(deployments, null, 2));
}

main().catch((err) => {
  log("error", "falha na transferência de ownership", { error: err?.message ?? String(err) });
  console.error("\nFallback: execute acceptOwnership() via interface da Safe em https://app.safe.global");
  process.exitCode = 1;
});
