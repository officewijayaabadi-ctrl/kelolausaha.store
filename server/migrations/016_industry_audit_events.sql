CREATE TABLE IF NOT EXISTS industry_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID,
  user_id UUID,
  role TEXT NOT NULL,
  industry TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, company_id)
    REFERENCES business_branches(id, company_id),
  FOREIGN KEY (user_id, company_id)
    REFERENCES users(id, company_id)
);

CREATE INDEX IF NOT EXISTS industry_audit_events_company_time_idx
  ON industry_audit_events (company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS industry_audit_events_company_branch_time_idx
  ON industry_audit_events (company_id, branch_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS industry_audit_events_resource_idx
  ON industry_audit_events (company_id, resource_type, resource_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS industry_role TEXT,
  ADD COLUMN IF NOT EXISTS industry_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE team_invites
  ADD COLUMN IF NOT EXISTS industry_role TEXT,
  ADD COLUMN IF NOT EXISTS industry_permissions JSONB NOT NULL DEFAULT '[]'::jsonb;
