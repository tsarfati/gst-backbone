import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ExportProgress {
  stage: string;
  percent: number;
}

type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Fetches a file from a Supabase storage URL (signed or public) and returns its blob.
 * Handles both full URLs and storage paths like "bucket/path".
 */
async function fetchFileBlob(fileUrl: string, bucket?: string): Promise<Blob | null> {
  try {
    // If it's a full URL, fetch directly
    if (fileUrl.startsWith("http")) {
      const res = await fetch(fileUrl);
      if (!res.ok) return null;
      return await res.blob();
    }

    // Otherwise treat as storage path — get a signed URL
    const storagePath = bucket ? fileUrl : fileUrl;
    const bucketName = bucket || fileUrl.split("/")[0];
    const path = bucket ? fileUrl : fileUrl.substring(bucketName.length + 1);

    const { data } = await supabase.storage.from(bucketName).createSignedUrl(path, 300);
    if (!data?.signedUrl) return null;

    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Resolve a storage URL — could be a full URL, a path with bucket prefix, etc.
 */
async function resolveAndFetchFile(fileUrl: string): Promise<Blob | null> {
  if (!fileUrl) return null;

  // Full URL — fetch directly
  if (fileUrl.startsWith("http")) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  // Storage path — try common buckets
  const buckets = ["job-filing-cabinet", "job-photos", "job-plans", "job-permits", "receipts", "delivery-tickets"];
  for (const bucket of buckets) {
    try {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(fileUrl, 300);
      if (data?.signedUrl) {
        const res = await fetch(data.signedUrl);
        if (res.ok) return await res.blob();
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Download a file from a storage URL that may include the bucket name in the path.
 */
async function downloadStorageFile(fileUrl: string, defaultBucket: string): Promise<Blob | null> {
  if (!fileUrl) return null;

  // Full URL
  if (fileUrl.startsWith("http")) {
    try {
      const res = await fetch(fileUrl);
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  }

  // Try as path in default bucket
  try {
    const { data } = await supabase.storage.from(defaultBucket).createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl);
      if (res.ok) return await res.blob();
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Export an entire job as a ZIP file with organized folder structure and a re-import manifest.
 */
export async function exportJobAsZip(
  jobId: string,
  onProgress: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip();

  // ─── 1. Job Details ───────────────────────────────────────────────
  onProgress({ stage: "Loading job details…", percent: 5 });

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (!job) throw new Error("Job not found");

  const jobFolderName = sanitizeName(job.name);
  const root = zip.folder(jobFolderName)!;

  // ─── 2. Filing Cabinet ────────────────────────────────────────────
  onProgress({ stage: "Exporting filing cabinet…", percent: 10 });

  const { data: folders } = await supabase
    .from("job_filing_folders")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order");

  const { data: filingDocs } = await supabase
    .from("job_filing_documents")
    .select("*")
    .eq("job_id", jobId);

  const documentsFolder = root.folder("Documents")!;

  if (folders && filingDocs) {
    for (const folder of folders) {
      const folderDir = documentsFolder.folder(sanitizeName(folder.name))!;
      const folderFiles = filingDocs.filter((d) => d.folder_id === folder.id);

      for (const file of folderFiles) {
        const blob = await downloadStorageFile(file.file_url, "job-filing-cabinet");
        if (blob) {
          folderDir.file(file.file_name, blob);
        }
      }
    }
  }

  // ─── 3. Photos ────────────────────────────────────────────────────
  onProgress({ stage: "Exporting photos…", percent: 25 });

  const { data: albums } = await supabase
    .from("photo_albums")
    .select("*")
    .eq("job_id", jobId);

  const { data: photos } = await supabase
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId);

  const photosFolder = root.folder("Photos")!;

  if (albums && photos) {
    for (const album of albums) {
      const albumDir = photosFolder.folder(sanitizeName(album.name))!;
      const albumPhotos = photos.filter((p) => p.album_id === album.id);

      for (const photo of albumPhotos) {
        const blob = await downloadStorageFile(photo.photo_url, "job-photos");
        if (blob) {
          const ext = getExtFromUrl(photo.photo_url) || "jpg";
          albumDir.file(`${photo.id.substring(0, 8)}.${ext}`, blob);
        }
      }
    }

    // Unassigned photos
    const unassigned = photos.filter((p) => !p.album_id);
    if (unassigned.length > 0) {
      const unassignedDir = photosFolder.folder("Unassigned")!;
      for (const photo of unassigned) {
        const blob = await downloadStorageFile(photo.photo_url, "job-photos");
        if (blob) {
          const ext = getExtFromUrl(photo.photo_url) || "jpg";
          unassignedDir.file(`${photo.id.substring(0, 8)}.${ext}`, blob);
        }
      }
    }
  }

  // ─── 4. Plans ─────────────────────────────────────────────────────
  onProgress({ stage: "Exporting plans…", percent: 40 });

  const { data: plans } = await supabase
    .from("job_plans")
    .select("*")
    .eq("job_id", jobId);

  const plansFolder = root.folder("Plans")!;
  if (plans) {
    for (const plan of plans) {
      const blob = await downloadStorageFile(plan.file_url, "job-plans");
      if (blob) {
        plansFolder.file(plan.file_name || `${plan.plan_name}.pdf`, blob);
      }
    }
  }

  // ─── 5. RFIs ──────────────────────────────────────────────────────
  onProgress({ stage: "Exporting RFIs…", percent: 50 });

  const { data: rfis } = await supabase
    .from("rfis")
    .select("*")
    .eq("job_id", jobId);

  const rfisFolder = root.folder("RFIs")!;
  if (rfis && rfis.length > 0) {
    // Export RFIs as a summary CSV
    const rfiCsv = [
      "RFI Number,Subject,Status,Ball In Court,Description,Response,Due Date,Created At",
      ...rfis.map((r) =>
        [
          r.rfi_number,
          `"${(r.subject || "").replace(/"/g, '""')}"`,
          r.status,
          r.ball_in_court,
          `"${(r.description || "").replace(/"/g, '""')}"`,
          `"${(r.response || "").replace(/"/g, '""')}"`,
          r.due_date || "",
          r.created_at,
        ].join(",")
      ),
    ].join("\n");
    rfisFolder.file("rfis-summary.csv", rfiCsv);
  }

  // ─── 6. Delivery Tickets ──────────────────────────────────────────
  onProgress({ stage: "Exporting delivery tickets…", percent: 55 });

  const { data: tickets } = await supabase
    .from("delivery_tickets")
    .select("*")
    .eq("job_id", jobId);

  const ticketsFolder = root.folder("Delivery Tickets")!;
  if (tickets) {
    for (const ticket of tickets) {
      if (ticket.delivery_slip_photo_url) {
        const blob = await downloadStorageFile(ticket.delivery_slip_photo_url, "delivery-tickets");
        if (blob) {
          ticketsFolder.file(
            `ticket-${ticket.ticket_number || ticket.id.substring(0, 8)}.jpg`,
            blob
          );
        }
      }
    }

    // Summary CSV
    if (tickets.length > 0) {
      const csv = [
        "Ticket Number,Vendor,Delivery Date,Description",
        ...tickets.map((t) =>
          [
            t.ticket_number || "",
            `"${(t.vendor_name || "").replace(/"/g, '""')}"`,
            t.delivery_date || "",
            `"${(t.description || "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ].join("\n");
      ticketsFolder.file("delivery-tickets-summary.csv", csv);
    }
  }

  // ─── 7. Permits ───────────────────────────────────────────────────
  onProgress({ stage: "Exporting permits…", percent: 60 });

  const { data: permits } = await supabase
    .from("job_permits")
    .select("*")
    .eq("job_id", jobId);

  const permitsFolder = root.folder("Permits")!;
  if (permits) {
    for (const permit of permits) {
      if (permit.file_url) {
        const blob = await downloadStorageFile(permit.file_url, "job-permits");
        if (blob) {
          permitsFolder.file(permit.file_name || `${permit.permit_name}.pdf`, blob);
        }
      }
    }
  }

  // ─── 8. Subcontracts ──────────────────────────────────────────────
  onProgress({ stage: "Exporting subcontracts…", percent: 65 });

  const { data: subcontracts } = await supabase
    .from("subcontracts")
    .select("*, vendors(name)")
    .eq("job_id", jobId);

  const subcontractsFolder = root.folder("Subcontracts")!;
  if (subcontracts && subcontracts.length > 0) {
    const csv = [
      "Name,Vendor,Status,Contract Amount,Retainage %,Created At",
      ...subcontracts.map((s) =>
        [
          `"${(s.name || "").replace(/"/g, '""')}"`,
          `"${((s.vendors as any)?.name || "").replace(/"/g, '""')}"`,
          s.status || "",
          s.contract_amount || 0,
          s.retainage_percentage || 0,
          s.created_at,
        ].join(",")
      ),
    ].join("\n");
    subcontractsFolder.file("subcontracts-summary.csv", csv);
  }

  // (Change orders are tracked within subcontracts in this schema)

  // ─── 10. Financials ───────────────────────────────────────────────
  onProgress({ stage: "Exporting financials…", percent: 75 });

  const financialsFolder = root.folder("Financials")!;

  // Bills / Invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, vendors(name)")
    .eq("job_id", jobId);

  if (invoices && invoices.length > 0) {
    const billsFolder = financialsFolder.folder("Bills")!;
    const csv = [
      "Invoice #,Vendor,Amount,Status,Issue Date,Due Date,Description",
      ...invoices.map((inv) =>
        [
          inv.invoice_number || "",
          `"${((inv.vendors as any)?.name || "").replace(/"/g, '""')}"`,
          inv.amount || 0,
          inv.status || "",
          inv.issue_date || "",
          inv.due_date || "",
          `"${(inv.description || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");
    billsFolder.file("bills-summary.csv", csv);

    // Download bill attachments
    for (const inv of invoices) {
      if (inv.file_url) {
        const blob = await downloadStorageFile(inv.file_url, "receipts");
        if (blob) {
          billsFolder.file(`bill-${inv.invoice_number || inv.id.substring(0, 8)}.pdf`, blob);
        }
      }
    }
  }

  // Receipts
  const { data: receipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("job_id", jobId);

  if (receipts && receipts.length > 0) {
    const receiptsFolder = financialsFolder.folder("Receipts")!;
    for (const receipt of receipts) {
      if (receipt.file_url) {
        const blob = await downloadStorageFile(receipt.file_url, "receipts");
        if (blob) {
          receiptsFolder.file(
            receipt.file_name || `receipt-${receipt.id.substring(0, 8)}.jpg`,
            blob
          );
        }
      }
    }
  }

  // Payments
  const { data: payments } = await supabase
    .from("payments" as any)
    .select("*")
    .eq("job_id", jobId);

  if (payments && payments.length > 0) {
    const paymentsFolder = financialsFolder.folder("Payments")!;
    const csv = [
      "Payment #,Vendor,Amount,Payment Date,Method,Status",
      ...payments.map((p: any) =>
        [
          p.payment_number || p.check_number || "",
          "",
          p.amount || 0,
          p.payment_date || "",
          p.payment_method || "",
          p.status || "",
        ].join(",")
      ),
    ].join("\n");
    paymentsFolder.file("payments-summary.csv", csv);
  }

  // Budget
  const { data: budgets } = await supabase
    .from("job_budgets")
    .select("*, cost_codes(code, description)")
    .eq("job_id", jobId);

  if (budgets && budgets.length > 0) {
    const reportsFolder = financialsFolder.folder("Reports")!;
    const csv = [
      "Cost Code,Description,Budgeted,Actual,Committed,Remaining",
      ...budgets.map((b) => {
        const remaining = (b.budgeted_amount || 0) - (b.actual_amount || 0) - (b.committed_amount || 0);
        return [
          (b.cost_codes as any)?.code || "",
          `"${((b.cost_codes as any)?.description || "").replace(/"/g, '""')}"`,
          b.budgeted_amount || 0,
          b.actual_amount || 0,
          b.committed_amount || 0,
          remaining,
        ].join(",");
      }),
    ].join("\n");
    reportsFolder.file("budget-summary.csv", csv);
  }

  // ─── 11. Project Team ─────────────────────────────────────────────
  onProgress({ stage: "Exporting project team…", percent: 85 });

  const { data: teamMembers } = await supabase
    .from("job_project_directory")
    .select("*")
    .eq("job_id", jobId);

  if (teamMembers && teamMembers.length > 0) {
    const csv = [
      "Company,Name,Phone,Email",
      ...teamMembers.map((m) =>
        [
          `"${(m.company_name || "").replace(/"/g, '""')}"`,
          `"${(m.name || "").replace(/"/g, '""')}"`,
          m.phone || "",
          m.email || "",
        ].join(",")
      ),
    ].join("\n");
    root.file("project-team.csv", csv);
  }

  // ─── 12. BuilderLynk Manifest (re-import) ─────────────────────────
  onProgress({ stage: "Generating manifest…", percent: 90 });

  const manifest = {
    _builderlynk_version: "1.0",
    _exported_at: new Date().toISOString(),
    _format: "builderlynk-job-export",
    job,
    folders: folders || [],
    filing_documents: filingDocs || [],
    albums: albums || [],
    photos: (photos || []).map(({ photo_url, ...rest }) => ({
      ...rest,
      photo_url, // keep reference for re-import
    })),
    plans: plans || [],
    rfis: rfis || [],
    delivery_tickets: tickets || [],
    permits: permits || [],
    subcontracts: subcontracts || [],
    // change_orders not in current schema
    invoices: invoices || [],
    receipts: receipts || [],
    payments: payments || [],
    budgets: budgets || [],
    team_members: teamMembers || [],
  };

  root.file("builderlynk-job.json", JSON.stringify(manifest, null, 2));

  // ─── 13. Generate ZIP ─────────────────────────────────────────────
  onProgress({ stage: "Compressing files…", percent: 95 });

  const blob = await zip.generateAsync({ type: "blob" }, (meta) => {
    onProgress({
      stage: `Compressing… ${Math.round(meta.percent)}%`,
      percent: 95 + Math.round(meta.percent * 0.05),
    });
  });

  onProgress({ stage: "Done!", percent: 100 });
  return blob;
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

function getExtFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const ext = path.split(".").pop();
    return ext || "";
  } catch {
    const ext = url.split(".").pop()?.split("?")[0];
    return ext || "";
  }
}
