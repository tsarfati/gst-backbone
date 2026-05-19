-- Temporarily disable the audit trigger on companies
ALTER TABLE companies DISABLE TRIGGER company_settings_audit_trigger;

-- Create a "Legacy" tenant for pre-existing companies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
  ) THEN
    INSERT INTO tenants (id, name, slug, owner_id, subscription_tier, is_active, created_at)
    VALUES (
      'a0000000-0000-0000-0000-000000000001',
      'Legacy Organization',
      'legacy-org',
      'dcdfec98-5141-4559-adb2-fe1d70bfce98',
      'enterprise',
      true,
      NOW()
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO tenant_members (tenant_id, user_id, role)
    VALUES (
      'a0000000-0000-0000-0000-000000000001',
      'dcdfec98-5141-4559-adb2-fe1d70bfce98',
      'owner'
    )
    ON CONFLICT DO NOTHING;

    UPDATE companies
    SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE tenant_id IS NULL;
  END IF;
END;
$$;

-- Re-enable the audit trigger
ALTER TABLE companies ENABLE TRIGGER company_settings_audit_trigger;
