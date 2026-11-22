ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE companies
SET slug = LEFT(
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-', 'g')), ''),
    'usaha'
  ),
  50
) || '-' || REPLACE(id::text, '-', '')
WHERE slug IS NULL;

ALTER TABLE companies ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique_idx ON companies (slug);
