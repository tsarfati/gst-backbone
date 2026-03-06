alter table public.notification_settings
  add column if not exists new_bid_notifications boolean not null default true;

comment on column public.notification_settings.new_bid_notifications is
  'Notify when new bids are submitted for jobs assigned to the user (or any job for privileged roles).';

create or replace function public.notify_new_bid_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bid_vendor_name text;
  bid_rfp_number text;
  bid_rfp_title text;
  bid_job_id uuid;
begin
  select r.rfp_number, r.title, r.job_id
    into bid_rfp_number, bid_rfp_title, bid_job_id
  from public.rfps r
  where r.id = new.rfp_id;

  select v.name into bid_vendor_name
  from public.vendors v
  where v.id = new.vendor_id;

  insert into public.notifications (user_id, title, message, type, read)
  select distinct
    uca.user_id,
    'New bid submitted',
    coalesce(bid_vendor_name, 'A vendor') ||
      ' submitted a bid for ' ||
      coalesce(bid_rfp_number, 'an RFP') ||
      case
        when coalesce(bid_rfp_title, '') <> '' then ' - ' || bid_rfp_title
        else ''
      end,
    'bid:new:' || new.id::text,
    false
  from public.user_company_access uca
  left join public.notification_settings ns
    on ns.user_id = uca.user_id
   and ns.company_id = uca.company_id
  left join public.user_job_access uja
    on uja.user_id = uca.user_id
   and uja.job_id = bid_job_id
  where uca.company_id = new.company_id
    and uca.is_active = true
    and (auth.uid() is null or uca.user_id <> auth.uid())
    and coalesce(ns.in_app_enabled, true) = true
    and coalesce(ns.new_bid_notifications, true) = true
    and (
      lower(uca.role::text) in ('owner', 'admin', 'company_admin', 'controller')
      or (bid_job_id is not null and uja.user_id is not null)
    );

  return new;
end;
$$;

drop trigger if exists trg_notify_new_bid_submitted on public.bids;

create trigger trg_notify_new_bid_submitted
after insert on public.bids
for each row
execute function public.notify_new_bid_submitted();
