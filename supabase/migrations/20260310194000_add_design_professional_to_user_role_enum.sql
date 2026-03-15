do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'user_role'
      and e.enumlabel = 'design_professional'
  ) then
    alter type public.user_role add value 'design_professional';
  end if;
end
$$;

