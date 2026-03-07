alter table public.payables_settings
add column if not exists require_bill_distribution_before_approval boolean default true;

update public.payables_settings
set require_bill_distribution_before_approval = true
where require_bill_distribution_before_approval is null;

alter table public.payables_settings
alter column require_bill_distribution_before_approval set default true;

alter table public.payables_settings
alter column require_bill_distribution_before_approval set not null;
