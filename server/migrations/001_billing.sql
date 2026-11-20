CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL,
  active_until TIMESTAMPTZ,
  plan_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'lifetime', 'expired', 'suspended'))
);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_challenges_email_created_idx
  ON otp_challenges (email, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_invites (
  token_hash TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  midtrans_order_id TEXT NOT NULL UNIQUE,
  snap_token TEXT,
  redirect_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_orders_company_created_idx
  ON billing_orders (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS company_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_ledger_entries_company_date_idx
  ON company_ledger_entries (company_id, entry_date DESC, created_at DESC);

WITH first_admin AS (
  SELECT DISTINCT ON (company_id) id
  FROM users
  WHERE role = 'SUPER ADMIN' AND company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users owner
      WHERE owner.company_id = users.company_id AND owner.role = 'OWNER'
    )
  ORDER BY company_id, created_at, id
)
UPDATE users
SET role = 'OWNER',
    permissions = permissions || '["financeView","financeManage","activationManage","accessManage","themeManage"]'::jsonb
WHERE id IN (SELECT id FROM first_admin);

UPDATE users
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT permission), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    users.permissions || '["financeView","financeManage","activationManage","accessManage","themeManage"]'::jsonb
  ) AS item(permission)
)
WHERE role = 'OWNER';

UPDATE users
SET permissions = COALESCE((
  SELECT jsonb_agg(permission)
  FROM jsonb_array_elements_text(users.permissions) AS item(permission)
  WHERE permission NOT IN (
    'reportsView', 'targetManage', 'financeView', 'financeManage',
    'activationManage', 'accessManage', 'themeManage'
  )
), '[]'::jsonb)
WHERE role = 'SUPER ADMIN';
