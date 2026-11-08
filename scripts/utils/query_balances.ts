/**
 * Consulta de saldos das carteiras do projeto em redes EVM por nome ou chainId.
 *
 * @file Resolve a rede a partir de nome amigável ou id numérico (ex.:
 *       "Polygon PoS", 137, "Polygon Amoy", "Polygon testnet",
 *       "Polygon TestNet") e consulta o saldo nativo das carteiras
 *       definidas no .env (deployer, relayer, signers e Safe) e de
 *       endereços extras passados na linha de comando.
 *
 *       Executado via tsx e não via `hardhat run`, porque o Hardhat não
 *       aceita argumentos posicionais extras após o caminho do script.
 *
 * Uso:
 *   npx tsx scripts/utils/query_balances.ts "Polygon Amoy"
 *   npx tsx scripts/utils/query_balances.ts 137
 *   npx tsx scripts/utils/query_balances.ts "polygon testnet" polygon 0xAbC...
 *   npx tsx scripts/utils/query_balances.ts all
 *   npm run check:balance:net -- "Polygon PoS"
 *
 * Redes fora da tabela podem ser consultadas por chainId numérico
 * definindo RPC_URL_<chainId> no .env (ex.: RPC_URL_1=https://eth.llamarpc.com).
 *
 * Códigos de saída: 0 = ok; 1 = erro de uso/argumento; 2 = ao menos uma
 * rede ficou inacessível em todos os RPCs candidatos. Saldo abaixo do
 * mínimo recomendado é sinalizado com "FALTA" mas não altera o exit code.
 *
 * Author:  Carlos Delfino
 * Email:   consultoria@carlosdelfino.eti.br
 * WhatsApp: +55 (85) 98520-5490
 */
import { JsonRpcProvider, formatEther, isAddress, parseEther } from "ethers";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "..", "..", ".env") });

/** Definição de uma rede EVM consultável. */
interface NetworkDef {
  /** chainId numérico da rede; usado também para validar o RPC. */
  chainId: number;
  /** Nome de exibição (ex.: "Polygon PoS"). */
  name: string;
  /** Símbolo da moeda nativa; vazio quando desconhecido (rede genérica). */
  currency: string;
  /** true em testnets/devnets — habilita dica de faucet no relatório. */
  testnet: boolean;
  /** Variáveis de ambiente com RPC, em ordem de prioridade. */
  rpcEnvKeys: string[];
  /** RPCs públicos tentados quando nenhuma variável de ambiente está definida. */
  defaultRpcs: string[];
  /** Apelidos normalizados (lowercase, apenas [a-z0-9]) que resolvem a rede. */
  aliases: string[];
}

const NETWORKS: NetworkDef[] = [
  {
    chainId: 137,
    name: "Polygon PoS",
    currency: "POL",
    testnet: false,
    rpcEnvKeys: ["POLYGON_RPC_URL"],
    defaultRpcs: [
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon-rpc.com",
      "https://1rpc.io/matic",
    ],
    aliases: [
      "polygon", "polygonpos", "pos", "polygonmainnet", "matic",
      "maticmainnet", "polygonmatic", "maticnetwork",
    ],
  },
  {
    chainId: 80002,
    name: "Polygon Amoy",
    currency: "POL",
    testnet: true,
    rpcEnvKeys: ["POLYGON_AMOY_RPC_URL", "POLYGON_AMOY_RPC_URL_FALLBACK"],
    defaultRpcs: [
      "https://rpc-amoy.polygon.technology",
      "https://polygon-amoy-bor-rpc.publicnode.com",
    ],
    aliases: [
      "amoy", "polygonamoy", "polygontestnet", "testnet",
      "amoytestnet", "polygonamoytestnet", "polygontestnetamoy",
    ],
  },
  {
    chainId: 31337,
    name: "Hardhat/localhost",
    currency: "ETH",
    testnet: true,
    rpcEnvKeys: ["LOCALHOST_RPC_URL", "HARDHAT_RPC_URL"],
    defaultRpcs: ["http://127.0.0.1:8545"],
    aliases: ["hardhat", "localhost", "local", "dev", "development"],
  },
];

/** Carteiras do projeto lidas do .env, com mínimo recomendado por papel. */
const WALLETS: Array<{ key: string; min: string; role: string }> = [
  { key: "EVM_DEPLOYER_ADDRESS", min: "0.5", role: "deployer (deploy conector+exemplo+Safe)" },
  { key: "EVM_RELAYER_ADDRESS", min: "0.2", role: "relayer (callbacks __callback)" },
  { key: "EVM_SAFE_SIGNER_1_ADDRESS", min: "0", role: "signer Safe 1/3" },
  { key: "EVM_SAFE_SIGNER_2_ADDRESS", min: "0", role: "signer Safe 2/3" },
  { key: "EVM_SAFE_SIGNER_3_ADDRESS", min: "0", role: "signer Safe 3/3" },
  { key: "EVM_SAFE_ADDRESS", min: "0", role: "multisig Safe" },
];

