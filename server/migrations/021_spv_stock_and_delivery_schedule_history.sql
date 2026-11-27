ALTER TABLE dealer_motor_spks
  ADD COLUMN IF NOT EXISTS delivery_scheduled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS dealer_motor_delivery_schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  spk_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  previous_scheduled_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (spk_id, company_id)
    REFERENCES dealer_motor_spks(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by, company_id)
    REFERENCES users(id, company_id)
);

CREATE INDEX IF NOT EXISTS dealer_motor_delivery_schedule_history_spk_idx
  ON dealer_motor_delivery_schedule_history (company_id, spk_id, created_at DESC);

UPDATE users AS u
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT p.value), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    COALESCE(u.permissions, '[]'::jsonb)
    || CASE u.role
      WHEN 'SPV' THEN '["unitManage"]'::jsonb
      WHEN 'ADMIN' THEN '["deliveryScheduleManage"]'::jsonb
      WHEN 'OWNER' THEN '["deliveryScheduleManage"]'::jsonb
      WHEN 'SUPER ADMIN' THEN '["deliveryScheduleManage"]'::jsonb
      ELSE '[]'::jsonb
    END
  ) AS p(value)
)
WHERE u.role IN ('SPV', 'ADMIN', 'OWNER', 'SUPER ADMIN');
