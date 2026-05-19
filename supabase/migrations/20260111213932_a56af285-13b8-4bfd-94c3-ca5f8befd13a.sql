-- Add existing authenticated users as members of the Legacy Organization
-- (excluding the owner who is already added)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tenant_members
    WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  ) OR EXISTS (
    SELECT 1
    FROM tenants
    WHERE id = 'a0000000-0000-0000-0000-000000000001'
  ) THEN
    INSERT INTO tenant_members (tenant_id, user_id, role)
    VALUES 
      ('a0000000-0000-0000-0000-000000000001', '201df05e-50ca-4208-b49c-58a441280122', 'member'),
      ('a0000000-0000-0000-0000-000000000001', 'd73909c6-a3a1-48f7-a63d-651b7c310e8d', 'member'),
      ('a0000000-0000-0000-0000-000000000001', 'fa67f9ba-67fc-4708-9526-7bfef906dae3', 'member'),
      ('a0000000-0000-0000-0000-000000000001', '753df152-d63e-497f-aa97-252777ac6d4f', 'admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
END;
$$;
