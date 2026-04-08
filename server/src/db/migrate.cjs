const { db } = require('./database.cjs')

function hasColumn(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all()
  return rows.some((row) => row.name === column)
}

function ensureColumn(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL UNIQUE,
      email_encrypted TEXT NOT NULL,
      name_encrypted TEXT NOT NULL,
      phone_hash TEXT UNIQUE,
      phone_encrypted TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      preferred_otp_channel TEXT NOT NULL DEFAULT 'email',
      mfa_email_enabled INTEGER NOT NULL DEFAULT 1,
      mfa_totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_secret_encrypted TEXT,
      trusted_circle_threshold INTEGER NOT NULL DEFAULT 2,
      inactivity_timer_days INTEGER NOT NULL DEFAULT 60,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      risk_score INTEGER NOT NULL DEFAULT 0,
      flagged_at TEXT,
      flagged_reason TEXT,
      locked_until TEXT,
      email_verified_at TEXT,
      verification_sent_at TEXT,
      last_activity_at TEXT NOT NULL,
      last_login_at TEXT,
      last_verified_alive_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id TEXT PRIMARY KEY,
      email_hash TEXT NOT NULL UNIQUE,
      email_encrypted TEXT NOT NULL,
      name_encrypted TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      channel TEXT NOT NULL,
      otp_hash TEXT,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      metadata_json TEXT,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      request_id TEXT,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      device_info TEXT,
      location_hint TEXT,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      integrity_prev_hash TEXT,
      integrity_hash TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS trusted_circle (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      nominee_user_id TEXT,
      nominee_email_hash TEXT NOT NULL,
      nominee_email_encrypted TEXT NOT NULL,
      nominee_name_encrypted TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (nominee_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS release_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      inactivity_threshold_days INTEGER NOT NULL,
      grace_period_days INTEGER NOT NULL,
      approval_threshold INTEGER NOT NULL,
      alerts_sent INTEGER NOT NULL DEFAULT 0,
      triggered_at TEXT NOT NULL,
      last_alert_at TEXT,
      cancelled_at TEXT,
      released_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS release_approvals (
      id TEXT PRIMARY KEY,
      release_request_id TEXT NOT NULL,
      nominee_user_id TEXT NOT NULL,
      approved_at TEXT NOT NULL,
      UNIQUE (release_request_id, nominee_user_id),
      FOREIGN KEY (release_request_id) REFERENCES release_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (nominee_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      encrypted_details TEXT NOT NULL,
      encrypted_financial_data TEXT,
      file_name_encrypted TEXT,
      file_mime_type TEXT,
      file_storage_key TEXT,
      file_size INTEGER,
      file_cipher_meta TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      trusted_circle_id TEXT NOT NULL,
      claimant_user_id TEXT,
      claimant_name_encrypted TEXT NOT NULL,
      claimant_contact_hash TEXT NOT NULL,
      claimant_contact_encrypted TEXT NOT NULL,
      claimant_channel TEXT NOT NULL,
      deceased_contact_hash TEXT NOT NULL,
      deceased_contact_encrypted TEXT NOT NULL,
      otp_hash TEXT,
      otp_expires_at TEXT,
      otp_attempts INTEGER NOT NULL DEFAULT 0,
      otp_max_attempts INTEGER NOT NULL DEFAULT 3,
      otp_verified_at TEXT,
      id_proof_name_encrypted TEXT,
      id_proof_mime_type TEXT,
      id_proof_storage_key TEXT,
      id_proof_size INTEGER,
      id_proof_cipher_meta TEXT,
      demo_timer_minutes INTEGER,
      timer_expires_at TEXT,
      approval_threshold INTEGER NOT NULL,
      status TEXT NOT NULL,
      access_token_jti TEXT,
      access_granted_at TEXT,
      access_denied_at TEXT,
      created_at TEXT NOT NULL,
      submitted_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (trusted_circle_id) REFERENCES trusted_circle(id) ON DELETE CASCADE,
      FOREIGN KEY (claimant_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS claim_approvals (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      trusted_circle_id TEXT NOT NULL,
      approver_user_id TEXT,
      approval_token_hash TEXT NOT NULL,
      approval_token_expires_at TEXT NOT NULL,
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (claim_id, trusted_circle_id),
      FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
      FOREIGN KEY (trusted_circle_id) REFERENCES trusted_circle(id) ON DELETE CASCADE,
      FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type ON activity_logs(user_id, event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at ON activity_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_purpose ON otp_challenges(user_id, purpose, created_at);
    CREATE INDEX IF NOT EXISTS idx_trusted_circle_owner ON trusted_circle(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_release_requests_user_status ON release_requests(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_owner_status ON claims(owner_user_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_claims_contact_hash ON claims(claimant_contact_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_claim_approvals_claim_id ON claim_approvals(claim_id, approved_at);
    CREATE INDEX IF NOT EXISTS idx_admin_accounts_email_hash ON admin_accounts(email_hash);
  `)

  ensureColumn('users', 'phone_hash', 'TEXT')
  ensureColumn('users', 'phone_encrypted', 'TEXT')
  ensureColumn('users', 'preferred_otp_channel', "TEXT NOT NULL DEFAULT 'email'")
  ensureColumn('users', 'inactivity_timer_days', 'INTEGER NOT NULL DEFAULT 60')
  ensureColumn('users', 'risk_score', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('users', 'locked_until', 'TEXT')
  ensureColumn('users', 'email_verified_at', 'TEXT')
  ensureColumn('users', 'verification_sent_at', 'TEXT')
  ensureColumn('users', 'last_verified_alive_at', 'TEXT')
  ensureColumn('activity_logs', 'request_id', 'TEXT')
  ensureColumn('activity_logs', 'integrity_prev_hash', 'TEXT')
  ensureColumn('activity_logs', 'integrity_hash', 'TEXT')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_hash_unique ON users(phone_hash)')
}

module.exports = { migrate }
