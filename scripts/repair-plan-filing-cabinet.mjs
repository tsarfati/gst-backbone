#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_COMPANY_NAME = "Sigma";
const DEFAULT_JOB_NAME = "141 North 4th Street";
const PLAN_SYSTEM_FOLDER_NAME = "Plans";
const COMPANY_FILES_BUCKET = "company-files";
const JOB_FILING_CABINET_BUCKET = "job-filing-cabinet";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function extractStoragePath(bucketName, urlOrPath) {
  if (!urlOrPath) return null;
  if (!urlOrPath.startsWith("http")) return urlOrPath;

  const patterns = [
    `/storage/v1/object/public/${bucketName}/`,
    `/storage/v1/object/sign/${bucketName}/`,
    `/storage/v1/object/authenticated/${bucketName}/`,
  ];

  for (const pattern of patterns) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      const pathWithQuery = urlOrPath.slice(idx + pattern.length);
      const qIndex = pathWithQuery.indexOf("?");
      return decodeURIComponent(qIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, qIndex));
    }
  }

  return null;
}

function makeFileId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensurePlansFolder(admin, companyId, jobId, createdBy) {
  const { data: existingFolder, error: existingError } = await admin
    .from("job_folders")
    .select("id")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .ilike("name", PLAN_SYSTEM_FOLDER_NAME)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingFolder?.id) return existingFolder.id;

  const { data: maxSortRow, error: maxSortError } = await admin
    .from("job_folders")
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxSortError) throw maxSortError;

  const { data: createdFolder, error: createError } = await admin
    .from("job_folders")
    .insert({
      company_id: companyId,
      job_id: jobId,
      name: PLAN_SYSTEM_FOLDER_NAME,
      is_system_folder: true,
      sort_order: Number(maxSortRow?.sort_order || 0) + 1,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return createdFolder.id;
}

async function main() {
  loadEnvFile();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Run with: SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-plan-filing-cabinet.mjs"
    );
  }

  const companyName = process.argv[2] || DEFAULT_COMPANY_NAME;
  const jobName = process.argv[3] || DEFAULT_JOB_NAME;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: companies, error: companyError } = await admin
    .from("companies")
    .select("id, name, display_name")
    .or(`name.ilike.%${companyName}%,display_name.ilike.%${companyName}%`);

  if (companyError) throw companyError;
  if (!companies?.length) {
    throw new Error(`No company found for "${companyName}"`);
  }
  if (companies.length > 1) {
    console.log("Matched multiple companies:");
    companies.forEach((company) => console.log(`- ${company.id}: ${company.display_name || company.name}`));
    throw new Error("Please rerun with a more specific company name.");
  }

  const company = companies[0];

  const { data: jobs, error: jobError } = await admin
    .from("jobs")
    .select("id, name, company_id")
    .eq("company_id", company.id)
    .ilike("name", `%${jobName}%`);

  if (jobError) throw jobError;
  if (!jobs?.length) {
    throw new Error(`No job found for "${jobName}" in company "${company.display_name || company.name}"`);
  }
  if (jobs.length > 1) {
    console.log("Matched multiple jobs:");
    jobs.forEach((job) => console.log(`- ${job.id}: ${job.name}`));
    throw new Error("Please rerun with a more specific job name.");
  }

  const job = jobs[0];

  const { data: plans, error: plansError } = await admin
    .from("job_plans")
    .select("id, plan_name, file_name, file_url, file_size, uploaded_by, company_id, job_id, uploaded_at")
    .eq("company_id", company.id)
    .eq("job_id", job.id)
    .order("uploaded_at", { ascending: false });

  if (plansError) throw plansError;
  if (!plans?.length) {
    console.log("No plans found for this job. Nothing to repair.");
    return;
  }

  const { data: existingJobFiles, error: jobFilesError } = await admin
    .from("job_files")
    .select("id, source_plan_id, file_url, uploaded_by")
    .eq("company_id", company.id)
    .eq("job_id", job.id);

  if (jobFilesError) throw jobFilesError;

  const existingByPlanId = new Map(
    (existingJobFiles || [])
      .filter((row) => row.source_plan_id)
      .map((row) => [row.source_plan_id, row])
  );

  const fallbackCreatedBy =
    plans.find((plan) => plan.uploaded_by)?.uploaded_by ||
    existingJobFiles?.find((file) => file.id)?.uploaded_by ||
    null;

  if (!fallbackCreatedBy) {
    throw new Error("Could not determine a user to attribute the Plans folder to.");
  }

  const plansFolderId = await ensurePlansFolder(admin, company.id, job.id, fallbackCreatedBy);

  const missingPlans = plans.filter((plan) => !existingByPlanId.has(plan.id));

  if (!missingPlans.length) {
    console.log("All plans already have Filing Cabinet entries. Nothing to repair.");
    return;
  }

  console.log(`Repairing ${missingPlans.length} missing plan(s) for ${job.name} in ${company.display_name || company.name}...`);

  let repairedCount = 0;
  for (const plan of missingPlans) {
    const sourcePath = extractStoragePath(COMPANY_FILES_BUCKET, plan.file_url);
    if (!sourcePath) {
      console.warn(`Skipping plan ${plan.id} (${plan.file_name}): unable to parse storage path from ${plan.file_url}`);
      continue;
    }

    console.log(`- Copying ${plan.file_name}`);

    const { data: fileBlob, error: downloadError } = await admin.storage
      .from(COMPANY_FILES_BUCKET)
      .download(sourcePath);

    if (downloadError) {
      console.warn(`  Download failed: ${downloadError.message}`);
      continue;
    }

    const ext = plan.file_name?.split(".").pop() || "pdf";
    const destinationPath = `${company.id}/${job.id}/${plansFolderId}/plan-${plan.id}-${makeFileId()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(JOB_FILING_CABINET_BUCKET)
      .upload(destinationPath, fileBlob, {
        upsert: false,
        contentType: fileBlob.type || "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) {
      console.warn(`  Upload failed: ${uploadError.message}`);
      continue;
    }

    const { error: insertError } = await admin.from("job_files").insert({
      job_id: job.id,
      company_id: company.id,
      folder_id: plansFolderId,
      file_name: plan.file_name,
      original_file_name: plan.file_name,
      file_url: destinationPath,
      file_size: plan.file_size,
      file_type: fileBlob.type || "application/pdf",
      uploaded_by: plan.uploaded_by,
      source_plan_id: plan.id,
    });

    if (insertError) {
      console.warn(`  Database insert failed: ${insertError.message}`);
      continue;
    }

    repairedCount += 1;
    console.log("  Repaired.");
  }

  console.log(`Done. Repaired ${repairedCount} of ${missingPlans.length} missing plan(s).`);
}

main().catch((error) => {
  console.error("Repair failed:", error?.message || error);
  process.exitCode = 1;
});
