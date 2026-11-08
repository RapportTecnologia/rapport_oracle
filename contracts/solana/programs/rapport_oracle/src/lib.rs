//! Conector on-chain do Rapport Oracle para Solana (Anchor).
//!
//! Recebe requisições de programas consumidores via `query`, registra uma
//! `OracleQuery` PDA e emite `QueryRequested` — observado pelo middleware
//! off-chain que resolve a requisição e invoca o `__callback` do consumidor
//! assinando com a `cb_authority` (relayer), no modelo Oraclize/Provable.
//!
//! Author:  Carlos Delfino
//! Email:   consultoria@carlosdelfino.eti.br
//! WhatsApp: +55 (85) 98520-5490

use anchor_lang::prelude::*;
use sha2::{Digest, Sha256};

declare_id!("1pyBQW1biz9AwWGLf8hj3XepnE8TMVsmvEDZCuVQQXV");

/// Tamanho máximo do datasource (ex.: "URL").
pub const MAX_DATASOURCE_LEN: usize = 32;
/// Máximo de argumentos por query.
pub const MAX_ARGS: usize = 4;
/// Tamanho máximo de cada argumento.
pub const MAX_ARG_LEN: usize = 512;
/// Seeds da conta de configuração.
pub const CONFIG_SEED: &[u8] = b"config";
/// Seeds das contas de query.
pub const QUERY_SEED: &[u8] = b"query";

#[program]
pub mod rapport_oracle {
    use super::*;

    /// Inicializa a configuração global do oracle (PDA `config`).
    ///
    /// * `cb_authority` — pubkey do relayer autorizado a invocar `__callback`
    ///   nos consumidores (equivale ao `cbAddress` do EVM).
    /// * `base_fee` — taxa por query em lamports (0 enquanto gratuito).
    pub fn initialize(ctx: Context<Initialize>, cb_authority: Pubkey, base_fee: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.cb_authority = cb_authority;
        config.base_fee = base_fee;
        config.nonce = 0;
        config.bump = ctx.bumps.config;
        emit!(OracleInitialized {
            admin: config.admin,
            cb_authority,
            base_fee,
        });
        Ok(())
    }

    /// Registra uma requisição ao oracle e retorna o `query_id` (rqid).
    ///
    /// * `delay` — segundos mínimos antes da execução off-chain.
    /// * `datasource` — fonte de dados (ex.: "URL").
    /// * `args` — argumentos (ex.: ["json(https://...).USD"]).
    pub fn query(ctx: Context<Request>, delay: i64, datasource: String, args: Vec<String>) -> Result<()> {
        require!(datasource.len() <= MAX_DATASOURCE_LEN, OracleError::DatasourceTooLong);
        require!(!datasource.is_empty(), OracleError::EmptyDatasource);
        require!(!args.is_empty() && args.len() <= MAX_ARGS, OracleError::BadArgs);
        require!(args.iter().all(|a| a.len() <= MAX_ARG_LEN), OracleError::ArgTooLong);
        require!(delay >= 0, OracleError::NegativeDelay);

        let config = &mut ctx.accounts.config;
        let requester = ctx.accounts.requester.key();
        let nonce = config.nonce;

        // query_id = keccak256(requester || nonce || datasource || args.join(0x1f))
        let mut preimage = requester.to_bytes().to_vec();
        preimage.extend_from_slice(&nonce.to_le_bytes());
        preimage.extend_from_slice(datasource.as_bytes());
        for a in &args {
            preimage.push(0x1f);
            preimage.extend_from_slice(a.as_bytes());
        }
        let query_id: [u8; 32] = Sha256::digest(&preimage).into();
        config.nonce = nonce.checked_add(1).unwrap();

        let execute_after = Clock::get()?.unix_timestamp.saturating_add(delay);
        let q = &mut ctx.accounts.query_account;
        q.requester = requester;
        q.query_id = query_id;
        q.nonce = nonce;
        q.execute_after = execute_after;
        q.datasource = datasource.clone();
        q.args = args.clone();
        q.status = QueryStatus::Pending as u8;
        q.bump = ctx.bumps.query_account;

        emit!(QueryRequested {
            query_id,
            requester,
            delay,
            execute_after,
            datasource,
            args,
        });
        Ok(())
    }

    /// Marca a query como concluída; só o `cb_authority` pode chamar.
    ///
    /// Chamado pelo relayer após o callback ser entregue ao consumidor,
    /// evitando reprocessamento pelo middleware.
    pub fn complete(ctx: Context<Complete>, query_id: [u8; 32]) -> Result<()> {
        let q = &mut ctx.accounts.query_account;
        require!(q.query_id == query_id, OracleError::QueryIdMismatch);
        require!(q.status == QueryStatus::Pending as u8, OracleError::NotPending);
        q.status = QueryStatus::Completed as u8;
        emit!(QueryCompleted { query_id });
        Ok(())
    }

