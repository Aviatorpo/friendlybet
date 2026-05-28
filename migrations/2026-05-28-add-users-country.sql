-- Add a `country` column to users (2-letter ISO 3166-1 alpha-2, e.g. "US", "IL", "BR").
-- Captured at signup time from the client-side ipapi.co lookup (see i18n.js geoDetectCountryAsync).
-- Existing rows stay NULL; the dashboard shows them as "(לא מתועד)" like signup_source.
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
