ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));