    /// Marca a query como falha; só o `cb_authority` pode chamar.
    pub fn fail(ctx: Context<Complete>, query_id: [u8; 32]) -> Result<()> {
        let q = &mut ctx.accounts.query_account;
        require!(q.query_id == query_id, OracleError::QueryIdMismatch);
        require!(q.status == QueryStatus::Pending as u8, OracleError::NotPending);
        q.status = QueryStatus::Failed as u8;
        emit!(QueryFailed { query_id });
        Ok(())
    }

    /// Atualiza o relayer autorizado; somente admin.
    pub fn set_cb_authority(ctx: Context<AdminOnly>, new_cb: Pubkey) -> Result<()> {
        ctx.accounts.config.cb_authority = new_cb;
        emit!(CbAuthorityUpdated { cb_authority: new_cb });
        Ok(())
    }

    /// Atualiza a taxa base; somente admin.
    pub fn set_base_fee(ctx: Context<AdminOnly>, base_fee: u64) -> Result<()> {
        ctx.accounts.config.base_fee = base_fee;
        emit!(BaseFeeUpdated { base_fee });
        Ok(())
    }
}

// ----------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Request<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, OracleConfig>,
    #[account(
        init,
        payer = requester,
        space = 8 + OracleQuery::INIT_SPACE,
        seeds = [QUERY_SEED, requester.key().as_ref(), config.nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub query_account: Account<'info, OracleQuery>,
    #[account(mut)]
    pub requester: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(query_id: [u8; 32])]
pub struct Complete<'info> {
    #[account(
        mut,
        seeds = [QUERY_SEED, query_account.requester.as_ref(), query_account.nonce.to_le_bytes().as_ref()],
        bump = query_account.bump,
        constraint = signer.key() == config.cb_authority @ OracleError::NotCbAuthority
    )]
    pub query_account: Account<'info, OracleQuery>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, OracleConfig>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ OracleError::NotAdmin
    )]
    pub config: Account<'info, OracleConfig>,
    pub admin: Signer<'info>,
}

// ----------------------------------------------------------------------
// State
// ----------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    /// Administrador (multisig Squads em produção).
    pub admin: Pubkey,
    /// Relayer autorizado a chamar `__callback` nos consumidores.
    pub cb_authority: Pubkey,
    /// Taxa por query em lamports.
    pub base_fee: u64,
    /// Nonce de derivação do query_id.
    pub nonce: u64,
    /// Bump da PDA config.
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OracleQuery {
    /// Programa consumidor que criou a requisição.
    pub requester: Pubkey,
    /// rqid único da requisição.
    pub query_id: [u8; 32],
    /// Timestamp mínimo de execução (unix).
    pub execute_after: i64,
    /// Nonce usado na derivação da PDA (ver seeds de `Request`).
    pub nonce: u64,
    /// Status: 0=Pending, 1=Completed, 2=Failed.
    pub status: u8,
    /// Bump da PDA.
    pub bump: u8,
    /// Fonte de dados.
    #[max_len(32)]
    pub datasource: String,
    /// Argumentos da requisição.
    #[max_len(4, 512)]
    pub args: Vec<String>,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum QueryStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

// ----------------------------------------------------------------------
// Events / Errors
// ----------------------------------------------------------------------

#[event]
pub struct OracleInitialized {
    pub admin: Pubkey,
    pub cb_authority: Pubkey,
    pub base_fee: u64,
}

#[event]
pub struct QueryRequested {
    pub query_id: [u8; 32],
    pub requester: Pubkey,
    pub delay: i64,
    pub execute_after: i64,
    pub datasource: String,
    pub args: Vec<String>,
}

#[event]
pub struct QueryCompleted {
    pub query_id: [u8; 32],
}

#[event]
pub struct QueryFailed {
    pub query_id: [u8; 32],
}

#[event]
pub struct CbAuthorityUpdated {
    pub cb_authority: Pubkey,
}

#[event]
pub struct BaseFeeUpdated {
    pub base_fee: u64,
}

#[error_code]
pub enum OracleError {
    #[msg("datasource excede o tamanho máximo")]
    DatasourceTooLong,
    #[msg("datasource vazio")]
    EmptyDatasource,
    #[msg("args vazio ou excede o máximo")]
    BadArgs,
    #[msg("argumento excede o tamanho máximo")]
    ArgTooLong,
    #[msg("delay negativo")]
    NegativeDelay,
    #[msg("signer não é o cb_authority do oracle")]
    NotCbAuthority,
    #[msg("signer não é o admin do oracle")]
    NotAdmin,
    #[msg("query_id não corresponde à conta")]
    QueryIdMismatch,
    #[msg("query não está pendente")]
    NotPending,
}
