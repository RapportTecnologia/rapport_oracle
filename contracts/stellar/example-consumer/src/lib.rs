//! Contrato consumidor de exemplo do Rapport Oracle (Stellar/Soroban).
//!
//! Fluxo idêntico ao exemplo EVM `EthUsdPrice`: `update()` agenda a query
//! `json(<url>).USD` no conector e o middleware devolve o resultado no
//! `__callback`, validado contra o `cb_address` lido do oracle.
//!
//! O crate `rapport-oracle-lib` é importável via git — o Cargo localiza o
//! pacote pelo nome em qualquer subdiretório do repositório:
//!
//! ```toml
//! rapport-oracle-lib = { git = "https://github.com/RapportTecnologia/rapport_oracle",
//!                        branch = "main" }
//! ```
//!
//! Para builds reprodutíveis, substitua `branch` por `rev` ou `tag`.
//!
//! Author:  Carlos Delfino
//! Email:   consultoria@carlosdelfino.eti.br
//! WhatsApp: +55 (85) 98520-5490
#![no_std]

use rapport_oracle_lib as oracle;
use soroban_sdk::{contract, contractimpl, contracterror, contracttype, symbol_short, vec, Address, Bytes, BytesN, Env, String};

/// Chaves de storage do exemplo.
#[contracttype]
pub enum DataKey {
    Oracle,
    Admin,
    PriceCents,
    LastQueryId,
    LastUpdated,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum ConsumerError {
    NotInitialized = 1,
    NotAdmin = 2,
    BadResult = 3,
}

#[contract]
pub struct ExampleConsumer;

#[contractimpl]
impl ExampleConsumer {
    /// Inicializa o consumidor com o endereço do conector oracle.
    pub fn initialize(env: Env, admin: Address, oracle_addr: Address) {
        if env.storage().instance().has(&DataKey::Oracle) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Oracle, &oracle_addr);
    }

    /// Agenda a consulta do preço ETH/USD e retorna o `rqid`.
    ///
    /// O `requester` é o próprio contrato — a auth do invocador original
    /// propaga via `require_auth` no conector.
    pub fn update(env: Env) -> BytesN<32> {
        let oracle_addr: Address = env.storage().instance().get(&DataKey::Oracle).unwrap();
        let requester = env.current_contract_address();
        let rqid = oracle::rapport_oracle_query(
            &env,
            &oracle_addr,
            &requester,
            600,
            String::from_str(&env, "URL"),
            vec![
                &env,
                String::from_str(
                    &env,
                    "json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD).USD",
                ),
            ],
        );
        env.storage().instance().set(&DataKey::LastQueryId, &rqid);
        env.events().publish((symbol_short!("query"), rqid.clone()), ());
        rqid
    }

    /// Callback do oracle — exige `caller` igual ao `cb_address` do conector.
    ///
    /// * `caller` — conta que invocou (o relayer); validada contra o oracle.
    /// * `query_id` — rqid da requisição.
    /// * `result` — resultado serializado (ex.: "3123.45").
    /// * `proof` — assinatura ed25519 do relayer sobre o resultado.
    pub fn __callback(env: Env, caller: Address, query_id: BytesN<32>, result: String, proof: Bytes) -> Result<(), ConsumerError> {
        let oracle_addr: Address = env.storage().instance().get(&DataKey::Oracle).ok_or(ConsumerError::NotInitialized)?;
        oracle::require_cb_address(&env, &caller, &oracle_addr);
        let cents = oracle::parse_int_scaled(&env, &result, 2).ok_or(ConsumerError::BadResult)?;
        env.storage().instance().set(&DataKey::PriceCents, &cents);
        env.storage().instance().set(&DataKey::LastUpdated, &env.ledger().timestamp());
        env.events().publish(
            (symbol_short!("price"), query_id),
            (cents, proof.len()),
        );
        Ok(())
    }

    /// Último preço em centavos recebido via callback.
    pub fn price_cents(env: Env) -> u128 {
        env.storage().instance().get(&DataKey::PriceCents).unwrap_or(0)
    }

    /// rqid da última requisição emitida.
    pub fn last_query_id(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::LastQueryId).unwrap()
    }
}
