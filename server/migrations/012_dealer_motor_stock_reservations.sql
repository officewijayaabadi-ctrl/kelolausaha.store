DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'dealer_motor_units'::regclass
      AND conname = 'dealer_motor_units_stock_status_check'
      AND pg_get_constraintdef(oid) ILIKE '%reserved%'
  ) THEN
    ALTER TABLE dealer_motor_units
      DROP CONSTRAINT IF EXISTS dealer_motor_units_stock_status_check;
    ALTER TABLE dealer_motor_units
      ADD CONSTRAINT dealer_motor_units_stock_status_check
      CHECK (stock_status IN ('available', 'reserved', 'approved_for_delivery', 'in_delivery', 'delivered'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'dealer_motor_unit_events'::regclass
      AND conname = 'dealer_motor_unit_events_event_type_check'
      AND pg_get_constraintdef(oid) ILIKE '%reserved_for_spk%'
  ) THEN
    ALTER TABLE dealer_motor_unit_events
      DROP CONSTRAINT IF EXISTS dealer_motor_unit_events_event_type_check;
    ALTER TABLE dealer_motor_unit_events
      ADD CONSTRAINT dealer_motor_unit_events_event_type_check
      CHECK (event_type IN (
        'opening', 'incoming', 'reserved_for_spk', 'reservation_released',
        'approved_for_delivery', 'in_delivery', 'delivered'
      ));
  END IF;
END $$;

UPDATE dealer_motor_units AS u
SET stock_status = 'reserved', status_updated_at = now(), updated_at = now()
WHERE u.stock_status = 'available'
  AND EXISTS (
    SELECT 1
    FROM dealer_motor_spks AS s
    WHERE s.company_id = u.company_id
      AND s.unit_id = u.id
      AND s.status IN ('SUBMITTED', 'APPROVAL SVP')
  );

INSERT INTO dealer_motor_unit_events
  (company_id, unit_id, spk_id, created_by, event_type, note, created_at)
SELECT s.company_id, s.unit_id, s.id, s.submitted_by, 'reserved_for_spk',
       'Unit direservasi untuk SPK yang menunggu proses', s.created_at
FROM dealer_motor_spks AS s
WHERE s.status IN ('SUBMITTED', 'APPROVAL SVP')
  AND NOT EXISTS (
    SELECT 1
    FROM dealer_motor_unit_events AS e
    WHERE e.company_id = s.company_id
      AND e.unit_id = s.unit_id
      AND e.spk_id = s.id
      AND e.event_type = 'reserved_for_spk'
  );
