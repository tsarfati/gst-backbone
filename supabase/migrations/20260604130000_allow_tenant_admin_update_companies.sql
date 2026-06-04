create policy "Tenant admins can update companies in their tenant"
on public.companies
for update
using (
  public.is_tenant_admin(auth.uid(), tenant_id)
  or public.is_super_admin(auth.uid())
)
with check (
  public.is_tenant_admin(auth.uid(), tenant_id)
  or public.is_super_admin(auth.uid())
);
