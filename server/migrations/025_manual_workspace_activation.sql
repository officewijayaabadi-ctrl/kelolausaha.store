ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_source TEXT NOT NULL DEFAULT 'trial'
    CHECK (activation_source IN ('trial', 'midtrans', 'manual'));

UPDATE companies c
SET activated_at = COALESCE(
      c.activated_at,
      (SELECT MAX(b.paid_at) FROM billing_orders b WHERE b.company_id = c.id AND b.status = 'paid'),
      c.created_at
    ),
    activation_source = CASE
      WHEN EXISTS (
        SELECT 1 FROM billing_orders b
        WHERE b.company_id = c.id AND b.status = 'paid'
      ) THEN 'midtrans'
      ELSE c.activation_source
    END;

CREATE TABLE IF NOT EXISTS company_manual_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  duration_months INTEGER NOT NULL CHECK (duration_months >= 0),
  activated_by UUID NOT NULL REFERENCES users(id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  note TEXT,
  CHECK ((duration_months = 0 AND active_until IS NULL) OR duration_months > 0)
);

CREATE INDEX IF NOT EXISTS company_manual_activations_company_time_idx
  ON company_manual_activations (company_id, activated_at DESC);
