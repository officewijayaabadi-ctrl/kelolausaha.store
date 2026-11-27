CREATE TABLE IF NOT EXISTS dealer_motor_sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('company', 'branch', 'salesperson', 'branch_salesperson')),
  scope_key TEXT NOT NULL,
  branch_id UUID,
  sales_name TEXT,
  unit_target INTEGER NOT NULL DEFAULT 0 CHECK (unit_target >= 0),
  revenue_target BIGINT NOT NULL DEFAULT 0 CHECK (revenue_target >= 0),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start, scope_key),
  FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id),
  CHECK (
    (scope_type = 'company' AND branch_id IS NULL AND sales_name IS NULL)
    OR (scope_type = 'branch' AND branch_id IS NOT NULL AND sales_name IS NULL)
    OR (scope_type = 'salesperson' AND branch_id IS NULL AND sales_name IS NOT NULL)
    OR (scope_type = 'branch_salesperson' AND branch_id IS NOT NULL AND sales_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS dealer_motor_sales_targets_company_period_idx
  ON dealer_motor_sales_targets (company_id, period_start);
