/**
 * Consulta de saldos das carteiras do projeto em redes EVM e Solana.
 *
 * @file Resolve a rede a partir de nome amigável ou id (ex.: "Polygon PoS",
 *       137, "Polygon Amoy", "Polygon testnet", "solana", "devnet") e
 *       consulta o saldo nativo das carteiras definidas no .env
 *       (EVM_*_ADDRESS / SOLANA_*_ADDRESS) e de endereços extras passados
 *       na linha de comando (0x... para EVM, base58 para Solana).
 *
 *       Executado via tsx e não via `hardhat run`, porque o Hardhat não
 *       aceita argumentos posicionais extras após o caminho do script.
 *       Solana é consultada por JSON-RPC puro (fetch), sem dependência de
 *       @solana/web3.js.
 *
 * Uso:
 *   npx tsx scripts/utils/query_balances.ts "Polygon Amoy"
 *   npx tsx scripts/utils/query_balances.ts 137
 *   npx tsx scripts/utils/query_balances.ts solana devnet
 *   npx tsx scripts/utils/query_balances.ts "polygon testnet" 0xAbC... 9tnK...
 *   npx tsx scripts/utils/query_balances.ts all
 *   npm run check:balance:net -- "Polygon PoS"
 *
 * Redes fora da tabela podem ser consultadas por chainId numérico (EVM)
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
import { JsonRpcProvider, formatUnits, isAddress, parseUnits } from "ethers";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "..", "..", ".env") });

/** Família de chain suportada — define formato de endereço e RPC. */
type ChainKind = "evm" | "solana";

/** Definição de uma rede consultável. */
interface NetworkDef {
  /** Família da chain: "evm" (ethers/chainId) ou "solana" (JSON-RPC/cluster). */
  kind: ChainKind;
  /** chainId numérico — apenas EVM; usado também para validar o RPC. */
  chainId?: number;
  /** Nome do cluster — apenas Solana (ex.: "devnet", "mainnet-beta"). */
  cluster?: string;
  /** Nome de exibição (ex.: "Polygon PoS", "Solana Devnet"). */
  name: string;
  /** Símbolo da moeda nativa; vazio quando desconhecido (rede genérica). */
  currency: string;
  /** Decimais da moeda nativa (18 EVM, 9 Solana). */
  decimals: number;
  /** Dica de faucet exibida quando alguma carteira fica abaixo do mínimo. */
  faucetHint?: string;
  /** Variáveis de ambiente com RPC, em ordem de prioridade. */
  rpcEnvKeys: string[];
  /** RPCs públicos tentados quando nenhuma variável de ambiente está definida. */
  defaultRpcs: string[];
  /** Apelidos normalizados (lowercase, apenas [a-z0-9]) que resolvem a rede. */
  aliases: string[];
}

const NETWORKS: NetworkDef[] = [
  {
    kind: "evm",
    chainId: 137,
    name: "Polygon PoS",
    currency: "POL",
    decimals: 18,
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
    kind: "evm",
    chainId: 80002,
    name: "Polygon Amoy",
    currency: "POL",
    decimals: 18,
    faucetHint:
      "Faucets Amoy: https://faucet.polygon.technology | https://www.alchemy.com/faucets/polygon-amoy",
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
    kind: "evm",
    chainId: 31337,
    name: "Hardhat/localhost",
    currency: "ETH",
    decimals: 18,
    rpcEnvKeys: ["LOCALHOST_RPC_URL", "HARDHAT_RPC_URL"],
    defaultRpcs: ["http://127.0.0.1:8545"],
    aliases: ["hardhat", "localhost", "local", "dev", "development"],
  },
  {
    kind: "solana",
    cluster: "devnet",
    name: "Solana Devnet",
    currency: "SOL",
    decimals: 9,
    faucetHint:
      "Faucet devnet: https://faucet.solana.com | solana airdrop 1 <endereco> --url devnet",
    rpcEnvKeys: ["SOLANA_RPC_URL", "SOLANA_DEVNET_RPC_URL"],
    defaultRpcs: [
      "https://api.devnet.solana.com",
      "https://solana-devnet-rpc.publicnode.com",
    ],
    aliases: ["solana", "sol", "solanadevnet", "devnet", "solanadev"],
  },
  {
    kind: "solana",
    cluster: "testnet",
    name: "Solana Testnet",
    currency: "SOL",
    decimals: 9,
    faucetHint: "Faucet testnet: https://faucet.solana.com",
    rpcEnvKeys: ["SOLANA_TESTNET_RPC_URL"],
    defaultRpcs: ["https://api.testnet.solana.com"],
    aliases: ["solanatestnet"],
  },
  {
    kind: "solana",
    cluster: "mainnet-beta",
    name: "Solana Mainnet Beta",
    currency: "SOL",
    decimals: 9,
    rpcEnvKeys: ["SOLANA_MAINNET_RPC_URL"],
    defaultRpcs: [
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
    ],
    aliases: ["solanamainnet", "solanamainnetbeta", "mainnetbeta"],
  },
];

