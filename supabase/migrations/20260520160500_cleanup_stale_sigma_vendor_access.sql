-- Clean up stale Sigma vendor-access ghosts for removed vendor portal users.
-- These rows were left behind after earlier removals and caused users to linger
-- in User Management -> Vendor Access Users even though they were already removed.

-- Mike test / portalwisp@gmail.com: remove stale Sigma vendor access.
delete from public.company_access_requests
where id = '35077200-10af-47a9-b560-461e3b8bf772';

update public.user_company_access
set is_active = false
where id = '9a201799-78af-4a25-b4e9-da107d8459cf';

update public.profiles
set vendor_id = null,
    vendor_portal_role = null
where user_id = '90f75d42-dd33-42a5-8f8c-1993938e1d0f'
  and not exists (
    select 1
    from public.vendor_invitations vi
    where vi.created_user_id = profiles.user_id
      and vi.status in ('accepted', 'suspended')
  );

-- support@portalwifi.tech: remove stale Sigma vendor/company access that was
-- keeping this login attached to Sigma after the vendor portal user was removed.
delete from public.company_access_requests
where id = '13791155-065b-4272-bf91-96672a4debe8';

delete from public.pending_user_invites
where id = '02a147b0-5878-4504-ba9c-f9527d3c9927';

update public.user_company_access
set is_active = false
where id = '491e9ac3-0ee3-4ff8-a606-b04720a09b3a';

update public.profiles
set current_company_id = null,
    default_company_id = null
where user_id = 'e06b56a4-9b2c-42f4-ae50-595156544bf5'
  and (
    current_company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
    or default_company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
  );
