#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

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

async function main() {
  loadEnvFile();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const userAccessToken = process.env.SUPABASE_USER_ACCESS_TOKEN;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const companyId = process.argv[2] || "";
  const batchSize = Math.max(1, Math.min(Number(process.argv[3]) || 100, 500));

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  const authToken = serviceRoleKey || userAccessToken;

  if (!authToken) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_USER_ACCESS_TOKEN. Run with: SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-job-photo-thumbnails.mjs [companyId] [batchSize]"
    );
  }

  let totalProcessed = 0;
  let totalFailed = 0;

  while (true) {
    const response = await fetch(`${supabaseUrl}/functions/v1/backfill-job-photo-thumbnails`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyId: companyId || undefined,
        limit: batchSize,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Backfill failed (${response.status}): ${JSON.stringify(result)}`);
    }

    const processedCount = Number(result?.processedCount || 0);
    const failedCount = Number(result?.failedCount || 0);

    totalProcessed += processedCount;
    totalFailed += failedCount;

    console.log(
      `Batch complete: processed=${processedCount}, failed=${failedCount}, totalProcessed=${totalProcessed}, totalFailed=${totalFailed}`
    );

    if (Array.isArray(result?.failed) && result.failed.length > 0) {
      for (const item of result.failed) {
        console.log(`  failed ${item.id}: ${item.reason}`);
      }
    }

    if (processedCount === 0) {
      break;
    }
  }

  console.log(`Backfill finished. processed=${totalProcessed}, failed=${totalFailed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
