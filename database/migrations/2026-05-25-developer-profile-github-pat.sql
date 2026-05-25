-- Add github_pat column to developer_profiles.
-- Stored encrypted with the developer's DEK (same pattern as buffer_access_token).
-- Used as fallback when the GitHub App is not installed on the repo's organization.

ALTER TABLE developer_profiles
  ADD COLUMN IF NOT EXISTS github_pat TEXT DEFAULT NULL;
