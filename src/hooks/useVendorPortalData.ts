import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileWithProgress } from "@/utils/storageUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";

export interface VendorPortalCompanySummary {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface VendorPortalJob {
  id: string;
  name: string;
  project_number?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  image_url?: string | null;
  company_id: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  can_submit_bills: boolean;
  can_view_plans: boolean;
  can_view_rfis: boolean;
  can_submit_rfis: boolean;
  can_view_submittals: boolean;
  can_submit_submittals: boolean;
  can_view_photos: boolean;
  can_view_rfps: boolean;
  can_submit_bids: boolean;
  can_view_subcontracts: boolean;
  can_access_messages: boolean;
}

export interface VendorPortalInvoice {
  id: string;
  invoice_number: string | null;
  amount: number;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
  job_id: string | null;
  job_name: string | null;
  company_name: string | null;
}

export interface VendorPortalComplianceDocument {
  id: string;
  type: string;
  is_required: boolean;
  is_uploaded: boolean;
  file_name: string | null;
  expiration_date: string | null;
  uploaded_at: string | null;
  file_url?: string | null;
  target_company_id?: string | null;
  target_job_id?: string | null;
}

export interface VendorPortalPaymentMethod {
  type: string;
  check_delivery: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  routing_number?: string | null;
  account_type?: string | null;
  voided_check_url?: string | null;
}

export interface VendorPortalSettingsForm {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  logo_url: string;
  tax_id: string;
}

export function useVendorPortalData() {
  const { user, profile } = useAuth();
  const { currentCompany, refreshCompanies } = useCompany();

  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [jobs, setJobs] = useState<VendorPortalJob[]>([]);
  const [invoices, setInvoices] = useState<VendorPortalInvoice[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<VendorPortalComplianceDocument[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<VendorPortalPaymentMethod | null>(null);
  const [settingsForm, setSettingsForm] = useState<VendorPortalSettingsForm>({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    logo_url: "",
    tax_id: "",
  });

  const isVendorUser = useMemo(
    () => String(profile?.role || "").toLowerCase() === "vendor",
    [profile?.role],
  );

  const syncLinkedBuilderVendorRecords = useCallback(async () => {
    if (!profile?.vendor_id) return;
    const { error } = await supabase.functions.invoke("sync-vendor-portal-data");
    if (error) {
      throw error;
    }
  }, [profile?.vendor_id]);

  const reload = useCallback(async () => {
    if (!profile?.vendor_id) {
      setVendorInfo(null);
      setJobs([]);
      setInvoices([]);
      setComplianceDocs([]);
      setPaymentMethod(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("id, name, contact_person, email, phone, address, city, state, zip_code, logo_url, tax_id, vendor_type")
        .eq("id", profile.vendor_id)
        .single();
      if (vendorError) throw vendorError;
      setVendorInfo(vendor);
      setSettingsForm({
        name: vendor?.name || "",
        contact_person: vendor?.contact_person || "",
        email: vendor?.email || "",
        phone: vendor?.phone || "",
        address: vendor?.address || "",
        city: vendor?.city || "",
        state: vendor?.state || "",
        zip_code: vendor?.zip_code || "",
        logo_url: vendor?.logo_url || currentCompany?.logo_url || "",
        tax_id: vendor?.tax_id || "",
      });

      const { data: docs, error: docsError } = await supabase
        .from("vendor_compliance_documents")
        .select("id, type, is_required, is_uploaded, file_name, expiration_date, uploaded_at, file_url, target_company_id, target_job_id")
        .eq("vendor_id", profile.vendor_id)
        .order("uploaded_at", { ascending: false });
      if (docsError) throw docsError;
      setComplianceDocs((docs || []) as VendorPortalComplianceDocument[]);

      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, status, issue_date, due_date, created_at, job_id, jobs:job_id(id, name, company_id)")
        .eq("vendor_id", profile.vendor_id)
        .order("created_at", { ascending: false });
      if (invoiceError) throw invoiceError;

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from("vendor_job_access" as any)
        .select(`
          job_id,
          can_submit_bills,
          can_view_plans,
          can_view_rfis,
          can_submit_rfis,
          can_view_submittals,
          can_submit_submittals,
          can_view_photos,
          can_view_rfps,
          can_submit_bids,
          can_view_subcontracts,
          can_access_messages,
          jobs:job_id(id, name, project_number, status, start_date, end_date, image_url, company_id)
        `)
        .eq("vendor_id", profile.vendor_id);
      if (assignmentError) throw assignmentError;

      const jobMap = new Map<string, VendorPortalJob>();
      ((assignmentRows as any[]) || []).forEach((row: any) => {
        if (!row?.jobs?.id) return;
        jobMap.set(String(row.jobs.id), {
          id: String(row.jobs.id),
          name: String(row.jobs.name || "Untitled Job"),
          project_number: row.jobs.project_number || null,
          status: row.jobs.status || null,
          start_date: row.jobs.start_date || null,
          end_date: row.jobs.end_date || null,
          image_url: row.jobs.image_url || null,
          company_id: row.jobs.company_id || null,
          company_name: null,
          company_logo_url: null,
          can_submit_bills: !!row.can_submit_bills,
          can_view_plans: !!row.can_view_plans,
          can_view_rfis: !!row.can_view_rfis,
          can_submit_rfis: !!row.can_submit_rfis,
          can_view_submittals: !!row.can_view_submittals,
          can_submit_submittals: !!row.can_submit_submittals,
          can_view_photos: !!row.can_view_photos,
          can_view_rfps: !!row.can_view_rfps,
          can_submit_bids: !!row.can_submit_bids,
          can_view_subcontracts: !!row.can_view_subcontracts,
          can_access_messages: !!row.can_access_messages,
        });
      });

      const companyIds = Array.from(new Set(Array.from(jobMap.values()).map((job) => job.company_id).filter(Boolean))) as string[];
      const companySummaryById = new Map<string, VendorPortalCompanySummary>();
      if (companyIds.length > 0) {
        const { data: companies, error: companiesError } = await supabase
          .from("companies")
          .select("id, name, display_name, logo_url")
          .in("id", companyIds);
        if (companiesError) throw companiesError;
        (companies || []).forEach((company: any) => {
          companySummaryById.set(String(company.id), {
            id: String(company.id),
            name: String(company.display_name || company.name || "Builder Company"),
            logo_url: resolveCompanyLogoUrl(company.logo_url),
          });
        });
      }

      const resolvedJobs = Array.from(jobMap.values()).map((job) => {
        const company = job.company_id ? companySummaryById.get(job.company_id) : null;
        return {
          ...job,
          company_name: company?.name || null,
          company_logo_url: company?.logo_url || null,
        };
      });
      setJobs(resolvedJobs);

      const resolvedInvoices = ((invoiceRows as any[]) || []).map((row: any) => {
        const company = row?.jobs?.company_id ? companySummaryById.get(String(row.jobs.company_id)) : null;
        return {
          id: String(row.id),
          invoice_number: row.invoice_number || null,
          amount: Number(row.amount || 0),
          status: String(row.status || "draft"),
          issue_date: row.issue_date || null,
          due_date: row.due_date || null,
          created_at: String(row.created_at),
          job_id: row.job_id || null,
          job_name: row?.jobs?.name || null,
          company_name: company?.name || null,
        } as VendorPortalInvoice;
      });
      setInvoices(resolvedInvoices);

      const { data: payment, error: paymentError } = await supabase
        .from("vendor_payment_methods")
        .select("type, check_delivery, bank_name, account_number, routing_number, account_type, voided_check_url")
        .eq("vendor_id", profile.vendor_id)
        .eq("is_primary", true)
        .maybeSingle();
      if (paymentError) throw paymentError;
      setPaymentMethod(payment as VendorPortalPaymentMethod | null);
    } finally {
      setLoading(false);
    }
  }, [profile?.vendor_id, currentCompany?.logo_url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveCompanySettings = useCallback(async () => {
    if (!profile?.vendor_id) return;
    const payload = {
      name: settingsForm.name.trim() || "Vendor",
      contact_person: settingsForm.contact_person.trim() || null,
      email: settingsForm.email.trim() || null,
      phone: settingsForm.phone.trim() || null,
      address: settingsForm.address.trim() || null,
      city: settingsForm.city.trim() || null,
      state: settingsForm.state.trim() || null,
      zip_code: settingsForm.zip_code.trim() || null,
      logo_url: settingsForm.logo_url || null,
      tax_id: settingsForm.tax_id.trim() || null,
    };
    const { error } = await supabase
      .from("vendors")
      .update(payload)
      .eq("id", profile.vendor_id);
    if (error) throw error;
    await syncLinkedBuilderVendorRecords();
    await reload();
  }, [profile?.vendor_id, settingsForm, syncLinkedBuilderVendorRecords, reload]);

  const savePaymentSettings = useCallback(async (next: {
    type: string;
    check_delivery?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    routing_number?: string | null;
    account_type?: string | null;
    voided_check_file?: File | null;
  }) => {
    if (!profile?.vendor_id) return;
    const { data: existing, error: existingError } = await supabase
      .from("vendor_payment_methods")
      .select("id, voided_check_url")
      .eq("vendor_id", profile.vendor_id)
      .eq("is_primary", true)
      .maybeSingle();
    if (existingError) throw existingError;

    let voidedCheckUrl = existing?.voided_check_url || null;
    if (next.voided_check_file && currentCompany?.id) {
      const ext = next.voided_check_file.name.split(".").pop() || "pdf";
      const path = `${currentCompany.id}/vendor-payment-docs/${profile.vendor_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("company-files")
        .upload(path, next.voided_check_file, { upsert: true });
      if (uploadError) throw uploadError;
      voidedCheckUrl = path;
    }

    const payload = {
      vendor_id: profile.vendor_id,
      type: next.type,
      check_delivery: next.type === "check" ? (next.check_delivery || null) : null,
      bank_name: next.type === "check" ? null : (next.bank_name?.trim() || null),
      account_number: next.type === "check" ? null : (next.account_number?.trim() || null),
      routing_number: next.type === "check" ? null : (next.routing_number?.trim() || null),
      account_type: next.type === "check" ? null : (next.account_type?.trim() || null),
      voided_check_url: next.type === "check" ? null : voidedCheckUrl,
      is_primary: true,
    };

    const response = existing?.id
      ? await supabase.from("vendor_payment_methods").update(payload).eq("id", existing.id)
      : await supabase.from("vendor_payment_methods").insert(payload);

    if (response.error) throw response.error;
    await syncLinkedBuilderVendorRecords();
    await reload();
  }, [profile?.vendor_id, currentCompany?.id, syncLinkedBuilderVendorRecords, reload]);

  const uploadVendorLogo = useCallback(async (file: File, options?: { onProgress?: (percent: number) => void }) => {
    if (!profile?.vendor_id || !currentCompany?.id) return;
    const ext = file.name.split('.').pop() || 'png';
    const path = `${currentCompany.id}/vendor-logos/${profile.vendor_id}/${Date.now()}.${ext}`;
    await uploadFileWithProgress({
      bucketName: "company-logos",
      filePath: path,
      file,
      upsert: true,
      onProgress: options?.onProgress,
    });
    const storagePath = `company-logos/${path}`;
    setSettingsForm((prev) => ({ ...prev, logo_url: storagePath }));
    setVendorInfo((prev: any) => (prev ? { ...prev, logo_url: storagePath } : prev));
    window.localStorage.setItem(`workspace-logo:${currentCompany.id}`, storagePath);
    window.dispatchEvent(new CustomEvent("workspace-logo-updated", {
      detail: {
        companyId: currentCompany.id,
        storagePath,
      },
    }));
    const { data: updatedVendorRows, error: updateError } = await supabase
      .from("vendors")
      .update({ logo_url: storagePath })
      .eq("id", profile.vendor_id)
      .select("id, logo_url");
    if (updateError) throw updateError;
    if (!updatedVendorRows || updatedVendorRows.length === 0) {
      throw new Error("Vendor logo update did not persist.");
    }
    if (currentCompany?.id) {
      const { data: updatedCompanyRows, error: companyLogoError } = await supabase
        .from("companies")
        .update({ logo_url: storagePath })
        .eq("id", currentCompany.id)
        .eq("company_type", "vendor")
        .select("id, logo_url");
      if (companyLogoError) {
        console.warn("Unable to mirror vendor logo to vendor home company:", companyLogoError.message);
      } else if (!updatedCompanyRows || updatedCompanyRows.length === 0) {
        console.warn("Vendor home company logo mirror did not update any rows.");
      }
      await refreshCompanies();
    }
    await syncLinkedBuilderVendorRecords();
    await reload();
  }, [profile?.vendor_id, currentCompany?.id, refreshCompanies, syncLinkedBuilderVendorRecords, reload]);

  const uploadComplianceDocument = useCallback(async (
    docType: string,
    file: File,
    options?: {
      expirationDate?: string | null;
      targetCompanyId?: string | null;
      targetJobId?: string | null;
      onProgress?: (percent: number) => void;
    },
  ) => {
    if (!profile?.vendor_id || !currentCompany?.id) return;
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${currentCompany.id}/vendor-compliance/${profile.vendor_id}/${docType}/${Date.now()}.${ext}`;
    await uploadFileWithProgress({
      bucketName: "company-files",
      filePath: path,
      file,
      upsert: true,
      onProgress: options?.onProgress,
    });

    const payload = {
      vendor_id: profile.vendor_id,
      type: docType,
      is_required: true,
      is_uploaded: true,
      file_name: file.name,
      file_url: path,
      expiration_date: options?.expirationDate || null,
      target_company_id: options?.targetCompanyId || null,
      target_job_id: options?.targetJobId || null,
      uploaded_at: new Date().toISOString(),
    };

    const response = docType === "w9"
      ? await (async () => {
          const { data: existing, error: existingError } = await supabase
            .from("vendor_compliance_documents")
            .select("id")
            .eq("vendor_id", profile.vendor_id)
            .eq("type", docType)
            .is("target_job_id", null)
            .maybeSingle();
          if (existingError) throw existingError;
          return existing?.id
            ? await supabase.from("vendor_compliance_documents").update(payload).eq("id", existing.id)
            : await supabase.from("vendor_compliance_documents").insert(payload);
        })()
      : await supabase.from("vendor_compliance_documents").insert(payload as any);
    if (response.error) throw response.error;
    await syncLinkedBuilderVendorRecords();
    await reload();
  }, [profile?.vendor_id, currentCompany?.id, syncLinkedBuilderVendorRecords, reload]);

  return {
    loading,
    isVendorUser,
    vendorInfo,
    jobs,
    invoices,
    complianceDocs,
    paymentMethod,
    settingsForm,
    setSettingsForm,
    reload,
    saveCompanySettings,
    savePaymentSettings,
    uploadVendorLogo,
    uploadComplianceDocument,
  };
}
