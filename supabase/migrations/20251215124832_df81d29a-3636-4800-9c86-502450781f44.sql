-- Fix Security Definer View warning by recreating views with SECURITY INVOKER
-- This ensures RLS policies of the querying user are enforced, not the view creator

-- Recreate dynamic_budget_summary with SECURITY INVOKER
DROP VIEW IF EXISTS public.dynamic_budget_summary;
CREATE VIEW public.dynamic_budget_summary 
WITH (security_invoker = true)
AS
SELECT jb.id AS parent_budget_id,
    jb.job_id,
    jb.cost_code_id AS parent_cost_code_id,
    cc.code AS cost_code,
    cc.description AS cost_code_description,
    cc.is_dynamic_group,
    jb.budgeted_amount AS dynamic_budget,
    COALESCE(sum(child_jb.actual_amount), 0::numeric) AS total_actual_from_children,
    COALESCE(sum(child_jb.committed_amount), 0::numeric) AS total_committed_from_children,
    jb.budgeted_amount - COALESCE(sum(child_jb.actual_amount), 0::numeric) AS remaining_budget,
    CASE
        WHEN COALESCE(sum(child_jb.actual_amount), 0::numeric) > jb.budgeted_amount THEN true
        ELSE false
    END AS is_over_budget,
    count(child_jb.id) AS child_count
FROM job_budgets jb
JOIN cost_codes cc ON cc.id = jb.cost_code_id
LEFT JOIN cost_codes child_cc ON child_cc.parent_cost_code_id = cc.id
LEFT JOIN job_budgets child_jb ON child_jb.cost_code_id = child_cc.id AND child_jb.job_id = jb.job_id
WHERE jb.is_dynamic = true
GROUP BY jb.id, jb.job_id, jb.cost_code_id, cc.code, cc.description, cc.is_dynamic_group, jb.budgeted_amount;

-- Recreate job_cost_summary with SECURITY INVOKER
DROP VIEW IF EXISTS public.job_cost_summary;
CREATE VIEW public.job_cost_summary 
WITH (security_invoker = true)
AS
SELECT j.id AS job_id,
    j.name AS job_name,
    cc.id AS cost_code_id,
    cc.code AS cost_code,
    cc.description AS cost_code_description,
    sum(
        CASE
            WHEN ca.account_type = ANY (ARRAY['expense'::text, 'cost_of_goods_sold'::text]) THEN jel.debit_amount - jel.credit_amount
            ELSE 0::numeric
        END) AS total_cost,
    sum(
        CASE
            WHEN jel.billable = true THEN jel.billable_amount
            ELSE 0::numeric
        END) AS total_billable,
    count(jel.id) AS transaction_count
FROM jobs j
LEFT JOIN cost_codes cc ON cc.job_id = j.id
LEFT JOIN journal_entry_lines jel ON jel.job_id = j.id AND jel.cost_code_id = cc.id
LEFT JOIN chart_of_accounts ca ON ca.id = jel.account_id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'::text
GROUP BY j.id, j.name, cc.id, cc.code, cc.description;

-- Recreate vendor_compliance_warnings with SECURITY INVOKER
DROP VIEW IF EXISTS public.vendor_compliance_warnings;
CREATE VIEW public.vendor_compliance_warnings 
WITH (security_invoker = true)
AS
SELECT vcd.id,
    vcd.vendor_id,
    vcd.type,
    vcd.is_required,
    vcd.is_uploaded,
    vcd.file_name,
    vcd.file_url,
    vcd.uploaded_at,
    vcd.expiration_date,
    vcd.created_at,
    vcd.updated_at,
    v.name AS vendor_name,
    v.company_id,
    CASE
        WHEN vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE THEN true
        ELSE false
    END AS is_expired,
    CASE
        WHEN vcd.expiration_date IS NOT NULL THEN vcd.expiration_date - CURRENT_DATE
        ELSE NULL::integer
    END AS days_until_expiration,
    CASE
        WHEN vcd.is_required AND NOT vcd.is_uploaded THEN 'missing_required'::text
        WHEN vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE THEN 'expired'::text
        WHEN vcd.expiration_date IS NOT NULL AND (vcd.expiration_date - CURRENT_DATE) <= 30 THEN 'expiring_soon'::text
        ELSE 'compliant'::text
    END AS warning_level,
    CASE
        WHEN vcd.is_required AND NOT vcd.is_uploaded THEN 'Required document not uploaded'::text
        WHEN vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE THEN 'Document expired on '::text || to_char(vcd.expiration_date::timestamp with time zone, 'MM/DD/YYYY'::text)
        WHEN vcd.expiration_date IS NOT NULL AND (vcd.expiration_date - CURRENT_DATE) <= 30 THEN ('Document expires in '::text || (vcd.expiration_date - CURRENT_DATE)) || ' days'::text
        ELSE 'Document is compliant'::text
    END AS warning_message
FROM vendor_compliance_documents vcd
JOIN vendors v ON v.id = vcd.vendor_id
WHERE vcd.is_required = true AND (vcd.is_uploaded = false OR vcd.expiration_date IS NOT NULL AND vcd.expiration_date < CURRENT_DATE OR vcd.expiration_date IS NOT NULL AND (vcd.expiration_date - CURRENT_DATE) <= 30);