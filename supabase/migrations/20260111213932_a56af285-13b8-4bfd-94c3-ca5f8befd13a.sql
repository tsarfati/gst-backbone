-- Add existing authenticated users as members of the Legacy Organization
-- (excluding the owner who is already added)

INSERT INTO tenant_members (tenant_id, user_id, role)
VALUES 
  -- GREEN STAR TEAM (employee role in profiles)
  ('a0000000-0000-0000-0000-000000000001', '201df05e-50ca-4208-b49c-58a441280122', 'member'),
  -- Rodrigo Rodriguez (project_manager role in profiles)
  ('a0000000-0000-0000-0000-000000000001', 'd73909c6-a3a1-48f7-a63d-651b7c310e8d', 'member'),
  -- Michael Tsarfati @ mike@greenstarteam.com (view_only role in profiles)
  ('a0000000-0000-0000-0000-000000000001', 'fa67f9ba-67fc-4708-9526-7bfef906dae3', 'member'),
  -- Daniela Rodriguez (admin role in profiles)
  ('a0000000-0000-0000-0000-000000000001', '753df152-d63e-497f-aa97-252777ac6d4f', 'admin')
ON CONFLICT (tenant_id, user_id) DO NOTHING;