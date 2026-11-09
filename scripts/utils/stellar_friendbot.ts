/**
 * Solicitação de fundos via Friendbot para contas Stellar (testnet/futurenet).
 *
 * @file Chama o Friendbot (HTTP GET) para criar e financiar com XLM de teste
 *       as contas STELLAR_DEPLOYER_ADDRESS / STELLAR_RELAYER_ADDRESS do .env,
 *       além de endereços G... avulsos passados na linha de comando. Após cada
 *       solicitação consulta o Horizon para reportar o saldo nativo resultante
 *       — a confirmação final é o saldo na rede, não apenas o HTTP 200 do
 *       Friendbot (que pode responder 400/429 para conta já financiada).
 *
 *       Executado via tsx, sem @stellar/stellar-sdk: Friendbot e Horizon são
 *       APIs REST simples. A mainnet (pubnet) não possui Friendbot e é
 *       recusada explicitamente.
 *
 * Uso:
 *   npx tsx scripts/utils/stellar_friendbot.ts                # testnet, contas do .env
 *   npx tsx scripts/utils/stellar_friendbot.ts futurenet      # futurenet, contas do .env
 *   npx tsx scripts/utils/stellar_friendbot.ts testnet GABC...
 *   npm run faucet:stellar
 *   npm run faucet:stellar -- futurenet
 *
 * Códigos de saída: 0 = todas as contas terminam financiadas; 1 = erro de
 * uso/argumento (rede inválida, sem endereços); 2 = ao menos uma conta ficou
 * sem saldo após a tentativa (Friendbot indisponível, rate limit ou Horizon
 * inacessível).
 *
 * Author:  Carlos Delfino
 * Email:   consultoria@carlosdelfino.eti.br
 * WhatsApp: +55 (85) 98520-5490
 */
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "..", "..", ".env") });

/** Rede Stellar com Friendbot disponível. */
interface FriendbotNet {
  /** Identificador curto usado na linha de comando ("testnet", "futurenet"). */
  id: string;
  /** Nome de exibição. */
  name: string;
  /** URL base do Friendbot da rede. */
  friendbot: string;
  /** Variáveis de ambiente com o Horizon, em ordem de prioridade. */
  horizonEnvKeys: string[];
  /** Horizon público usado quando nenhuma variável de ambiente está definida. */
  defaultHorizon: string;
}

const NETWORKS: FriendbotNet[] = [
  {
    id: "testnet",
    name: "Stellar Testnet",
    friendbot: "https://friendbot.stellar.org",
    horizonEnvKeys: ["STELLAR_HORIZON_URL", "STELLAR_TESTNET_HORIZON_URL"],
    defaultHorizon: "https://horizon-testnet.stellar.org",
  },
  {
    id: "futurenet",
    name: "Stellar Futurenet",
    friendbot: "https://friendbot-futurenet.stellar.org",
    horizonEnvKeys: ["STELLAR_FUTURENET_HORIZON_URL"],
    defaultHorizon: "https://horizon-futurenet.stellar.org",
  },
];

/** Public key Stellar em StrKey base32: "G" + 55 chars do alfabeto A-Z2-7. */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** Decimais do XLM nativo (stroops). */
const XLM_DECIMALS = 7;

/** Contas do .env financiadas quando nenhum endereço avulso é informado. */
const ENV_ACCOUNTS: Array<{ key: string; role: string }> = [
  { key: "STELLAR_DEPLOYER_ADDRESS", role: "deployer (contratos Soroban)" },
  { key: "STELLAR_RELAYER_ADDRESS", role: "relayer (callbacks)" },
];

/** Conta alvo de uma solicitação de funding. */
interface Target {
  address: string;
  label: string;
}

function log(level: string, scope: string, msg: string, params: Record<string, unknown> = {}) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const extra = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[${ts}] [stellar_friendbot:${scope}] ${level} ${msg}${extra ? " - " + extra : ""}`);
}

/** Normaliza um identificador de rede para comparação (lowercase, só alfanumérico). */
function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Resolve o Horizon da rede: primeiro env definida, senão o default público. */
function resolveHorizon(net: FriendbotNet): string {
  for (const key of net.horizonEnvKeys) {
    const url = process.env[key];
    if (url) return url;
  }
  return net.defaultHorizon;
}

/**
 * Saldo nativo (XLM) de uma conta via Horizon, em unidades principais.
 *
 * @returns Saldo em XLM como string; "0" quando a conta não existe (404).
 * @throws Error em falha de rede ou resposta Horizon inesperada.
 */
async function stellarBalanceXlm(horizonUrl: string, address: string): Promise<string> {
  const res = await fetch(`${horizonUrl}/accounts/${address}`);
  if (res.status === 404) return "0";
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { balances?: Array<{ asset_type: string; balance: string }> };
  return json.balances?.find((b) => b.asset_type === "native")?.balance ?? "0";
}

/**
 * Solicita funding de uma conta ao Friendbot.
 *
 * @param friendbotUrl - URL base do Friendbot da rede.
 * @param address - Public key da conta a financiar.
 * @returns Objeto com ok (HTTP 2xx), status HTTP e hash da transação quando
 *          presente na resposta. Respostas não-2xx (ex.: 400 conta já
 *          financiada, 429 rate limit) não lançam — a decisão final é do
 *          saldo consultado no Horizon.
 */
async function requestFunding(
  friendbotUrl: string,
  address: string,
): Promise<{ ok: boolean; status: number; hash?: string }> {
  const res = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(address)}`);
  let hash: string | undefined;
  const body = await res.text();
  try {
    const json = JSON.parse(body) as { hash?: string; successful?: boolean };
    hash = json.hash;
  } catch {
    // corpo não-JSON (ex.: página de erro do rate limit) — apenas o status importa
  }
  return { ok: res.ok, status: res.status, hash };
}

