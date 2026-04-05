alter table public.time_card_change_requests
  add column if not exists original_punch_in_time timestamptz,
  add column if not exists original_punch_out_time timestamptz,
  add column if not exists original_job_id uuid,
  add column if not exists original_cost_code_id uuid;

update public.time_card_change_requests tccr
set
  original_punch_in_time = coalesce(tccr.original_punch_in_time, tc.punch_in_time),
  original_punch_out_time = coalesce(tccr.original_punch_out_time, tc.punch_out_time),
  original_job_id = coalesce(tccr.original_job_id, tc.job_id),
  original_cost_code_id = coalesce(tccr.original_cost_code_id, tc.cost_code_id)
from public.time_cards tc
where tc.id = tccr.time_card_id
  and (
    tccr.original_punch_in_time is null
    or tccr.original_punch_out_time is null
    or tccr.original_job_id is null
    or tccr.original_cost_code_id is null
  );
