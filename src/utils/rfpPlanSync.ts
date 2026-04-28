import { supabase } from "@/integrations/supabase/client";
import { hydratePlanPagesFromPdfText } from "@/utils/planPageHydration";

type SyncAttachedPlanSetPagesParams = {
  rfpId: string;
  companyId: string;
  createdBy?: string | null;
};

export async function syncAttachedPlanSetPagesToRfp({
  rfpId,
  companyId,
  createdBy,
}: SyncAttachedPlanSetPagesParams) {
  const { data: existingRfpPlanRows, error: existingRfpPlanRowsError } = await supabase
    .from("rfp_plan_pages" as any)
    .select("plan_id, plan_page_id, sort_order")
    .eq("rfp_id", rfpId)
    .eq("company_id", companyId);
  if (existingRfpPlanRowsError) throw existingRfpPlanRowsError;

  const { data: attachments, error: attachmentsError } = await supabase
    .from("rfp_attachments")
    .select("file_url")
    .eq("rfp_id", rfpId)
    .eq("company_id", companyId);
  if (attachmentsError) throw attachmentsError;

  const attachedUrls = Array.from(
    new Set(
      ((attachments || []) as any[])
        .map((row) => String(row.file_url || ""))
        .filter(Boolean),
    ),
  );
  const existingPlanIds = Array.from(
    new Set(
      ((existingRfpPlanRows || []) as any[])
        .map((row) => String(row.plan_id || ""))
        .filter(Boolean),
    ),
  );

  let matchingPlans: any[] = [];
  if (attachedUrls.length > 0) {
    const { data, error: matchingPlansError } = await supabase
      .from("job_plans")
      .select("id, file_url")
      .eq("company_id", companyId)
      .in("file_url", attachedUrls);
    if (matchingPlansError) throw matchingPlansError;
    matchingPlans = (data || []) as any[];
  }

  let existingPlansById: any[] = [];
  if (existingPlanIds.length > 0) {
    const { data, error: existingPlansError } = await supabase
      .from("job_plans")
      .select("id, file_url")
      .eq("company_id", companyId)
      .in("id", existingPlanIds);
    if (existingPlansError) throw existingPlansError;
    existingPlansById = (data || []) as any[];
  }

  const planRows = Array.from(
    new Map(
      [...matchingPlans, ...existingPlansById]
        .map((row) => [String(row.id || ""), {
          id: String(row.id || ""),
          file_url: String(row.file_url || ""),
        }]),
    ).values(),
  ).filter((row) => row.id && row.file_url);

  if (planRows.length === 0) {
    return { insertedCount: 0 };
  }

  for (const plan of planRows) {
    try {
      await hydratePlanPagesFromPdfText({
        planId: plan.id,
        planUrl: plan.file_url,
        companyId,
      });
    } catch (hydrationError) {
      console.warn(`Failed hydrating attached RFP plan ${plan.id}:`, hydrationError);
    }
  }

  const planIds = planRows.map((plan) => plan.id);
  const { data: planPages, error: planPagesError } = await supabase
    .from("plan_pages" as any)
    .select("id, plan_id, page_number")
    .in("plan_id", planIds)
    .order("page_number", { ascending: true });

  if (planPagesError) throw planPagesError;

  const existingPlanPageIds = new Set(
    ((existingRfpPlanRows || []) as any[])
      .map((row) => String(row.plan_page_id || ""))
      .filter(Boolean),
  );
  const maxSortOrder = Math.max(
    -1,
    ...((existingRfpPlanRows || []) as any[]).map((row) => Number(row.sort_order || 0)),
  );

  const missingRows = ((planPages || []) as any[])
    .map((row) => ({
      plan_id: String(row.plan_id || ""),
      plan_page_id: String(row.id || ""),
      page_number: Number(row.page_number || 0),
    }))
    .filter((row) => row.plan_id && row.plan_page_id && !existingPlanPageIds.has(row.plan_page_id))
    .sort((a, b) => {
      if (a.plan_id !== b.plan_id) return a.plan_id.localeCompare(b.plan_id);
      return a.page_number - b.page_number;
    });

  if (missingRows.length === 0) {
    return { insertedCount: 0 };
  }

  const insertRows = missingRows.map((row, index) => ({
    rfp_id: rfpId,
    company_id: companyId,
    plan_id: row.plan_id,
    plan_page_id: row.plan_page_id,
    sort_order: maxSortOrder + index + 1,
    is_primary: false,
    note: null,
    created_by: createdBy || null,
  }));

  const { error: insertError } = await supabase
    .from("rfp_plan_pages" as any)
    .insert(insertRows);
  if (insertError) throw insertError;

  return { insertedCount: insertRows.length };
}