/** Carteiras do projeto lidas do .env por família, com mínimo por papel. */
const WALLETS: Record<ChainKind, Array<{ key: string; min: string; role: string }>> = {
  evm: [
    { key: "EVM_DEPLOYER_ADDRESS", min: "0.5", role: "deployer (deploy conector+exemplo+Safe)" },
    { key: "EVM_RELAYER_ADDRESS", min: "0.2", role: "relayer (callbacks __callback)" },
    { key: "EVM_SAFE_SIGNER_1_ADDRESS", min: "0", role: "signer Safe 1/3" },
    { key: "EVM_SAFE_SIGNER_2_ADDRESS", min: "0", role: "signer Safe 2/3" },
    { key: "EVM_SAFE_SIGNER_3_ADDRESS", min: "0", role: "signer Safe 3/3" },
    { key: "EVM_SAFE_ADDRESS", min: "0", role: "multisig Safe" },
  ],
  solana: [
    { key: "SOLANA_DEPLOYER_ADDRESS", min: "0.5", role: "deployer (programas/PDAs)" },
    { key: "SOLANA_RELAYER_ADDRESS", min: "0.2", role: "relayer (callbacks)" },
  ],
};

/** Endereço Solana em base58 (32-44 chars, sem 0/O/I/l). */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Endereços avulsos separados por família de chain. */
interface ExtraAddresses {
  evm: string[];
  solana: string[];
}

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
 * @param input - Texto informado pelo usuário (ex.: "Polygon TestNet", "137", "devnet").
 * @returns NetworkDef da rede ou undefined quando não reconhecido.
 */
function resolveNetwork(input: string): NetworkDef | undefined {
  const norm = normalize(input);
  if (/^\d+$/.test(norm)) return resolveByChainId(Number(norm));
  return NETWORKS.find((n) => n.aliases.includes(norm));
}

/**
 * Resolve rede por chainId: primeiro na tabela conhecida, depois via
 * variável de ambiente RPC_URL_<chainId> para redes EVM genéricas.
 */
