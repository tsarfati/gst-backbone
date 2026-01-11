-- Temporarily disable the audit trigger on companies
ALTER TABLE companies DISABLE TRIGGER company_settings_audit_trigger;

-- Create a "Legacy" tenant for pre-existing companies
INSERT INTO tenants (id, name, slug, owner_id, subscription_tier, is_active, created_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Legacy Organization',
  'legacy-org',
  'dcdfec98-5141-4559-adb2-fe1d70bfce98',
  'enterprise',
  true,
  NOW()
);

-- Add the super admin as tenant owner
INSERT INTO tenant_members (tenant_id, user_id, role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'dcdfec98-5141-4559-adb2-fe1d70bfce98',
  'owner'
);

-- Assign all existing companies (with null tenant_id) to the Legacy tenant
UPDATE companies
SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Re-enable the audit trigger
ALTER TABLE companies ENABLE TRIGGER company_settings_audit_trigger;