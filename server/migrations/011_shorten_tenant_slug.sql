CREATE TABLE IF NOT EXISTS company_slug_aliases (
  alias_slug TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_slug_aliases_company_id_idx
  ON company_slug_aliases (company_id);

DO $$
DECLARE
  old_slug TEXT := 'usaha-dealer-6497b6127c474e9db11cdcccd1b4f100';
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INTEGER := 2;
  tenant_id UUID;
  alias_owner UUID;
  business_name TEXT;
BEGIN
  SELECT id, name INTO tenant_id, business_name
  FROM companies
  WHERE slug = old_slug
  FOR UPDATE;

  IF tenant_id IS NOT NULL THEN
    SELECT company_id INTO alias_owner
    FROM company_slug_aliases
    WHERE alias_slug = old_slug;

    IF alias_owner IS NOT NULL AND alias_owner <> tenant_id THEN
      RAISE EXCEPTION 'Tenant slug alias % is already assigned to another company', old_slug;
    END IF;

    base_slug := LEFT(
      COALESCE(
        NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(business_name), '[^a-z0-9]+', '-', 'g')), ''),
        'usaha'
      ),
      50
    );
    base_slug := TRIM(BOTH '-' FROM base_slug);

    candidate_slug := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM companies
      WHERE slug = candidate_slug AND id <> tenant_id
    ) OR EXISTS (
      SELECT 1 FROM company_slug_aliases
      WHERE alias_slug = candidate_slug AND company_id <> tenant_id
    ) LOOP
      candidate_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    INSERT INTO company_slug_aliases (alias_slug, company_id)
    VALUES (old_slug, tenant_id)
    ON CONFLICT (alias_slug) DO NOTHING;

    UPDATE companies
    SET slug = candidate_slug
    WHERE id = tenant_id;
  END IF;
END $$;
