/**
 * Verificação de saldos das carteiras do projeto antes de deploys.
 *
 * @file Lê endereços do .env e reporta saldo de cada um com o mínimo
 *       recomendado (deployer ~0.5 POL, relayer ~0.2 POL, signers 0).
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { ethers, network } from "hardhat";

const MINIMUMS: Array<{ key: string; min: string; role: string }> = [
  { key: "EVM_DEPLOYER_ADDRESS", min: "0.5", role: "deployer (deploy conector+exemplo+Safe)" },
  { key: "EVM_RELAYER_ADDRESS", min: "0.2", role: "relayer (callbacks __callback)" },
  { key: "EVM_SAFE_SIGNER_1_ADDRESS", min: "0", role: "signer Safe 1/3" },
  { key: "EVM_SAFE_SIGNER_2_ADDRESS", min: "0", role: "signer Safe 2/3" },
  { key: "EVM_SAFE_SIGNER_3_ADDRESS", min: "0", role: "signer Safe 3/3" },
];

async function main() {
  console.log(`\nSaldos em ${network.name} (chainId ${(await ethers.provider.getNetwork()).chainId}):\n`);
  let missing = false;
  for (const { key, min, role } of MINIMUMS) {
    const address = process.env[key];
    if (!address) {
      console.log(`  ${key}: não definido no .env`);
      continue;
    }
    const balance = await ethers.provider.getBalance(address);
    const ok = balance >= ethers.parseEther(min);
    if (!ok) missing = true;
    console.log(
      `  ${ok ? "OK " : "FALTA"} ${address}  ${ethers.formatEther(balance).padStart(10)} POL  (mín ${min}) — ${role}`
    );
  }
  if (missing) {
    console.log("\nFaucets Amoy: https://faucet.polygon.technology | https://www.alchemy.com/faucets/polygon-amoy");
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`[check_balance] erro: ${err?.message ?? err}`);
  process.exitCode = 1;
});
