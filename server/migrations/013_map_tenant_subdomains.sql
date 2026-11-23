CREATE TABLE IF NOT EXISTS tenant_slug_migration_runs (
  migration_key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  tenant RECORD;
  base_slug TEXT;
  candidate_slug TEXT;
  alias_owner UUID;
  suffix INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('map-tenant-subdomains-v1'));

  IF EXISTS (
    SELECT 1
    FROM tenant_slug_migration_runs
    WHERE migration_key = 'map-tenant-subdomains-v1'
  ) THEN
    RETURN;
  END IF;

  FOR tenant IN
    SELECT id, slug, name
    FROM companies
    ORDER BY id
    FOR UPDATE
  LOOP
    base_slug := LEFT(
      COALESCE(
        NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(tenant.name), '[^a-z0-9]+', '-', 'g')), ''),
        'usaha'
      ),
      50
    );
    base_slug := TRIM(BOTH '-' FROM base_slug);
    IF base_slug LIKE 'usaha-%' THEN
      base_slug := SUBSTRING(base_slug FROM 7);
    END IF;
    IF base_slug = '' THEN
      base_slug := 'usaha';
    END IF;

    candidate_slug := base_slug;
    suffix := 2;
    WHILE EXISTS (
      SELECT 1 FROM companies
      WHERE slug = candidate_slug AND id <> tenant.id
    ) OR EXISTS (
      SELECT 1 FROM company_slug_aliases
      WHERE alias_slug = candidate_slug AND company_id <> tenant.id
    ) LOOP
      candidate_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    IF tenant.slug <> candidate_slug THEN
      SELECT company_id INTO alias_owner
      FROM company_slug_aliases
      WHERE alias_slug = tenant.slug;

      IF alias_owner IS NOT NULL AND alias_owner <> tenant.id THEN
        RAISE EXCEPTION 'Tenant slug alias % is already assigned to another company', tenant.slug;
      END IF;

      INSERT INTO company_slug_aliases (alias_slug, company_id)
      VALUES (tenant.slug, tenant.id)
      ON CONFLICT (alias_slug) DO NOTHING;

      UPDATE companies
      SET slug = candidate_slug
      WHERE id = tenant.id;
    END IF;

    DELETE FROM company_slug_aliases
    WHERE alias_slug = candidate_slug AND company_id = tenant.id;
  END LOOP;

  INSERT INTO tenant_slug_migration_runs (migration_key)
  VALUES ('map-tenant-subdomains-v1');
END $$;
