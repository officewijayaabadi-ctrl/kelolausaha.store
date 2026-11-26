UPDATE users AS u
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT permission), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    COALESCE(u.permissions, '[]'::jsonb) || '["themeManage"]'::jsonb
  ) AS existing(permission)
)
WHERE u.role IN ('OWNER', 'SUPER ADMIN');
