alter table public.employee_timecard_settings
  add column if not exists hourly_rate numeric(12, 2);

comment on column public.employee_timecard_settings.hourly_rate
  is 'Base hourly labor rate used for timecard labor-cost reporting.';
