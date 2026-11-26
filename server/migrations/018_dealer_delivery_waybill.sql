ALTER TABLE dealer_motor_spks
  ADD COLUMN IF NOT EXISTS waybill_number TEXT,
  ADD COLUMN IF NOT EXISTS waybill_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waybill_issued_by UUID REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS dealer_motor_spks_company_waybill_idx
  ON dealer_motor_spks (company_id, waybill_number)
  WHERE waybill_number IS NOT NULL;
