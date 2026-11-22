UPDATE users
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT permission), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    users.permissions || CASE users.role
      WHEN 'OWNER' THEN '["attendanceView","attendanceManage"]'::jsonb
      WHEN 'SUPER ADMIN' THEN '["attendanceView"]'::jsonb
      WHEN 'HRD' THEN '["attendanceView","attendanceManage"]'::jsonb
      WHEN 'SVP' THEN '["attendanceView"]'::jsonb
      WHEN 'SPV' THEN '["attendanceView"]'::jsonb
      WHEN 'KEPALA TOKO' THEN '["attendanceView"]'::jsonb
      WHEN 'ADMIN' THEN '["attendanceView"]'::jsonb
      WHEN 'SALES' THEN '["attendanceView"]'::jsonb
      WHEN 'KASIR' THEN '["attendanceView"]'::jsonb
      ELSE '[]'::jsonb
    END
  ) AS item(permission)
)
WHERE role IN ('OWNER', 'SUPER ADMIN', 'HRD', 'SVP', 'SPV', 'KEPALA TOKO', 'ADMIN', 'SALES', 'KASIR');
