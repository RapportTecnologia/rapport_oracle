//! Programa consumidor de exemplo do Rapport Oracle (Solana).
//!
//! Reproduz o fluxo do Oraclize/Provable: `request_price` registra uma query
//! `json(<url>).USD` no oracle (CPI) e o middleware devolve o valor via
//! `__callback`, validado pela `cb_authority` lida da PDA `config` do oracle.
//!
//! Author:  Carlos Delfino
//! Email:   consultoria@carlosdelfino.eti.br
//! WhatsApp: +55 (85) 98520-5490

use anchor_lang::prelude::*;
use rapport_oracle_sdk::{require_cb_authority, read_config, OracleConfig};

declare_id!("8wpztkqU6h1SX2efUqdTSxpjKiH6KGSZgMnqbVYCQ6jg");

/// Seeds do estado de preço do exemplo.
pub const PRICE_SEED: &[u8] = b"price";

#[program]
pub mod example_consumer {
    use super::*;

    /// Inicializa o estado de preço (PDA `price`).
    ///
    /// * `oracle_program` — programa `rapport_oracle` da rede alvo.
    pub fn initialize(ctx: Context<InitConsumer>, oracle_program: Pubkey) -> Result<()> {
        let st = &mut ctx.accounts.state;
        st.authority = ctx.accounts.authority.key();
        st.oracle_program = oracle_program;
        st.price_cents = 0;
        st.last_query_id = [0u8; 32];
        st.last_updated = 0;
        st.bump = ctx.bumps.state;
        Ok(())
    }

    /// Agenda a consulta do preço ETH/USD (query no oracle via CPI).
    ///
    /// O `rqid` é derivado pelo oracle a partir do requester + nonce e fica
    /// registrado na PDA `query_account` criada aqui.
    pub fn request_price(ctx: Context<RequestPrice>) -> Result<()> {
        let cfg = read_config(&ctx.accounts.oracle_config.to_account_info())?;
        let cpi_program = ctx.accounts.oracle_program.to_account_info();
        let cpi_accounts = rapport_oracle_sdk::cpi_request_accounts(
            ctx.accounts.oracle_config.to_account_info(),
            ctx.accounts.query_account.to_account_info(),
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        );
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        rapport_oracle_sdk::rapport_oracle_query(
            cpi_ctx,
            0,
            "URL".to_string(),
            vec![
                "json(https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD).USD"
                    .to_string(),
            ],
        )?;
        let _ = cfg; // config lida apenas para validar a conta
        emit!(PriceRequested { requester: ctx.accounts.authority.key() });
        Ok(())
    }

    /// Callback do oracle — só o `cb_authority` do oracle pode invocar.
    ///
    /// * `query_id` — rqid retornado pela query.
    /// * `result` — resultado serializado (ex.: "3123.45").
    /// * `proof` — assinatura ed25519 do relayer sobre o resultado (opcional na v1).
    pub fn __callback(ctx: Context<Callback>, query_id: [u8; 32], result: String, proof: Vec<u8>) -> Result<()> {
        let config = read_config(&ctx.accounts.oracle_config.to_account_info())?;
        require_cb_authority(&ctx.accounts.oracle_signer, &config)?;
        let st = &mut ctx.accounts.state;
        st.price_cents = rapport_oracle_sdk::parse_int_scaled(&result, 2)
            .ok_or(ConsumerError::BadResult)? as u64;
        st.last_query_id = query_id;
        st.last_updated = Clock::get()?.unix_timestamp;
        let _ = proof;
        emit!(PriceUpdated {
            query_id,
            price_cents: st.price_cents,
        });
        Ok(())
    }
}

// ----------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitConsumer<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PriceState::INIT_SPACE,
        seeds = [PRICE_SEED],
        bump
    )]
    pub state: Account<'info, PriceState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestPrice<'info> {
    /// PDA `config` do programa oracle (UncheckedAccount — desserializada no handler).
    /// CHECK: validada por `read_config` + seeds verificadas no CPI do oracle.
    pub oracle_config: UncheckedAccount<'info>,
    /// PDA `query` a ser criada pelo oracle (o oracle valida seeds/init no CPI).
    /// CHECK: criada pelo CPI `rapport_oracle::query`.
    #[account(mut)]
    pub query_account: UncheckedAccount<'info>,
    /// Programa oracle.
    /// CHECK: comparado com `state.oracle_program` no handler.
    pub oracle_program: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Callback<'info> {
    /// PDA `config` do oracle para ler o `cb_authority`.
    /// CHECK: desserializada por `read_config`; o signer é validado contra ela.
    pub oracle_config: UncheckedAccount<'info>,
    /// Relayer do oracle — deve ser igual a `config.cb_authority`.
    pub oracle_signer: Signer<'info>,
    #[account(mut, seeds = [PRICE_SEED], bump = state.bump)]
    pub state: Account<'info, PriceState>,
}

// ----------------------------------------------------------------------
// State / Events / Errors
// ----------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct PriceState {
    /// Autoridade do consumidor.
    pub authority: Pubkey,
    /// Programa oracle utilizado.
    pub oracle_program: Pubkey,
    /// Último preço em centavos (result * 10^2).
    pub price_cents: u64,
    /// rqid do último callback atendido.
    pub last_query_id: [u8; 32],
    /// Timestamp do último callback.
    pub last_updated: i64,
    /// Bump da PDA.
    pub bump: u8,
}

#[event]
pub struct PriceRequested {
    pub requester: Pubkey,
}

#[event]
pub struct PriceUpdated {
    pub query_id: [u8; 32],
    pub price_cents: u64,
}

#[error_code]
pub enum ConsumerError {
    #[msg("resultado não pôde ser convertido em inteiro")]
    BadResult,
}
