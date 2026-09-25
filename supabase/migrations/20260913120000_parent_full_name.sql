-- Replace the parent-specific name parts with one canonical display name.
ALTER TABLE parents ADD COLUMN full_name TEXT;

UPDATE parents
SET full_name = trim(
  concat_ws(' ',
    NULLIF(trim(last_name), ''),
    NULLIF(trim(post_name), ''),
    NULLIF(trim(first_name), '')
  )
);

ALTER TABLE parents
  ALTER COLUMN full_name SET NOT NULL,
  DROP COLUMN first_name,
  DROP COLUMN post_name,
  DROP COLUMN last_name;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX parents_full_name_search_idx ON parents USING gin (full_name gin_trgm_ops);
