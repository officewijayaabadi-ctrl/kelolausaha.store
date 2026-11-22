CREATE TABLE IF NOT EXISTS dealer_motor_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  specification TEXT NOT NULL,
  model_year INTEGER NOT NULL CHECK (model_year BETWEEN 1980 AND 2100),
  color TEXT NOT NULL,
  frame_number TEXT NOT NULL,
  engine_number TEXT NOT NULL,
  otr_price BIGINT NOT NULL CHECK (otr_price >= 0),
  stock_origin TEXT NOT NULL CHECK (stock_origin IN ('opening', 'incoming')),
  stock_status TEXT NOT NULL DEFAULT 'available'
    CHECK (stock_status IN ('available', 'approved_for_delivery', 'in_delivery', 'delivered')),
  stock_entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dealer_motor_units_company_frame_idx
  ON dealer_motor_units (company_id, upper(frame_number));
CREATE UNIQUE INDEX IF NOT EXISTS dealer_motor_units_company_engine_idx
  ON dealer_motor_units (company_id, upper(engine_number));
CREATE INDEX IF NOT EXISTS dealer_motor_units_company_status_idx
  ON dealer_motor_units (company_id, stock_status, created_at DESC);

CREATE TABLE IF NOT EXISTS dealer_motor_spks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  spk_number TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES users(id),
  sales_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_nik TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'APPROVAL SVP', 'DISETUJUI', 'DALAM PENGIRIMAN', 'SELESAI', 'DITOLAK')),
  verified_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  delivery_status TEXT
    CHECK (delivery_status IS NULL OR delivery_status IN ('ready', 'in_delivery', 'delivered')),
  driver_id UUID REFERENCES users(id),
  delivery_photo_path TEXT,
  delivery_latitude NUMERIC(10, 7),
  delivery_longitude NUMERIC(10, 7),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, spk_number),
  UNIQUE (id, company_id),
  FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id),
  FOREIGN KEY (unit_id, company_id) REFERENCES dealer_motor_units(id, company_id),
  CHECK ((delivery_latitude IS NULL AND delivery_longitude IS NULL)
    OR (delivery_latitude BETWEEN -90 AND 90 AND delivery_longitude BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS dealer_motor_spks_company_status_idx
  ON dealer_motor_spks (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS dealer_motor_spks_company_sales_idx
  ON dealer_motor_spks (company_id, submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS dealer_motor_spks_driver_status_idx
  ON dealer_motor_spks (company_id, driver_id, delivery_status, created_at DESC);

CREATE TABLE IF NOT EXISTS dealer_motor_unit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL,
  spk_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('opening', 'incoming', 'approved_for_delivery', 'in_delivery', 'delivered')),
  note TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (unit_id, company_id) REFERENCES dealer_motor_units(id, company_id),
  FOREIGN KEY (spk_id, company_id) REFERENCES dealer_motor_spks(id, company_id)
);

CREATE INDEX IF NOT EXISTS dealer_motor_unit_events_history_idx
  ON dealer_motor_unit_events (company_id, unit_id, created_at DESC);

UPDATE users AS u
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT p.value), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    COALESCE(u.permissions, '[]'::jsonb)
    || CASE u.role
      WHEN 'OWNER' THEN '["spkVerify","spkApprove"]'::jsonb
      WHEN 'SUPER ADMIN' THEN '["spkVerify","spkApprove"]'::jsonb
      WHEN 'ADMIN' THEN '["spkVerify"]'::jsonb
      WHEN 'SVP' THEN '["spkApprove"]'::jsonb
      ELSE '[]'::jsonb
    END
  ) AS p(value)
)
WHERE u.role IN ('OWNER', 'SUPER ADMIN', 'ADMIN', 'SVP');

UPDATE users AS u
SET branch_id = (
  SELECT b.id
  FROM business_branches AS b
  WHERE b.company_id = u.company_id
    AND b.is_primary = true
    AND b.active = true
  LIMIT 1
)
WHERE u.company_id IS NOT NULL
  AND u.branch_id IS NULL
  AND u.role IN ('SALES', 'DRIVER')
  AND EXISTS (
    SELECT 1
    FROM business_branches AS b
    WHERE b.company_id = u.company_id
      AND b.is_primary = true
      AND b.active = true
  );
