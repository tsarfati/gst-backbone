begin;

select plan(11);

create schema if not exists test_helpers;

create or replace function test_helpers.authenticate_as(user_id uuid, jwt_role text default 'authenticated')
returns void
language plpgsql
as $$
begin
  execute format('set local role %I', jwt_role);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', jwt_role)::text,
    true
  );
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  perform set_config('request.jwt.claim.role', jwt_role, true);
end;
$$;

create or replace function test_helpers.clear_auth()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{}'::text, true);
  perform set_config('request.jwt.claim.sub', ''::text, true);
  perform set_config('request.jwt.claim.role', ''::text, true);
end;
$$;

create or replace function test_helpers.seed_auth_user(user_id uuid, email text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    email,
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiKqV/KxNq2WEYLRh3SeDsICoZ6irWm',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function test_helpers.update_profile_name(target_user_id uuid, next_name text)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update public.profiles
     set display_name = next_name
   where user_id = target_user_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function test_helpers.update_company_access_role(target_user_id uuid, target_company_id uuid, next_role public.user_role)
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update public.user_company_access
     set role = next_role
   where user_id = target_user_id
     and company_id = target_company_id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function test_helpers.try_insert_company_access(
  target_user_id uuid,
  target_company_id uuid,
  target_role public.user_role,
  granted_by_user_id uuid
)
returns text
language plpgsql
as $$
begin
  insert into public.user_company_access (user_id, company_id, role, granted_by, is_active)
  values (target_user_id, target_company_id, target_role, granted_by_user_id, true);

  return 'ok';
exception
  when others then
    return sqlstate;
end;
$$;

select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000001', 'admin-a@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000002', 'controller-a@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000003', 'company-admin-a@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000004', 'employee-a@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000005', 'employee-peer-a@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000006', 'admin-b@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000007', 'employee-b@example.com');
select test_helpers.seed_auth_user('10000000-0000-0000-0000-000000000008', 'new-hire@example.com');

insert into public.companies (id, name, display_name, created_by, is_active)
values
  ('20000000-0000-0000-0000-000000000001', 'Company A', 'Company A', '10000000-0000-0000-0000-000000000001', true),
  ('20000000-0000-0000-0000-000000000002', 'Company B', 'Company B', '10000000-0000-0000-0000-000000000006', true);

insert into public.profiles (
  user_id,
  first_name,
  last_name,
  display_name,
  role,
  current_company_id,
  profile_completed
) values
  ('10000000-0000-0000-0000-000000000001', 'Admin', 'A', 'Admin A', 'admin', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000002', 'Controller', 'A', 'Controller A', 'controller', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000003', 'Company', 'Admin', 'Company Admin A', 'company_admin', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000004', 'Employee', 'A', 'Employee A', 'employee', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000005', 'Employee', 'Peer', 'Employee Peer A', 'employee', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000006', 'Admin', 'B', 'Admin B', 'admin', '20000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-000000000007', 'Employee', 'B', 'Employee B', 'employee', '20000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-000000000008', 'New', 'Hire', 'New Hire', 'employee', '20000000-0000-0000-0000-000000000001', false);

insert into public.user_company_access (
  user_id,
  company_id,
  role,
  granted_by,
  is_active
) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'admin', '10000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'controller', '10000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'company_admin', '10000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'employee', '10000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'employee', '10000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'admin', '10000000-0000-0000-0000-000000000006', true),
  ('10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'employee', '10000000-0000-0000-0000-000000000006', true);

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.profiles where user_id = '10000000-0000-0000-0000-000000000004'),
  1,
  'employee can view their own profile'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.profiles where user_id = '10000000-0000-0000-0000-000000000005'),
  1,
  'employee can view another profile in the same company'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.profiles where user_id = '10000000-0000-0000-0000-000000000007'),
  0,
  'employee cannot view a profile from a different company'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000001');
select is(
  test_helpers.update_profile_name('10000000-0000-0000-0000-000000000005', 'Admin Updated Peer'),
  1,
  'admin can update another member profile in the same company'
);
select test_helpers.clear_auth();

select is(
  (select display_name from public.profiles where user_id = '10000000-0000-0000-0000-000000000005'),
  'Admin Updated Peer',
  'admin profile update persisted'
);

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000003');
select is(
  test_helpers.update_profile_name('10000000-0000-0000-0000-000000000005', 'Company Admin Updated Peer'),
  1,
  'company_admin can update another member profile in the same company'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000004');
select is(
  test_helpers.update_profile_name('10000000-0000-0000-0000-000000000005', 'Employee Attempted Update'),
  0,
  'employee cannot update another member profile'
);
select test_helpers.clear_auth();

select is(
  (select display_name from public.profiles where user_id = '10000000-0000-0000-0000-000000000005'),
  'Company Admin Updated Peer',
  'blocked employee update leaves peer profile unchanged'
);

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.user_company_access),
  5,
  'employee can view only user_company_access rows for their own company'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000001');
select is(
  test_helpers.try_insert_company_access(
    '10000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    'employee',
    '10000000-0000-0000-0000-000000000001'
  ),
  'ok',
  'admin can grant access inside their company'
);
select test_helpers.clear_auth();

select is(
  (select count(*)::int from public.user_company_access where user_id = '10000000-0000-0000-0000-000000000008' and company_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'new company access row was inserted by admin'
);

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000004');
select is(
  test_helpers.try_insert_company_access(
    '10000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    'employee',
    '10000000-0000-0000-0000-000000000004'
  ),
  '42501',
  'employee cannot grant company access'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000001');
select is(
  test_helpers.try_insert_company_access(
    '10000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000002',
    'employee',
    '10000000-0000-0000-0000-000000000001'
  ),
  '42501',
  'admin cannot grant access in a different company'
);
select test_helpers.clear_auth();

select test_helpers.authenticate_as('10000000-0000-0000-0000-000000000002');
select is(
  test_helpers.update_company_access_role(
    '10000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    'view_only'
  ),
  1,
  'controller can update company access inside their company'
);
select test_helpers.clear_auth();

select * from finish();
rollback;
