ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS branch_limit INTEGER NOT NULL DEFAULT 3 CHECK (branch_limit >= 1);

CREATE TABLE IF NOT EXISTS business_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, code)
);
CREATE UNIQUE INDEX IF NOT EXISTS business_branches_one_primary_idx
  ON business_branches (company_id) WHERE is_primary = true;
CREATE UNIQUE INDEX IF NOT EXISTS users_id_company_idx ON users (id, company_id);

INSERT INTO business_branches (company_id, name, code, is_primary)
SELECT c.id, 'Cabang Utama', 'PUSAT', true
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM business_branches b WHERE b.company_id = c.id
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID;
UPDATE users u
SET branch_id = b.id
FROM business_branches b
WHERE u.company_id = b.company_id
  AND b.is_primary = true
  AND u.branch_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_branch_company_fk') THEN
    ALTER TABLE users ADD CONSTRAINT users_branch_company_fk
      FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id);
  END IF;
END $$;

ALTER TABLE team_invites ADD COLUMN IF NOT EXISTS branch_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_invites_branch_company_fk') THEN
    ALTER TABLE team_invites ADD CONSTRAINT team_invites_branch_company_fk
      FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id);
  END IF;
END $$;

ALTER TABLE business_orders ADD COLUMN IF NOT EXISTS branch_id UUID;
UPDATE business_orders o
SET branch_id = b.id
FROM business_branches b
WHERE o.company_id = b.company_id AND b.is_primary = true AND o.branch_id IS NULL;
ALTER TABLE business_orders ALTER COLUMN branch_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_orders_branch_company_fk') THEN
    ALTER TABLE business_orders ADD CONSTRAINT business_orders_branch_company_fk
      FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS business_orders_branch_created_idx
  ON business_orders (company_id, branch_id, created_at DESC);

ALTER TABLE business_purchases ADD COLUMN IF NOT EXISTS branch_id UUID;
UPDATE business_purchases p
SET branch_id = b.id
FROM business_branches b
WHERE p.company_id = b.company_id AND b.is_primary = true AND p.branch_id IS NULL;
ALTER TABLE business_purchases ALTER COLUMN branch_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_purchases_branch_company_fk') THEN
    ALTER TABLE business_purchases ADD CONSTRAINT business_purchases_branch_company_fk
      FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id);
  END IF;
END $$;

ALTER TABLE company_ledger_entries ADD COLUMN IF NOT EXISTS branch_id UUID;
UPDATE company_ledger_entries e
SET branch_id = b.id
FROM business_branches b
WHERE e.company_id = b.company_id AND b.is_primary = true AND e.branch_id IS NULL;
ALTER TABLE company_ledger_entries ALTER COLUMN branch_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_ledger_branch_company_fk') THEN
    ALTER TABLE company_ledger_entries ADD CONSTRAINT company_ledger_branch_company_fk
      FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS company_ledger_branch_date_idx
  ON company_ledger_entries (company_id, branch_id, entry_date DESC);

ALTER TABLE billing_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS branch_count INTEGER,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER;

CREATE TABLE IF NOT EXISTS branch_addon_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  billing_order_id UUID NOT NULL UNIQUE REFERENCES billing_orders(id) ON DELETE CASCADE,
  branch_count INTEGER NOT NULL CHECK (branch_count > 0),
  duration_months INTEGER NOT NULL CHECK (duration_months IN (0, 1, 3, 6, 12)),
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((duration_months = 0 AND active_until IS NULL) OR duration_months > 0)
);
CREATE INDEX IF NOT EXISTS branch_addon_entitlements_company_active_idx
  ON branch_addon_entitlements (company_id, active_until);

CREATE TABLE IF NOT EXISTS attendance_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  work_start TIME NOT NULL DEFAULT '08:00',
  work_end TIME NOT NULL DEFAULT '17:00',
  work_days SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::SMALLINT[],
  grace_minutes INTEGER NOT NULL DEFAULT 15 CHECK (grace_minutes BETWEEN 0 AND 240),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (work_end > work_start),
  CHECK (cardinality(work_days) BETWEEN 1 AND 7)
);
INSERT INTO attendance_settings (company_id)
SELECT id FROM companies ON CONFLICT (company_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  user_id UUID NOT NULL,
  work_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_photo_url TEXT NOT NULL,
  check_in_latitude NUMERIC(10, 7) NOT NULL,
  check_in_longitude NUMERIC(10, 7) NOT NULL,
  check_in_maps_url TEXT NOT NULL,
  check_out_at TIMESTAMPTZ,
  check_out_photo_url TEXT,
  check_out_latitude NUMERIC(10, 7),
  check_out_longitude NUMERIC(10, 7),
  check_out_maps_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, work_date),
  FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id),
  FOREIGN KEY (user_id, company_id) REFERENCES users(id, company_id),
  CHECK (check_in_latitude BETWEEN -90 AND 90),
  CHECK (check_in_longitude BETWEEN -180 AND 180),
  CHECK (check_out_latitude IS NULL OR check_out_latitude BETWEEN -90 AND 90),
  CHECK (check_out_longitude IS NULL OR check_out_longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS attendance_records_branch_date_idx
  ON attendance_records (company_id, branch_id, work_date DESC);

CREATE TABLE IF NOT EXISTS attendance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('permission', 'leave', 'sick', 'business_trip')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  evidence_photo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, company_id) REFERENCES business_branches(id, company_id),
  FOREIGN KEY (user_id, company_id) REFERENCES users(id, company_id),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS attendance_requests_branch_date_idx
  ON attendance_requests (company_id, branch_id, start_date DESC, status);

UPDATE users
SET permissions = permissions
  || CASE WHEN permissions ? 'attendanceView' THEN '[]'::jsonb ELSE '["attendanceView"]'::jsonb END
  || CASE WHEN permissions ? 'branchManage' THEN '[]'::jsonb ELSE '["branchManage"]'::jsonb END
WHERE role = 'SUPER ADMIN';
UPDATE users
SET permissions = permissions
  || CASE WHEN permissions ? 'attendanceView' THEN '[]'::jsonb ELSE '["attendanceView"]'::jsonb END
  || CASE WHEN permissions ? 'attendanceManage' THEN '[]'::jsonb ELSE '["attendanceManage"]'::jsonb END
  || CASE WHEN permissions ? 'branchManage' THEN '[]'::jsonb ELSE '["branchManage"]'::jsonb END
WHERE role = 'OWNER';
UPDATE users
SET permissions = permissions
  || CASE WHEN permissions ? 'attendanceView' THEN '[]'::jsonb ELSE '["attendanceView"]'::jsonb END
  || CASE WHEN permissions ? 'attendanceManage' THEN '[]'::jsonb ELSE '["attendanceManage"]'::jsonb END
  || CASE WHEN permissions ? 'branchManage' THEN '[]'::jsonb ELSE '["branchManage"]'::jsonb END
WHERE role = 'HRD';
UPDATE users
SET permissions = permissions
  || CASE WHEN permissions ? 'attendanceView' THEN '[]'::jsonb ELSE '["attendanceView"]'::jsonb END
WHERE role IN ('SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR');