function log(level: string, scope: string, msg: string, params: Record<string, unknown> = {}) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const extra = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[${ts}] [query_balances:${scope}] ${level} ${msg}${extra ? " - " + extra : ""}`);
}

/** Normaliza um identificador de rede para comparação (lowercase, só alfanumérico). */
function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve um identificador (nome ou chainId) para uma NetworkDef.
 *
 * @param input - Texto informado pelo usuário (ex.: "Polygon TestNet", "137").
 * @returns NetworkDef da rede ou undefined quando não reconhecido.
 */
function resolveNetwork(input: string): NetworkDef | undefined {
  const norm = normalize(input);
  if (/^\d+$/.test(norm)) return resolveByChainId(Number(norm));
  return NETWORKS.find((n) => n.aliases.includes(norm));
}

/**
 * Resolve rede por chainId: primeiro na tabela conhecida, depois via
 * variável de ambiente RPC_URL_<chainId> para redes genéricas.
 */
function resolveByChainId(chainId: number): NetworkDef | undefined {
  const known = NETWORKS.find((n) => n.chainId === chainId);
  if (known) return known;
  const rpc = process.env[`RPC_URL_${chainId}`];
  if (!rpc) return undefined;
  return {
    chainId,
    name: `EVM chain ${chainId}`,
    currency: "",
    testnet: false,
    rpcEnvKeys: [],
    defaultRpcs: [rpc],
    aliases: [],
  };
}

/** Monta a lista de RPCs candidatos: variáveis de ambiente definidas + defaults públicos. */
function rpcCandidates(net: NetworkDef): string[] {
  const urls = net.rpcEnvKeys
    .map((k) => process.env[k])
    .filter((u): u is string => Boolean(u));
  for (const url of net.defaultRpcs) {
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/**
 * Consulta os saldos das carteiras em uma rede, tentando cada RPC candidato.
 *
 * @param net - Rede resolvida.
 * @param extraAddresses - Endereços adicionais informados na linha de comando.
 * @returns true quando a consulta foi concluída, false se todos os RPCs falharam.
 */
async function queryNetwork(net: NetworkDef, extraAddresses: string[]): Promise<boolean> {
  const candidates = rpcCandidates(net);
  for (const url of candidates) {
    const provider = new JsonRpcProvider(url, net.chainId, { staticNetwork: true });
    try {
      await provider.getBlockNumber();
      await reportBalances(net, url, provider, extraAddresses);
      return true;
    } catch (err) {
      log("warn", "queryNetwork", "RPC indisponível, tentando próximo", {
        network: net.name,
        rpc: url,
        error: (err as Error)?.message ?? String(err),
      });
    }
  }
  log("error", "queryNetwork", "todos os RPCs falharam para a rede", {
    network: net.name,
    chainId: net.chainId,
    tried: candidates.length,
  });
  return false;
}

/** Imprime o relatório de saldos de uma rede já conectada. */
async function reportBalances(
  net: NetworkDef,
  rpcUrl: string,
  provider: JsonRpcProvider,
  extraAddresses: string[],
): Promise<void> {
  const unit = net.currency ? ` ${net.currency}` : "";
  console.log(`\n${net.name} (chainId ${net.chainId}) via ${rpcUrl}:`);
  let missing = false;
  for (const { key, min, role } of WALLETS) {
    const address = process.env[key];
    if (!address) {
      console.log(`  --    ${key}: não definido no .env`);
      continue;
    }
    const balance = await provider.getBalance(address);
    const ok = balance >= parseEther(min);
    if (!ok) missing = true;
    console.log(
      `  ${ok ? "OK " : "FALTA"} ${address}  ${formatEther(balance).padStart(10)}${unit}  (mín ${min}) — ${role}`,
    );
  }
  for (const address of extraAddresses) {
    const balance = await provider.getBalance(address);
    console.log(`  OK    ${address}  ${formatEther(balance).padStart(10)}${unit}  — endereço avulso`);
  }
  if (missing && net.testnet) {
    console.log("  Faucets Amoy: https://faucet.polygon.technology | https://www.alchemy.com/faucets/polygon-amoy");
  }
}

/** Imprime o uso do comando e a tabela de redes/aliases conhecidos. */
function printUsage(): void {
  console.log(`\nUso: npx tsx scripts/utils/query_balances.ts <rede|chainId|all> [outras redes|endereços 0x...]

Exemplos:
  npx tsx scripts/utils/query_balances.ts "Polygon Amoy"
  npx tsx scripts/utils/query_balances.ts 137
  npx tsx scripts/utils/query_balances.ts "polygon testnet" 0xAbC...

Redes conhecidas:`);
  for (const n of NETWORKS) {
    console.log(`  ${String(n.chainId).padStart(6)}  ${n.name.padEnd(18)} aliases: ${n.aliases.join(", ")}`);
  }
  console.log(`  <id>   rede genérica via RPC_URL_<chainId> no .env`);
}

/** Separa argumentos posicionais em identificadores de rede e endereços. */
function parseArgs(argv: string[]): { inputs: string[]; addresses: string[] } {
  const inputs: string[] = [];
  const addresses: string[] = [];
  for (const arg of argv) {
    if (isAddress(arg)) addresses.push(arg);
    else inputs.push(arg);
  }
  return { inputs, addresses };
}

async function main(): Promise<void> {
  const { inputs, addresses } = parseArgs(process.argv.slice(2));
  if (inputs.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const targets: NetworkDef[] = [];
  for (const input of inputs) {
    if (normalize(input) === "all") {
      targets.push(...NETWORKS);
      continue;
    }
    const net = resolveNetwork(input);
    if (!net) {
      log("error", "main", "rede não reconhecida", { input });
      printUsage();
      process.exitCode = 1;
      return;
    }
    if (!targets.some((t) => t.chainId === net.chainId)) targets.push(net);
  }

  let failures = 0;
  for (const net of targets) {
    if (!(await queryNetwork(net, addresses))) failures++;
  }
  if (failures > 0) process.exitCode = 2;
}

main().catch((err) => {
  log("error", "main", "falha na consulta de saldos", { error: err?.message ?? String(err) });
  process.exitCode = 1;
});
