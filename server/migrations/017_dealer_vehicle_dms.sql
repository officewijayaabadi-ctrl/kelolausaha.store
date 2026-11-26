ALTER TABLE dealer_motor_units
  ADD COLUMN IF NOT EXISTS vehicle_category TEXT NOT NULL DEFAULT 'motor'
    CHECK (vehicle_category IN ('motor', 'mobil')),
  ADD COLUMN IF NOT EXISTS receiving_invoice TEXT,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS inspection_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (inspection_status IN ('pending', 'inspected', 'rejected')),
  ADD COLUMN IF NOT EXISTS inspection_note TEXT,
  ADD COLUMN IF NOT EXISTS scratch_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (scratch_status IN ('pending', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS pdi_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (pdi_status IN ('pending', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS handover_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (handover_status IN ('pending', 'scheduled', 'completed'));

ALTER TABLE dealer_motor_units
  DROP CONSTRAINT IF EXISTS dealer_motor_units_stock_status_check;

ALTER TABLE dealer_motor_units
  ADD CONSTRAINT dealer_motor_units_stock_status_check
  CHECK (stock_status IN (
    'waiting_receipt', 'in_inspection', 'available', 'reserved',
    'spk_pending', 'spk_approved', 'allocated', 'awaiting_scratch',
    'scratch_in_progress', 'scratch_completed', 'awaiting_pdi',
    'pdi_in_progress', 'ready_for_handover', 'in_delivery',
    'approved_for_delivery', 'delivered', 'cancelled', 'returned'
  ));

ALTER TABLE dealer_motor_unit_events
  DROP CONSTRAINT IF EXISTS dealer_motor_unit_events_event_type_check;

ALTER TABLE dealer_motor_unit_events
  ADD CONSTRAINT dealer_motor_unit_events_event_type_check
  CHECK (event_type IN (
    'opening', 'incoming', 'received', 'inspection_completed',
    'reserved_for_spk', 'reservation_released', 'spk_approved',
    'allocated', 'scratch_started', 'scratch_completed',
    'pdi_started', 'pdi_completed', 'approved_for_delivery',
    'in_delivery', 'delivered', 'cancelled', 'returned'
  ));

CREATE INDEX IF NOT EXISTS dealer_motor_units_vehicle_category_idx
  ON dealer_motor_units (company_id, vehicle_category, stock_status, created_at DESC);
