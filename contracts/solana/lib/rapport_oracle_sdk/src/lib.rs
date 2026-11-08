//! Biblioteca do desenvolvedor — Rapport Oracle para Solana (modelo Oraclize/Provable).
//!
//! Importável via git no `Cargo.toml` do consumidor:
//!
//! ```toml
//! rapport_oracle_sdk = { git = "https://github.com/rapporttecnologia/rapport_oracle",
//!                        subdirectory = "contracts/solana/lib/rapport_oracle_sdk" }
//! ```
//!
//! Fluxo:
//!   1. O consumidor chama [`rapport_oracle_query`] (CPI para o programa oracle)
//!      que retorna um `rqid` (`[u8; 32]`).
//!   2. O middleware observa `QueryRequested`, resolve a requisição off-chain e
//!      invoca o `__callback` do consumidor assinando com `cb_authority`.
//!   3. O consumidor deve validar o signer do callback via [`require_cb_authority`].
//!
//! Author:  Carlos Delfino
//! Email:   consultoria@carlosdelfino.eti.br
//! WhatsApp: +55 (85) 98520-5490

use anchor_lang::prelude::*;

/// Seeds da PDA de configuração do oracle.
pub const CONFIG_SEED: &[u8] = b"config";
/// Seeds das PDAs de query.
pub const QUERY_SEED: &[u8] = b"query";
/// Versão da API do SDK (semver).
pub const RAPPORT_ORACLE_SDK_VERSION: &str = "0.1.0";

/// Program id do oracle na rede alvo (devnet) — sincronizado por `anchor keys sync`.
/// Mantido como constante para que consumidores validem o programa esperado.
declare_id!("1pyBQW1biz9AwWGLf8hj3XepnE8TMVsmvEDZCuVQQXV");

/// Alias legível do `ID` declarado acima.
pub static RAPPORT_ORACLE_PROGRAM_ID: Pubkey = ID;

/// Estado mínimo espelhado do `OracleConfig` para leitura da `cb_authority`.
///
/// O consumidor passa a conta PDA `config` do oracle como `UncheckedAccount`
/// e este helper desserializa apenas os campos necessários.
#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    /// Administrador do oracle.
    pub admin: Pubkey,
    /// Relayer autorizado a chamar `__callback` (cbAddress equivalente).
    pub cb_authority: Pubkey,
    /// Taxa por query em lamports.
    pub base_fee: u64,
    /// Nonce de derivação de query_id.
    pub nonce: u64,
    /// Bump da PDA config.
    pub bump: u8,
}

/// Deriva a PDA `config` do programa oracle.
pub fn config_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], program_id)
}

/// Deriva a PDA `query` de uma requisição.
pub fn query_pda(requester: &Pubkey, nonce: u64, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[QUERY_SEED, requester.as_ref(), nonce.to_le_bytes().as_ref()],
        program_id,
    )
}

/// Verifica se `signer` é o `cb_authority` lido da PDA `config`.
///
/// Uso no `__callback` do consumidor:
///
/// ```rust,ignore
/// let config = OracleConfig::try_deserialize(&mut &ctx.accounts.oracle_config.data.borrow()[..])?;
/// rapport_oracle_sdk::require_cb_authority(&ctx.accounts.oracle_signer, &config)?;
/// ```
pub fn require_cb_authority(signer: &Signer, config: &OracleConfig) -> Result<()> {
    require_keys_eq!(
        signer.key(),
        config.cb_authority,
        RapportOracleSdkError::NotCbAuthority
    );
    Ok(())
}

/// Desserializa a `OracleConfig` a partir de uma `AccountInfo` crua (UncheckedAccount).
pub fn read_config(config_info: &AccountInfo) -> Result<OracleConfig> {
    let data = config_info.try_borrow_data()?;
    let mut slice: &[u8] = &data;
    OracleConfig::try_deserialize(&mut slice)
        .map_err(|_| error!(RapportOracleSdkError::BadConfigAccount))
}

/// Parse de string decimal em inteiro escalado (`parseFloat * 10^decimals`),
/// equivalente ao `parseInt(result, decimals)` da biblioteca EVM.
///
/// * `s` — string de entrada (ex.: "3123.45")
/// * `decimals` — casas decimais preservadas como fator de escala
pub fn parse_int_scaled(s: &str, decimals: u32) -> Option<u128> {
    let mut value: u128 = 0;
    let mut seen_dot = false;
    let mut dec_left = decimals;
    for c in s.bytes() {
        if c.is_ascii_digit() {
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
    let mut d = dec_left;
    while d > 0 {
        value = value.checked_mul(10)?;
        d -= 1;
    }
    Some(value)
}

/// CPI helper — invoca `query` no programa oracle e retorna o `rqid` emitido.
///
/// Requer a feature `cpi` do crate. O consumidor monta o contexto `Request`
/// do programa oracle com suas próprias contas e obtém o query_id no evento
/// `QueryRequested` (e na PDA criada).
#[cfg(feature = "cpi")]
pub fn rapport_oracle_query<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, rapport_oracle::cpi::accounts::Request<'info>>,
    delay: i64,
    datasource: String,
    args: Vec<String>,
) -> Result<()> {
    rapport_oracle::cpi::query(ctx, delay, datasource, args)
}

/// Monta as contas do contexto `Request` do oracle para o CPI helper.
///
/// Requer a feature `cpi`. Ordem: config PDA, query PDA (a criar), requester
/// (signer pagador), system_program.
#[cfg(feature = "cpi")]
pub fn cpi_request_accounts<'info>(
    config: AccountInfo<'info>,
    query_account: AccountInfo<'info>,
    requester: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
) -> rapport_oracle::cpi::accounts::Request<'info> {
    rapport_oracle::cpi::accounts::Request {
        config,
        query_account,
        requester,
        system_program,
    }
}

#[error_code]
pub enum RapportOracleSdkError {
    #[msg("signer não é o cb_authority do oracle")]
    NotCbAuthority,
    #[msg("conta config inválida para o programa oracle")]
    BadConfigAccount,
}
