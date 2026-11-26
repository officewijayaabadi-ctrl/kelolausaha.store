CREATE TABLE IF NOT EXISTS dealer_motor_stock_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  specification TEXT NOT NULL,
  model_year INTEGER NOT NULL CHECK (model_year BETWEEN 1980 AND 2100),
  color TEXT NOT NULL,
  otr_price BIGINT NOT NULL CHECK (otr_price >= 0),
  stock_origin TEXT NOT NULL CHECK (stock_origin IN ('opening', 'incoming')),
  stock_entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_category TEXT NOT NULL DEFAULT 'motor'
    CHECK (vehicle_category IN ('motor', 'mobil')),
  receiving_invoice TEXT,
  supplier_name TEXT,
  quantity_received INTEGER NOT NULL CHECK (quantity_received BETWEEN 1 AND 1000),
  quantity_remaining INTEGER NOT NULL CHECK (
    quantity_remaining >= 0 AND quantity_remaining <= quantity_received
  ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id),
  CHECK ((status = 'pending' AND quantity_remaining > 0)
    OR (status = 'completed' AND quantity_remaining = 0)
    OR status = 'cancelled')
);

CREATE INDEX IF NOT EXISTS dealer_motor_stock_intakes_company_status_idx
  ON dealer_motor_stock_intakes (company_id, status, created_at DESC);

ALTER TABLE dealer_motor_units
  ADD COLUMN IF NOT EXISTS stock_intake_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dealer_motor_units_stock_intake_fk'
      AND conrelid = 'dealer_motor_units'::regclass
  ) THEN
    ALTER TABLE dealer_motor_units
      ADD CONSTRAINT dealer_motor_units_stock_intake_fk
      FOREIGN KEY (stock_intake_id, company_id)
      REFERENCES dealer_motor_stock_intakes (id, company_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dealer_motor_units_stock_intake_idx
  ON dealer_motor_units (company_id, stock_intake_id)
  WHERE stock_intake_id IS NOT NULL;
