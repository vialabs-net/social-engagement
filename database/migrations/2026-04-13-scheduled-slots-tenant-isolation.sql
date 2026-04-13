-- Add tenant_id to scheduled_slots so that each tenant has its own slot namespace.
-- Before this migration, the UNIQUE(platform, scheduled_at) constraint was shared
-- across all tenants, causing cross-tenant slot blocking.

-- Step 1: add the column (nullable first so existing rows don't violate NOT NULL)
ALTER TABLE scheduled_slots
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Step 2: remove rows with no tenant (none in production, but just in case)
DELETE FROM scheduled_slots WHERE tenant_id IS NULL;

-- Step 3: enforce NOT NULL now that stale rows are gone
ALTER TABLE scheduled_slots
  ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: replace the old unique constraint with the tenant-scoped one
ALTER TABLE scheduled_slots DROP CONSTRAINT IF EXISTS scheduled_slots_platform_scheduled_at_key;

ALTER TABLE scheduled_slots
  ADD CONSTRAINT scheduled_slots_tenant_platform_scheduled_at_key
  UNIQUE (tenant_id, platform, scheduled_at);
