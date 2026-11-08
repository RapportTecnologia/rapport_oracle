//! Conector on-chain do Rapport Oracle para Stellar (Soroban).
//!
//! Recebe requisições de contratos consumidores via `query`, registra a query
//! pendente em storage e publica o tópico `QueryRequested` — observado pelo
//! middleware off-chain que resolve a requisição e invoca o `__callback` do
//! consumidor autenticado pela `cb_address` (relayer), no modelo Oraclize.
//!
//! Author:  Carlos Delfino
//! Email:   consultoria@carlosdelfino.eti.br
//! WhatsApp: +55 (85) 98520-5490
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, contracterror, symbol_short, vec, xdr::ToXdr, Address, Bytes, BytesN, Env, String, Vec};

/// Versão do conector (semver).
pub const VERSION: &str = "0.1.0";

/// Status de uma query registrada.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum QueryStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

/// Query registrada pendente de execução pelo middleware.
#[contracttype]
#[derive(Clone)]
pub struct OracleQuery {
    pub requester: Address,
    pub execute_after: u64,
    pub datasource: String,
    pub args: Vec<String>,
    pub status: QueryStatus,
}

/// Chaves de storage do conector.
#[contracttype]
pub enum DataKey {
    Admin,
    CbAddress,
    Nonce,
    Query(BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum OracleError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAdmin = 3,
    NotCbAddress = 4,
    EmptyDatasource = 5,
    EmptyArgs = 6,
    QueryNotFound = 7,
    NotPending = 8,
}

#[contract]
pub struct RapportOracle;

#[contractimpl]
impl RapportOracle {
    /// Inicializa o conector com admin e relayer (cb_address).
    pub fn initialize(env: Env, admin: Address, cb_address: Address) -> Result<(), OracleError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(OracleError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CbAddress, &cb_address);
        env.storage().instance().set(&DataKey::Nonce, &0u64);
        Ok(())
    }

    /// Endereço do relayer autorizado a chamar `__callback` nos consumidores.
    pub fn cb_address(env: Env) -> Address {
        env.storage().instance().get(&DataKey::CbAddress).unwrap()
    }

    /// Administrador do conector.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Registra uma requisição e retorna o `query_id` (rqid).
    ///
    /// * `requester` — consumidor que criou a requisição (exige auth).
    /// * `delay` — segundos mínimos antes da execução off-chain.
    /// * `datasource` — fonte de dados (ex.: "URL").
    /// * `args` — argumentos (ex.: ["json(https://...).USD"]).
    pub fn query(
        env: Env,
        requester: Address,
        delay: u64,
        datasource: String,
        args: Vec<String>,
    ) -> Result<BytesN<32>, OracleError> {
        requester.require_auth();
        if datasource.len() == 0 {
            return Err(OracleError::EmptyDatasource);
        }
        if args.is_empty() {
            return Err(OracleError::EmptyArgs);
        }
        let nonce: u64 = env.storage().instance().get(&DataKey::Nonce).unwrap_or(0);
        // query_id = sha256(requester || nonce || datasource || args)
        let mut preimage = Bytes::new(&env);
        preimage.append(&requester.clone().to_xdr(&env));
        preimage.append(&Bytes::from_array(&env, &nonce.to_be_bytes()));
        preimage.append(&datasource.clone().to_xdr(&env));
        for a in args.iter() {
            preimage.push_back(0x1f);
            preimage.append(&a.clone().to_xdr(&env));
        }
        let query_id: BytesN<32> = env.crypto().sha256(&preimage).into();
        env.storage().instance().set(&DataKey::Nonce, &(nonce + 1));

        let execute_after = env.ledger().timestamp().saturating_add(delay);
        let q = OracleQuery {
            requester: requester.clone(),
            execute_after,
            datasource: datasource.clone(),
            args: args.clone(),
            status: QueryStatus::Pending,
        };
        env.storage().persistent().set(&DataKey::Query(query_id.clone()), &q);

        env.events().publish(
            (symbol_short!("query"), requester, query_id.clone()),
            (delay, execute_after, datasource, args),
        );
        Ok(query_id)
    }

    /// Marca a query como concluída; somente o cb_address.
    pub fn complete(env: Env, query_id: BytesN<32>) -> Result<(), OracleError> {
        Self::require_cb(&env)?;
        Self::set_status(&env, &query_id, QueryStatus::Completed)
    }

    /// Marca a query como falha; somente o cb_address.
    pub fn fail(env: Env, query_id: BytesN<32>) -> Result<(), OracleError> {
        Self::require_cb(&env)?;
        Self::set_status(&env, &query_id, QueryStatus::Failed)
    }

    /// Atualiza o cb_address; somente admin.
    pub fn set_cb_address(env: Env, cb_address: Address) -> Result<(), OracleError> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&DataKey::CbAddress, &cb_address);
        Ok(())
    }

    /// Lê uma query registrada.
    pub fn get_query(env: Env, query_id: BytesN<32>) -> Result<OracleQuery, OracleError> {
        env.storage()
            .persistent()
            .get(&DataKey::Query(query_id))
            .ok_or(OracleError::QueryNotFound)
    }

    fn require_admin(env: &Env) -> Result<(), OracleError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(OracleError::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }

    fn require_cb(env: &Env) -> Result<(), OracleError> {
        let cb: Address = env.storage().instance().get(&DataKey::CbAddress).ok_or(OracleError::NotInitialized)?;
        cb.require_auth();
        Ok(())
    }

    fn set_status(env: &Env, query_id: &BytesN<32>, status: QueryStatus) -> Result<(), OracleError> {
        let key = DataKey::Query(query_id.clone());
        let mut q: OracleQuery = env.storage().persistent().get(&key).ok_or(OracleError::QueryNotFound)?;
        if q.status != QueryStatus::Pending {
            return Err(OracleError::NotPending);
        }
        q.status = status;
        env.storage().persistent().set(&key, &q);
        env.events().publish(
            (symbol_short!("status"), query_id.clone()),
            status as u32,
        );
        Ok(())
    }
}
