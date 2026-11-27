UPDATE users AS u
SET permissions = (
  SELECT COALESCE(jsonb_agg(DISTINCT p.value), '[]'::jsonb)
  FROM jsonb_array_elements_text(
    COALESCE(u.permissions, '[]'::jsonb)
    || CASE u.role
      WHEN 'ADMIN' THEN '["pdiManage","waybillManage"]'::jsonb
      WHEN 'OWNER' THEN '["pdiManage","waybillManage"]'::jsonb
      WHEN 'SUPER ADMIN' THEN '["pdiManage","waybillManage"]'::jsonb
      ELSE '[]'::jsonb
    END
  ) AS p(value)
)
WHERE u.role IN ('ADMIN', 'OWNER', 'SUPER ADMIN');
