/**
 * Hardhat configuration — Rapport Oracle (EVM).
 *
 * @file Fontes Solidity em contracts/evm para manter o layout multi-chain
 *       (contracts/evm | contracts/solana | contracts/stellar) exigido pelo
 *       projeto e pelo caminho de import GitHub da biblioteca.
 * @author Carlos Delfino <consultoria@carlosdelfino.eti.br>
 */
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const amoyRpc =
  process.env.POLYGON_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology";
const polygonRpc = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
const deployerKey = process.env.EVM_DEPLOYER_PRIVATE_KEY;
const deployerAccounts = deployerKey ? [deployerKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },
  paths: {
    sources: "./contracts/evm",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygonAmoy: {
      url: amoyRpc,
      chainId: 80002,
      accounts: deployerAccounts,
    },
    polygon: {
      url: polygonRpc,
      chainId: 137,
      accounts: deployerAccounts,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