function resolveByChainId(chainId: number): NetworkDef | undefined {
  const known = NETWORKS.find((n) => n.kind === "evm" && n.chainId === chainId);
  if (known) return known;
  const rpc = process.env[`RPC_URL_${chainId}`];
  if (!rpc) return undefined;
  return {
    kind: "evm",
    chainId,
    name: `EVM chain ${chainId}`,
    currency: "",
    decimals: 18,
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

/** Rótulo da rede para o relatório: "chainId 137" (EVM) ou "cluster devnet" (Solana). */
function netLabel(net: NetworkDef): string {
  return net.kind === "evm" ? `chainId ${net.chainId}` : `cluster ${net.cluster}`;
}

/**
 * Chamada JSON-RPC genérica a um endpoint Solana.
 *
 * @param rpcUrl - Endpoint HTTP do cluster.
 * @param method - Método JSON-RPC (ex.: "getVersion", "getBalance").
 * @param params - Parâmetros posicionais do método.
 * @returns Campo `result` da resposta.
 * @throws Error quando o RPC responde `error` ou falha de rede/HTTP.
 */
async function solanaRpc(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { result?: unknown; error?: { code: number; message: string } };
  if (json.error) throw new Error(`RPC ${json.error.code}: ${json.error.message}`);
  return json.result;
}

/** Saldo de uma conta Solana em lamports (inteiro). */
async function solanaBalanceLamports(rpcUrl: string, address: string): Promise<bigint> {
  const result = (await solanaRpc(rpcUrl, "getBalance", [address])) as { value: number };
  return BigInt(result?.value ?? 0);
}

/**
 * Consulta os saldos das carteiras em uma rede, tentando cada RPC candidato.
 *
 * @param net - Rede resolvida.
 * @param extras - Endereços avulsos classificados por família.
 * @returns true quando a consulta foi concluída, false se todos os RPCs falharam.
 */
async function queryNetwork(net: NetworkDef, extras: ExtraAddresses): Promise<boolean> {
  const candidates = rpcCandidates(net);
  for (const url of candidates) {
    try {
      if (net.kind === "solana") {
        await solanaRpc(url, "getVersion");
        const getBalance = (addr: string) => solanaBalanceLamports(url, addr);
        await reportBalances(net, url, getBalance, extras.solana);
      } else {
        const provider = new JsonRpcProvider(url, net.chainId, { staticNetwork: true });
        await provider.getBlockNumber();
        const getBalance = (addr: string) => provider.getBalance(addr);
        await reportBalances(net, url, getBalance, extras.evm);
      }
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
    label: netLabel(net),
    tried: candidates.length,
  });
  return false;
}

/**
 * Imprime o relatório de saldos de uma rede já conectada.
 *
 * @param net - Rede consultada (define carteiras, decimais e moeda).
 * @param rpcUrl - Endpoint que respondeu, exibido no cabeçalho do bloco.
 * @param getBalance - Função que retorna o saldo inteiro em unidades mínimas.
 * @param extraAddresses - Endereços avulsos da mesma família da rede.
 */
async function reportBalances(
  net: NetworkDef,
  rpcUrl: string,
  getBalance: (address: string) => Promise<bigint>,
  extraAddresses: string[],
): Promise<void> {
  const unit = net.currency ? ` ${net.currency}` : "";
  console.log(`\n${net.name} (${netLabel(net)}) via ${rpcUrl}:`);
  let missing = false;
  for (const { key, min, role } of WALLETS[net.kind]) {
    const address = process.env[key];
    if (!address) {
      console.log(`  --    ${key}: não definido no .env`);
      continue;
    }
    const balance = await getBalance(address);
    const ok = balance >= parseUnits(min, net.decimals);
    if (!ok) missing = true;
    console.log(
      `  ${ok ? "OK " : "FALTA"} ${address}  ${formatUnits(balance, net.decimals).padStart(10)}${unit}  (mín ${min}) — ${role}`,
    );
  }
  for (const address of extraAddresses) {
    const balance = await getBalance(address);
    console.log(`  OK    ${address}  ${formatUnits(balance, net.decimals).padStart(10)}${unit}  — endereço avulso`);
  }
  if (missing && net.faucetHint) console.log(`  ${net.faucetHint}`);
}

/** Imprime o uso do comando e a tabela de redes/aliases conhecidos. */
function printUsage(): void {
  console.log(`\nUso: npx tsx scripts/utils/query_balances.ts <rede|chainId|all> [outras redes|endereços]

Exemplos:
  npx tsx scripts/utils/query_balances.ts "Polygon Amoy"
  npx tsx scripts/utils/query_balances.ts 137
  npx tsx scripts/utils/query_balances.ts solana devnet
  npx tsx scripts/utils/query_balances.ts "polygon testnet" 0xAbC... 9tnK...

Endereços avulsos são detectados pelo formato: 0x... (EVM) ou base58 (Solana).

Redes conhecidas:`);
  for (const n of NETWORKS) {
    const id = n.kind === "evm" ? String(n.chainId) : n.cluster ?? "";
    console.log(`  ${id.padStart(11)}  ${n.name.padEnd(20)} aliases: ${n.aliases.join(", ")}`);
  }
  console.log(`  <chainId>  rede EVM genérica via RPC_URL_<chainId> no .env`);
}

/** Separa argumentos posicionais em identificadores de rede e endereços por família. */
function parseArgs(argv: string[]): { inputs: string[]; extras: ExtraAddresses } {
  const inputs: string[] = [];
  const extras: ExtraAddresses = { evm: [], solana: [] };
  for (const arg of argv) {
    if (isAddress(arg)) extras.evm.push(arg);
    else if (SOLANA_ADDRESS_RE.test(arg)) extras.solana.push(arg);
    else inputs.push(arg);
  }
  return { inputs, extras };
}

async function main(): Promise<void> {
  const { inputs, extras } = parseArgs(process.argv.slice(2));
  if (inputs.length === 0 && extras.evm.length === 0 && extras.solana.length === 0) {
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
    const key = `${net.kind}:${net.chainId ?? net.cluster}`;
    if (!targets.some((t) => `${t.kind}:${t.chainId ?? t.cluster}` === key)) targets.push(net);
  }

  // Endereços avulsos sem rede explícita: consulta a rede default de cada família.
  if (targets.length === 0) {
    if (extras.evm.length > 0) targets.push(NETWORKS[0]);
    if (extras.solana.length > 0) targets.push(NETWORKS.find((n) => n.kind === "solana")!);
  }

  let failures = 0;
  for (const net of targets) {
    if (!(await queryNetwork(net, extras))) failures++;
  }
  if (failures > 0) process.exitCode = 2;
}

main().catch((err) => {
  log("error", "main", "falha na consulta de saldos", { error: err?.message ?? String(err) });
  process.exitCode = 1;
});
