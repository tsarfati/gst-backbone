const ALWAYS_ALLOWED_PERMISSION_KEYS = new Set([
  "profile-settings",
  "settings-help",
]);

const LEGACY_EXACT_MAP: Record<string, string> = {
  construction: "jobs_basic",
  "construction-dashboard": "jobs_basic",
  jobs: "jobs_basic",
  subcontracts: "subcontracts",
  "purchase-orders": "purchase_orders",
  "construction-reports": "construction_reports",
  "cost-codes": "job_cost_codes",
  "delivery-tickets": "delivery_tickets",
  receipts: "receipts",
  "receipts-upload": "receipts",
  "receipts-uncoded": "receipts",
  "receipts-coded": "receipts",
  "receipt-reports": "accounting_reports",
  receivables: "ar_invoices",
  "receivables-dashboard": "ar_invoices",
  customers: "customers",
  "ar-invoices": "ar_invoices",
  "ar-payments": "payments",
  "receivables-reports": "accounting_reports",
  payables: "bills",
  "payables-dashboard": "bills",
  vendors: "vendors",
  bills: "bills",
  "banking-credit-cards": "credit_cards",
  "make-payment": "payments",
  "payment-history": "payments",
  "payment-reports": "accounting_reports",
  "company-files": "job_filing",
  "company-contracts": "job_filing",
  "company-permits": "job_permits",
  "company-insurance": "job_permits",
  employees: "employees",
  "punch-clock-dashboard": "punch_clock_app",
  timesheets: "timesheets",
  "timecard-reports": "timesheets",
  messaging: "messaging",
  messages: "messaging",
  "team-chat": "messaging",
  announcements: "announcements",
  tasks: "project_tasks",
  "project-tasks": "project_tasks",
  "task-deadlines": "project_tasks",
  banking: "bank_accounts",
  "banking-accounts": "bank_accounts",
  "banking-reports": "accounting_reports",
  "journal-entries": "journal_entries",
  deposits: "payments",
  "print-checks": "payments",
  reconcile: "payments",
  "organization-management": "organization_management",
  "punch-clock-settings": "punch_clock_app",
  "pm-lynk-settings": "pm_lynk",
};

const KNOWN_FEATURE_KEYS = new Set<string>(Object.values(LEGACY_EXACT_MAP));

const getLegacyFeatureForPermission = (permissionKey: string): string | null => {
  const key = String(permissionKey || "").toLowerCase();
  if (!key) return null;
  if (LEGACY_EXACT_MAP[key]) return LEGACY_EXACT_MAP[key];

  if (key.startsWith("jobs-")) {
    if (key.includes("-plans")) return "job_plans";
    if (key.includes("-rfis")) return "job_rfis";
    if (key.includes("-photos")) return "job_photos";
    if (key.includes("-files") || key.includes("filing-cabinet")) return "job_filing";
    if (key.includes("-billing")) return "ar_invoices";
    if (key.includes("-budget")) return "job_budgets";
    if (key.includes("-forecast")) return "construction_reports";
    return "jobs_basic";
  }

  if (key.startsWith("vendors-")) return "vendors";
  if (key.startsWith("bills-")) return "bills";
  if (key.startsWith("subcontracts-")) return "subcontracts";
  if (key.startsWith("purchase-orders-")) return "purchase_orders";
  if (key.startsWith("cost-codes-")) return "job_cost_codes";
  if (key.startsWith("delivery-tickets-")) return "delivery_tickets";
  if (key.startsWith("receipts-")) return "receipts";
  if (key.startsWith("receivables-")) return "ar_invoices";
  if (key.startsWith("customers-")) return "customers";
  if (key.startsWith("ar-invoices-")) return "ar_invoices";
  if (key.startsWith("ar-payments-")) return "payments";
  if (key.startsWith("credit-cards-")) return "credit_cards";
  if (key.startsWith("company-files-")) return "job_filing";
  if (key.startsWith("company-contracts-")) return "job_filing";
  if (key.startsWith("company-permits-")) return "job_permits";
  if (key.startsWith("company-insurance-")) return "job_permits";
  if (key.startsWith("employees-")) return "employees";
  if (key.startsWith("messages-")) return "messaging";
  if (key.startsWith("announcements-")) return "announcements";
  if (key.startsWith("banking-")) return "bank_accounts";
  if (key.startsWith("timesheets-") || key.startsWith("timecard-")) return "timesheets";
  if (key.startsWith("punch-clock-")) return "punch_clock_app";

  return null;
};

export const getRequiredFeaturesForPermission = (permissionKey: string): string[] => {
  const key = String(permissionKey || "").toLowerCase();
  if (!key) return [];
  if (ALWAYS_ALLOWED_PERMISSION_KEYS.has(key)) return [];

  const candidates = new Set<string>();

  const legacyFeature = getLegacyFeatureForPermission(key);
  if (legacyFeature) candidates.add(legacyFeature);

  // Support direct feature-style keys when passed (e.g. organization_management).
  if (KNOWN_FEATURE_KEYS.has(key)) {
    candidates.add(key);
  }

  // Support kebab-case aliases that map directly to a known underscore feature.
  if (key.includes("-")) {
    const underscore = key.replace(/-/g, "_");
    if (KNOWN_FEATURE_KEYS.has(underscore)) {
      candidates.add(underscore);
    }
  }

  return Array.from(candidates);
};

export const getRequiredFeatureForPermission = (permissionKey: string): string | null => {
  const required = getRequiredFeaturesForPermission(permissionKey);
  return required.length > 0 ? required[0] : null;
};
