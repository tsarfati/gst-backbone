DO $$
DECLARE
  sigma_company_id CONSTANT uuid := 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';
  sandbox_tenant_id CONSTANT uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  sigma_settings public.company_sms_settings%ROWTYPE;
BEGIN
  SELECT *
  INTO sigma_settings
  FROM public.company_sms_settings
  WHERE company_id = sigma_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No company_sms_settings row found for Sigma company %', sigma_company_id;
  END IF;

  INSERT INTO public.company_sms_settings (
    company_id,
    sms_enabled,
    provider,
    account_sid,
    auth_token,
    phone_number,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    c.id,
    sigma_settings.sms_enabled,
    sigma_settings.provider,
    sigma_settings.account_sid,
    sigma_settings.auth_token,
    sigma_settings.phone_number,
    sigma_settings.created_by,
    now(),
    now()
  FROM public.companies c
  WHERE c.tenant_id = sandbox_tenant_id
    AND c.is_active = true
  ON CONFLICT (company_id) DO UPDATE
  SET
    sms_enabled = EXCLUDED.sms_enabled,
    provider = EXCLUDED.provider,
    account_sid = EXCLUDED.account_sid,
    auth_token = EXCLUDED.auth_token,
    phone_number = EXCLUDED.phone_number,
    updated_at = now();
END $$;
