alter table public.bid_attachments
  add column if not exists description text;

comment on column public.bid_attachments.description is
  'Optional user-entered description for bid attachment rows.';