/** Imprime o uso do comando. */
function printUsage(): void {
  console.log(`\nUso: npx tsx scripts/utils/stellar_friendbot.ts [testnet|futurenet] [G...]

Sem endereços, financia as contas do .env: ${ENV_ACCOUNTS.map((a) => a.key).join(", ")}.
A mainnet (pubnet) não possui Friendbot — financie por transferência real de XLM.

Exemplos:
  npm run faucet:stellar                      # testnet, contas do .env
  npm run faucet:stellar -- futurenet         # futurenet, contas do .env
  npx tsx scripts/utils/stellar_friendbot.ts testnet GABC...`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const extraAddresses: string[] = [];
  const netInputs: string[] = [];
  for (const arg of args) {
    if (STELLAR_ADDRESS_RE.test(arg)) extraAddresses.push(arg);
    else netInputs.push(arg);
  }

  if (netInputs.length > 1) {
    log("error", "main", "informe apenas uma rede alvo", { inputs: netInputs.join(",") });
    printUsage();
    process.exitCode = 1;
    return;
  }

  const netInput = normalize(netInputs[0] ?? "testnet");
  if (["pubnet", "mainnet", "stellarmainnet", "stellarpubnet", "public"].includes(netInput)) {
    log("error", "main", "Friendbot não existe na mainnet (pubnet)", { input: netInputs[0] });
    printUsage();
    process.exitCode = 1;
    return;
  }
  const net =
    NETWORKS.find((n) => normalize(n.id) === netInput) ??
    NETWORKS.find((n) => normalize(n.name) === netInput);
  if (!net) {
    log("error", "main", "rede não reconhecida", { input: netInputs[0] });
    printUsage();
    process.exitCode = 1;
    return;
  }

  const targets: Target[] =
    extraAddresses.length > 0
      ? extraAddresses.map((address) => ({ address, label: "endereço avulso" }))
      : ENV_ACCOUNTS.filter((a) => process.env[a.key]).map((a) => ({
          address: process.env[a.key]!,
          label: `${a.key} — ${a.role}`,
        }));

  if (targets.length === 0) {
    log("error", "main", "nenhuma conta alvo definida", {
      missing: ENV_ACCOUNTS.map((a) => a.key).join(","),
    });
    printUsage();
    process.exitCode = 1;
    return;
  }

  const horizon = resolveHorizon(net);
  log("info", "main", "iniciando solicitações de faucet", {
    network: net.id,
    friendbot: net.friendbot,
    horizon,
    accounts: targets.length,
  });

  let failures = 0;
  for (const { address, label } of targets) {
    try {
      const result = await requestFunding(net.friendbot, address);
      const balance = await stellarBalanceXlm(horizon, address);
      const funded = Number(balance) > 0;
      if (!funded) failures++;
      console.log(
        `  ${funded ? "OK " : "FALTA"} ${address}  ${balance.padStart(12)} XLM` +
          `  friendbot HTTP ${result.status}${result.hash ? `  tx ${result.hash}` : ""}` +
          `  — ${label}`,
      );
      if (!result.ok && funded) {
        log("warn", "main", "friendbot recusou mas a conta já está financiada", {
          network: net.id,
          address,
          status: result.status,
        });
      }
    } catch (err) {
      failures++;
      log("error", "main", "falha ao financiar conta", {
        network: net.id,
        address,
        error: (err as Error)?.message ?? String(err),
      });
    }
  }

  if (failures > 0) {
    log("error", "main", "contas sem saldo após a tentativa", {
      network: net.id,
      failures,
      hint: `${net.friendbot}?addr=<G...>`,
    });
    process.exitCode = 2;
    return;
  }
  log("info", "main", "todas as contas financiadas", { network: net.id, accounts: targets.length });
}

main().catch((err) => {
  log("error", "main", "falha na solicitação de faucet", { error: err?.message ?? String(err) });
  process.exitCode = 1;
});
