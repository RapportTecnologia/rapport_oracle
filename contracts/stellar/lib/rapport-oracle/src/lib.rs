//! Biblioteca do desenvolvedor — Rapport Oracle para Stellar/Soroban.
//!
//! Importável via git no `Cargo.toml` do consumidor:
//!
//! ```toml
//! rapport-oracle-lib = { git = "https://github.com/rapporttecnologia/rapport_oracle",
//!                        subdirectory = "contracts/stellar/lib/rapport-oracle" }
//! ```
//!
//! Fluxo:
//!   1. O consumidor chama [`rapport_oracle_query`] → `rqid` (`BytesN<32>`).
//!   2. O middleware resolve off-chain e invoca `__callback` no consumidor
//!      assinando com `cb_address`.
//!   3. O consumidor valida o remetente via [`require_cb_address`].
//!
//! Author:  Carlos Delfino
//! Email:   consultoria@carlosdelfino.eti.br
//! WhatsApp: +55 (85) 98520-5490
#![no_std]

use soroban_sdk::{contractclient, Address, BytesN, Env, String, Vec};

/// Versão da biblioteca (semver).
pub const VERSION: &str = "0.1.0";

/// Client gerado a partir da spec do conector `RapportOracle`.
/// A spec é mantida em sincronia com contracts/stellar/rapport-oracle.
#[contractclient(name = "RapportOracleClient")]
pub trait RapportOracleInterface {
    fn cb_address(env: Env) -> Address;
    fn query(env: Env, requester: Address, delay: u64, datasource: String, args: Vec<String>) -> BytesN<32>;
}

/// Cria uma requisição no conector `oracle` e retorna o `rqid`.
///
/// * `oracle` — endereço do contrato `RapportOracle` na rede.
/// * `requester` — endereço do consumidor (tipicamente `env.current_contract_address()`
///   para que a auth do invocador original propague; ou o endereço do usuário
///   conforme o modelo de autorização do consumidor).
/// * `delay` — segundos mínimos antes da execução.
/// * `datasource` — fonte de dados (ex.: "URL").
/// * `args` — argumentos da requisição.
pub fn rapport_oracle_query(
    env: &Env,
    oracle: &Address,
    requester: &Address,
    delay: u64,
    datasource: String,
    args: Vec<String>,
) -> BytesN<32> {
    let client = RapportOracleClient::new(env, oracle);
    client.query(requester, &delay, &datasource, &args)
}

/// Lê o `cb_address` configurado no conector (equivalente ao `rapport_oracle_cbAddress`).
pub fn rapport_oracle_cb_address(env: &Env, oracle: &Address) -> Address {
    RapportOracleClient::new(env, oracle).cb_address()
}

/// Exige que `caller` seja o `cb_address` do oracle — usar no `__callback`.
///
/// ```rust,ignore
/// pub fn __callback(env: Env, caller: Address, query_id: BytesN<32>, result: String, proof: Bytes) {
///     rapport_oracle_lib::require_cb_address(&env, &caller, &oracle_addr);
///     // ...usar result
/// }
/// ```
pub fn require_cb_address(env: &Env, caller: &Address, oracle: &Address) {
    let expected = rapport_oracle_cb_address(env, oracle);
    assert_eq!(*caller, expected, "RapportOracle: caller is not the cb_address");
    caller.require_auth();
}

/// Parse de string decimal em inteiro escalado (`parseFloat * 10^decimals`),
/// equivalente ao `parseInt(result, decimals)` da biblioteca EVM.
///
/// * `s` — string de entrada (ex.: "3123.45")
/// * `decimals` — casas decimais preservadas como escala
pub fn parse_int_scaled(_env: &Env, s: &String, decimals: u32) -> Option<u128> {
    let bytes = s.to_bytes();
    let mut value: u128 = 0;
    let mut seen_dot = false;
    let mut dec_left = decimals;
    for b in bytes.iter() {
        let c = b as u8;
        if c >= b'0' && c <= b'9' {
            if seen_dot {
                if dec_left == 0 {
                    break;
                }
                dec_left -= 1;
            }
            value = value.checked_mul(10)?.checked_add((c - b'0') as u128)?;
        } else if c == b'.' {
            if seen_dot {
                return None;
            }
            seen_dot = true;
        } else {
            break;
        }
    }
    while dec_left > 0 {
        value = value.checked_mul(10)?;
        dec_left -= 1;
    }
    Some(value)
}
