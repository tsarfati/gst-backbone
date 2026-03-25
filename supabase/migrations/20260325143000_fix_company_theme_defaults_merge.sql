create or replace function public.get_company_theme_defaults(_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_settings jsonb;
  v_legacy_settings jsonb;
begin
  if v_user_id is null or _company_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.user_company_access uca
    where uca.company_id = _company_id
      and uca.user_id = v_user_id
      and coalesce(uca.is_active, true) = true
  ) then
    return null;
  end if;

  select cus.settings::jsonb
  into v_company_settings
  from public.company_ui_settings cus
  where cus.company_id = _company_id
    and cus.user_id is null
  order by cus.updated_at desc nulls last, cus.created_at desc nulls last
  limit 1;

  select cus.settings::jsonb
  into v_legacy_settings
  from public.company_ui_settings cus
  join public.user_company_access uca
    on uca.company_id = cus.company_id
   and uca.user_id = cus.user_id
   and coalesce(uca.is_active, true) = true
  where cus.company_id = _company_id
    and cus.user_id is not null
    and lower(coalesce(uca.role::text, '')) in ('admin', 'company_admin', 'controller', 'owner')
  order by cus.updated_at desc nulls last, cus.created_at desc nulls last
  limit 1;

  if v_company_settings is null and v_legacy_settings is null then
    return null;
  end if;

  if v_company_settings is null then
    return v_legacy_settings;
  end if;

  if v_legacy_settings is null then
    return v_company_settings;
  end if;

  return jsonb_build_object(
    'navigationMode', coalesce(v_company_settings -> 'navigationMode', v_legacy_settings -> 'navigationMode'),
    'theme', coalesce(v_company_settings -> 'theme', v_legacy_settings -> 'theme'),
    'themeVariant', coalesce(v_company_settings -> 'themeVariant', v_legacy_settings -> 'themeVariant'),
    'dateFormat', coalesce(v_company_settings -> 'dateFormat', v_legacy_settings -> 'dateFormat'),
    'timeZone', coalesce(v_company_settings -> 'timeZone', v_legacy_settings -> 'timeZone'),
    'currencyFormat', coalesce(v_company_settings -> 'currencyFormat', v_legacy_settings -> 'currencyFormat'),
    'distanceUnit', coalesce(v_company_settings -> 'distanceUnit', v_legacy_settings -> 'distanceUnit'),
    'defaultView', coalesce(v_company_settings -> 'defaultView', v_legacy_settings -> 'defaultView'),
    'itemsPerPage', coalesce(v_company_settings -> 'itemsPerPage', v_legacy_settings -> 'itemsPerPage'),
    'notifications', coalesce(v_company_settings -> 'notifications', v_legacy_settings -> 'notifications'),
    'autoSave', coalesce(v_company_settings -> 'autoSave', v_legacy_settings -> 'autoSave'),
    'compactMode', coalesce(v_company_settings -> 'compactMode', v_legacy_settings -> 'compactMode'),
    'sidebarHighlightOpacity', coalesce(v_company_settings -> 'sidebarHighlightOpacity', v_legacy_settings -> 'sidebarHighlightOpacity'),
    'customLogo', coalesce(v_company_settings -> 'customLogo', v_legacy_settings -> 'customLogo'),
    'dashboardBanner', coalesce(v_company_settings -> 'dashboardBanner', v_legacy_settings -> 'dashboardBanner'),
    'customColors', coalesce(v_company_settings -> 'customColors', v_legacy_settings -> 'customColors'),
    'companyLogo', coalesce(v_company_settings -> 'companyLogo', v_legacy_settings -> 'companyLogo'),
    'headerLogo', coalesce(v_company_settings -> 'headerLogo', v_legacy_settings -> 'headerLogo'),
    'companySettings', coalesce(v_company_settings -> 'companySettings', v_legacy_settings -> 'companySettings'),
    'avatarLibrary', coalesce(v_company_settings -> 'avatarLibrary', v_legacy_settings -> 'avatarLibrary')
  );
end;
$$;

revoke all on function public.get_company_theme_defaults(uuid) from public;
grant execute on function public.get_company_theme_defaults(uuid) to authenticated;
