UPDATE users
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT permission), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    users.permissions || '["accessManage","themeManage"]'::jsonb
  ) AS item(permission)
  WHERE permission NOT IN (
    'reportsView', 'targetManage', 'financeView', 'financeManage',
    'activationManage'
  )
)
WHERE role = 'SUPER ADMIN';
