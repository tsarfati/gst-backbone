update public.user_company_access uca
set is_active = false
where uca.company_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
  and uca.is_active = true
  and lower(uca.role::text) = 'employee'
  and uca.user_id in (
    select audit.user_id
    from public.audit_company_unknown_employee_access('GreenStar') audit
    where audit.company_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
      and audit.profile_exists = false
      and audit.job_access_count = 0
      and audit.active_company_access_count = 1
  );
