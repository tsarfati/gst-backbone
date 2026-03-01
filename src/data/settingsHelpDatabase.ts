export type HelpCategory =
  | "Company Settings"
  | "Company Management"
  | "User Management"
  | "Punch Clock"
  | "PM Lynk"
  | "Notifications & Email"
  | "Data & Security"
  | "Subscription"
  | "Billing"
  | "Construction"
  | "Employees"
  | "Messaging"
  | "File Cabinet";

export interface SettingsHelpEntry {
  id: string;
  category: HelpCategory;
  section: string;
  tab: string;
  setting: string;
  description: string;
  behavior?: string;
  keywords: string[];
}

export const settingsHelpDatabase: SettingsHelpEntry[] = [
  {
    id: "punch-shift-start",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Shift Start Time",
    description: "Defines the scheduled shift start used for late/early punch calculations.",
    behavior: "Does not block punch-in by itself. Used with late grace and late counting rules.",
    keywords: ["shift", "start", "late", "schedule", "punch"]
  },
  {
    id: "punch-window-start",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Punch-In Window Start",
    description: "Earliest allowed time an employee can punch in.",
    behavior: "Acts as a hard gate for punch-in eligibility.",
    keywords: ["window", "punch in", "start", "gate", "allowed time"]
  },
  {
    id: "punch-window-end",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Punch-Out Window End",
    description: "Latest allowed time an employee can punch out.",
    behavior: "Used for end-of-window rules and reminders.",
    keywords: ["window", "punch out", "end", "cutoff"]
  },
  {
    id: "punch-shift-hours",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Standard Shift Hours",
    description: "Expected daily shift duration used by calculations and reporting.",
    keywords: ["hours", "standard", "shift", "duration"]
  },
  {
    id: "punch-overtime-grace",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Overtime Grace Period (minutes)",
    description: "Grace period before overtime penalties/flags are applied.",
    keywords: ["overtime", "grace", "minutes", "threshold"]
  },
  {
    id: "punch-count-early",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Count Early Punch Time",
    description: "Controls whether pre-shift punch minutes count as payable time.",
    keywords: ["early", "punch", "count", "payable"]
  },
  {
    id: "punch-count-late",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Count Late Punch-In",
    description: "Tracks and reports punch-ins after scheduled start time.",
    keywords: ["late", "punch in", "tracking", "compliance"]
  },
  {
    id: "punch-late-grace",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Late Punch Grace (minutes)",
    description: "Allowed lateness before a punch is marked late.",
    keywords: ["late", "grace", "minutes", "tolerance"]
  },
  {
    id: "punch-require-location",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Require Location for Punch",
    description: "Requires location capture for punch-in and punch-out.",
    behavior: "When enabled, the app must provide coordinates to punch.",
    keywords: ["location", "gps", "require", "punch"]
  },
  {
    id: "punch-location-accuracy",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Location Accuracy",
    description: "Target device location accuracy threshold for punch captures.",
    keywords: ["accuracy", "distance", "gps", "meters", "feet"]
  },
  {
    id: "punch-warn-outside-jobsite",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Warn When Employee Is Not At Job Site",
    description: "Enables warning + supervisor approval flow for out-of-location punches when strict employee geofence is off.",
    behavior: "Strict employee geofence block always overrides this warning mode.",
    keywords: ["warning", "jobsite", "supervisor approval", "geofence"]
  },
  {
    id: "punch-warning-distance",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Outside Jobsite Warning Distance",
    description: "Company-wide warning threshold distance for out-of-location punches (10/50/100/300).",
    keywords: ["distance", "warning", "meters", "threshold", "geofence"]
  },
  {
    id: "punch-require-photo",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Require Photo for Punch",
    description: "Requires a punch photo at in/out events.",
    keywords: ["photo", "selfie", "punch", "requirement"]
  },
  {
    id: "punch-manual-capture",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Manual Photo Capture",
    description: "Requires employee to manually trigger photo capture.",
    keywords: ["manual", "capture", "camera", "photo"]
  },
  {
    id: "punch-costcode-timing",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Cost Code Selection Timing",
    description: "Determines whether employees select cost code at punch-in or punch-out.",
    keywords: ["cost code", "timing", "punch in", "punch out", "daily task"]
  },
  {
    id: "punch-recalc",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "General Settings",
    setting: "Recalculate Time Cards",
    description: "Recomputes existing timecards using current company punch clock rules.",
    keywords: ["recalculate", "time cards", "reprocess", "rules"]
  },
  {
    id: "punch-login-branding",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "Punch Clock Login",
    setting: "Login Branding + Messaging",
    description: "Controls logo/background text and presentation on punch clock login screen.",
    keywords: ["login", "branding", "logo", "welcome", "background"]
  },
  {
    id: "punch-mobile-icons",
    category: "Punch Clock",
    section: "Punch Clock Settings",
    tab: "Mobile App",
    setting: "PWA Icons (192/512)",
    description: "Sets install icon assets used on mobile home screens.",
    keywords: ["pwa", "icon", "install", "mobile", "home screen"]
  },
  {
    id: "company-branding",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Company Info",
    setting: "Company Branding",
    description: "Controls company display identity including logo and company-level brand details.",
    keywords: ["branding", "logo", "company info", "identity"]
  },
  {
    id: "company-regional-distance",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Company Info",
    setting: "Distance Unit (Feet / Meters)",
    description: "Global display unit for distance values across settings and reports.",
    behavior: "Converts labels/presentation; stored values remain meter-based in database.",
    keywords: ["regional", "distance unit", "feet", "meters", "display"]
  },
  {
    id: "company-payables-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables",
    setting: "Require Bill Approval",
    description: "Controls whether bills must be approved before downstream processing.",
    keywords: ["payables", "approval", "bills", "workflow"]
  },
  {
    id: "company-banking-journal",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Banking",
    setting: "Journal Entry Settings",
    description: "Controls company journal posting behavior and defaults.",
    keywords: ["banking", "journal", "entry", "accounting"]
  },
  {
    id: "company-search-settings",
    category: "Company Settings",
    section: "Data & Security",
    tab: "Search",
    setting: "Search Configuration",
    description: "Controls indexing and search behavior moved under Data & Security.",
    keywords: ["search", "index", "security", "settings"]
  },
  {
    id: "users-custom-roles",
    category: "User Management",
    section: "User Management",
    tab: "Role Definitions",
    setting: "Custom Roles",
    description: "Defines company-specific roles with granular permissions per module/tab/action.",
    keywords: ["roles", "custom role", "permissions", "definitions"]
  },
  {
    id: "users-website-job-access",
    category: "User Management",
    section: "User Profile",
    tab: "Website Job Access",
    setting: "Assigned Job Visibility",
    description: "Limits which jobs a user can see throughout website/PM Lynk pickers and pages.",
    behavior: "Unassigned jobs are hidden from dropdowns and blocked by server-side access checks.",
    keywords: ["job access", "website", "pm lynk", "visibility", "permissions"]
  },
  {
    id: "users-punch-assignments",
    category: "User Management",
    section: "User Profile",
    tab: "Punch Clock Job Assignments & Cost Codes",
    setting: "Punch Clock Job/Cost Code Assignment",
    description: "Controls jobs and cost codes available in punch clock app for that user.",
    keywords: ["punch clock", "assignment", "cost code", "jobs"]
  },
  {
    id: "users-invite-form",
    category: "User Management",
    section: "User Management",
    tab: "Users",
    setting: "Invite Form Fields",
    description: "System user invite flow uses email + role; name fields are collected at account setup.",
    keywords: ["invite", "email", "role", "onboarding"]
  },
  {
    id: "billing-tabs",
    category: "Billing",
    section: "Job Billing",
    tab: "Draw Tabs + Schedule of Values",
    setting: "Draw Workflow Tabs",
    description: "Billing view uses tabs for Draws and Schedule of Values. Draws progress sequentially.",
    keywords: ["billing", "draw", "sov", "tabs", "workflow"]
  },
  {
    id: "billing-retainage-lock",
    category: "Billing",
    section: "Job Billing",
    tab: "Draw",
    setting: "Retainage Lock After Draw 1",
    description: "Retainage is set on Draw 1 and locked for subsequent draws.",
    keywords: ["retainage", "draw 1", "lock", "billing"]
  },
  {
    id: "billing-export-options",
    category: "Billing",
    section: "Job Billing",
    tab: "Draw",
    setting: "Export Options",
    description: "Exports can include PDF, Excel, and email delivery workflows.",
    keywords: ["export", "pdf", "excel", "email", "draw"]
  },
  {
    id: "construction-plans-view-mode",
    category: "Construction",
    section: "Job Plans",
    tab: "Plan List",
    setting: "View Mode + Sort",
    description: "Supports tile/list/compact modes with sortable columns in list views.",
    keywords: ["plans", "view mode", "compact", "list", "sort"]
  },
  {
    id: "construction-plans-metadata",
    category: "Construction",
    section: "Plan Viewer",
    tab: "Plan Info",
    setting: "Plan Set Information",
    description: "Stores/editable plan set metadata including name, number, revision, and total pages.",
    keywords: ["plan set", "metadata", "revision", "pages", "info"]
  },
  {
    id: "construction-plans-links",
    category: "Construction",
    section: "Plan Viewer",
    tab: "Cross-Sheet Links",
    setting: "Analyzed Symbol/Sheet Links",
    description: "Detected links should remain anchored to plan coordinates during zoom/pan and navigate to targets.",
    keywords: ["crosslink", "symbol", "sheet link", "analyze", "hotspot"]
  },
  {
    id: "employees-punch-attempt-audit",
    category: "Employees",
    section: "Employee Reports",
    tab: "Punch Clock Attempt Audit",
    setting: "Attempt Audit Report",
    description: "Shows blocked/allowed punch attempts with reason, distance, threshold, user, and job.",
    keywords: ["audit", "punch clock", "attempt", "blocked", "geofence"]
  },
  {
    id: "messaging-dashboard-modal",
    category: "Messaging",
    section: "Dashboard",
    tab: "Messages",
    setting: "Open Message in Modal",
    description: "Selecting a dashboard message opens a modal thread without leaving dashboard context.",
    keywords: ["messages", "dashboard", "modal", "thread"]
  },
  {
    id: "messaging-all-messages-grouping",
    category: "Messaging",
    section: "Messaging",
    tab: "All Messages",
    setting: "Conversation Grouping",
    description: "Messages are grouped by conversation/user rather than a redundant per-message tile list.",
    keywords: ["all messages", "grouping", "conversation", "avatar"]
  },
  {
    id: "filecabinet-upload-destination",
    category: "File Cabinet",
    section: "Company Files",
    tab: "File Cabinet",
    setting: "Upload Destination Selection",
    description: "Upload flow supports choosing destination folder while keeping a single clean drop target UX.",
    keywords: ["file cabinet", "upload", "destination", "folder", "drag drop"]
  },
  {
    id: "filecabinet-drag-move",
    category: "File Cabinet",
    section: "Company Files",
    tab: "File Cabinet",
    setting: "Drag/Move File Organization",
    description: "Supports moving files/folders into and out of nested folders for organization.",
    keywords: ["organize", "move", "drag", "folders", "file cabinet"]
  },
  {
    id: "pmlynk-branding",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "PM Lynk Branding",
    description: "Controls PM Lynk-specific logo/background/color settings independent of main app branding.",
    keywords: ["pm lynk", "branding", "background", "colors", "mobile"]
  },
  {
    id: "pmlynk-background-image",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "Background Image",
    description: "Sets the PM Lynk dashboard background image for the current company.",
    keywords: ["pm lynk", "background", "image", "upload"]
  },
  {
    id: "pmlynk-mobile-logo",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "Mobile App Logo",
    description: "Logo shown in PM Lynk dashboard header and mobile branding contexts.",
    keywords: ["pm lynk", "logo", "mobile", "branding"]
  },
  {
    id: "pmlynk-primary-color",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "Primary Brand Color",
    description: "Main accent color used on PM Lynk cards and message containers.",
    keywords: ["pm lynk", "primary color", "theme", "appearance"]
  },
  {
    id: "pmlynk-highlight-color",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "Highlight Color",
    description: "Secondary emphasis color used for tags and highlights in PM Lynk.",
    keywords: ["pm lynk", "highlight", "accent", "color"]
  },
  {
    id: "pmlynk-container-opacity",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "Card/Container Opacity",
    description: "Controls overlay opacity for PM Lynk card containers over background imagery.",
    keywords: ["opacity", "container", "pm lynk", "card"]
  },
  {
    id: "pmlynk-dark-mode-default",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Branding & Appearance",
    setting: "Dark Mode Default",
    description: "Sets the default theme mode for new PM Lynk users.",
    keywords: ["dark mode", "default", "pm lynk", "theme"]
  },
  {
    id: "pmlynk-dashboard-style",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Dashboard Layout & Messages",
    setting: "Default Dashboard Style",
    description: "Defines default PM Lynk dashboard layout style (grid or list).",
    keywords: ["dashboard", "layout", "grid", "list", "pm lynk"]
  },
  {
    id: "pmlynk-daily-message-type",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Dashboard Layout & Messages",
    setting: "Default Daily Message",
    description: "Sets default daily message type (none, joke, riddle, quote, horoscope, fortune, custom).",
    keywords: ["daily message", "pm lynk", "quote", "joke", "custom"]
  },
  {
    id: "pmlynk-custom-message",
    category: "PM Lynk",
    section: "PM Lynk Settings",
    tab: "Dashboard Layout & Messages",
    setting: "Custom Message",
    description: "Custom text shown when daily message type is set to custom.",
    keywords: ["custom message", "pm lynk", "dashboard"]
  },
  {
    id: "company-date-format",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Company Info",
    setting: "Date Format",
    description: "Sets default date display format across the company UI.",
    keywords: ["date format", "regional", "company"]
  },
  {
    id: "company-currency-format",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Company Info",
    setting: "Currency Format",
    description: "Defines default currency display formatting for financial amounts.",
    keywords: ["currency", "format", "usd", "eur", "gbp"]
  },
  {
    id: "theme-mode",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "General",
    setting: "Theme",
    description: "Sets app theme mode to light, dark, or system.",
    keywords: ["theme", "light", "dark", "system"]
  },
  {
    id: "theme-compact-mode",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "General",
    setting: "Compact Mode",
    description: "Reduces UI spacing for denser information display.",
    keywords: ["compact", "density", "spacing", "theme"]
  },
  {
    id: "theme-logo-upload",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "General",
    setting: "Logo Upload",
    description: "Uploads display logo used in app branding areas.",
    keywords: ["logo", "upload", "theme", "branding"]
  },
  {
    id: "theme-dashboard-banner",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "General",
    setting: "Dashboard Banner",
    description: "Sets optional banner image for dashboard branding.",
    keywords: ["dashboard", "banner", "image", "theme"]
  },
  {
    id: "theme-navigation-mode",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "Display & Operation",
    setting: "Sidebar Categories Behavior",
    description: "Controls whether multiple sidebar groups can be expanded or only one at a time.",
    keywords: ["navigation", "sidebar", "single", "multiple", "behavior"]
  },
  {
    id: "theme-default-view",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "Display & Operation",
    setting: "Default View",
    description: "Sets default list style where supported (tiles, list, compact).",
    keywords: ["default view", "tiles", "list", "compact"]
  },
  {
    id: "theme-items-per-page",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "Display & Operation",
    setting: "Items Per Page",
    description: "Controls default pagination size across list-based pages.",
    keywords: ["pagination", "items per page", "list size"]
  },
  {
    id: "theme-auto-save-forms",
    category: "Company Settings",
    section: "Theme & Appearance",
    tab: "Display & Operation",
    setting: "Auto-save Forms",
    description: "Toggles automatic persistence behavior for form editing contexts where supported.",
    keywords: ["autosave", "forms", "operation", "display"]
  },
  {
    id: "payables-require-bill-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Require Bill Approval",
    description: "Requires approval before bills continue through payables workflow.",
    keywords: ["payables", "bill approval", "workflow", "approval"]
  },
  {
    id: "payables-auto-approval-limit",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Auto-Approval Amount Limit",
    description: "Bills at or below this amount can be auto-approved per company rules.",
    keywords: ["auto approval", "limit", "bill amount", "payables"]
  },
  {
    id: "payables-payment-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Require Payment Approval",
    description: "Requires explicit approval before payment execution.",
    keywords: ["payment approval", "payables", "approval"]
  },
  {
    id: "payables-payment-threshold",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Payment Approval Threshold",
    description: "Minimum payment amount requiring approval if payment approvals are enabled.",
    keywords: ["payment", "threshold", "approval", "amount"]
  },
  {
    id: "payables-dual-approval-threshold",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Dual Approval Threshold",
    description: "Large payments above this value require dual approval.",
    keywords: ["dual approval", "threshold", "large payment"]
  },
  {
    id: "payables-vendor-type-restrictions",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Vendor Type Restrictions",
    description: "Restricts which vendor types can be used for subcontracts and purchase orders.",
    keywords: ["vendor type", "restrictions", "subcontract", "purchase order"]
  },
  {
    id: "payables-default-payment-terms",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Default Payment Terms",
    description: "Sets default payment terms applied on new payable records.",
    keywords: ["payment terms", "default", "payables"]
  },
  {
    id: "payables-default-payment-method",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Default Payment Method",
    description: "Sets the default payment method for payable transactions.",
    keywords: ["payment method", "default", "ach", "check", "card"]
  },
  {
    id: "payables-required-attachments",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Required Attachments",
    description: "Controls whether receipts, bill docs, and credit card attachments are mandatory.",
    keywords: ["attachments", "receipts", "documents", "credit card", "required"]
  },
  {
    id: "payables-compliance-warning",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Show Vendor Compliance Warnings",
    description: "Displays warnings when vendor compliance requirements are not satisfied.",
    keywords: ["vendor compliance", "warnings", "payables"]
  },
  {
    id: "payment-terms-options",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Payment Terms Options",
    description: "Manages selectable payment term values available across billing/payables forms.",
    keywords: ["payment terms", "options", "net 30", "configuration"]
  },
  {
    id: "credit-card-require-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Credit Cards",
    setting: "Require Approval for Purchases",
    description: "Forces approval workflow for card purchases per configured threshold.",
    keywords: ["credit card", "purchase approval", "threshold"]
  },
  {
    id: "credit-card-monthly-limit",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Credit Cards",
    setting: "Monthly Spending Limit",
    description: "Company-level monthly card spending cap used for controls and alerts.",
    keywords: ["spending limit", "monthly", "credit card"]
  },
  {
    id: "credit-card-low-balance-alert",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Credit Cards",
    setting: "Low Balance Alerts",
    description: "Enables alerts when available card balance reaches configured threshold.",
    keywords: ["low balance", "alerts", "credit card"]
  },
  {
    id: "credit-card-auto-categorize",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Credit Cards",
    setting: "Auto-Categorize Purchases",
    description: "Automatically applies category defaults to imported card transactions.",
    keywords: ["categorize", "auto", "credit card", "coding"]
  },
  {
    id: "credit-card-default-coding",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Credit Cards",
    setting: "Default Cost Code / Default Job",
    description: "Sets fallback coding targets for card transactions when no explicit coding exists.",
    keywords: ["default cost code", "default job", "coding", "credit card"]
  },
  {
    id: "job-require-budget-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Require Budget Approval",
    description: "Requires budget approval based on threshold and change percentage rules.",
    keywords: ["job settings", "budget approval", "threshold", "change percent"]
  },
  {
    id: "job-require-project-manager",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Require Project Manager",
    description: "Enforces PM assignment requirement on job setup.",
    keywords: ["project manager", "job setup", "required"]
  },
  {
    id: "job-require-core-fields",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Require Job Description / Start Date / Budget",
    description: "Determines which core fields are mandatory during job creation.",
    keywords: ["job description", "start date", "budget", "required fields"]
  },
  {
    id: "job-require-cost-codes",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Require Cost Codes",
    description: "Forces cost code configuration on jobs with optional default auto-create.",
    keywords: ["cost codes", "job", "required", "auto create"]
  },
  {
    id: "job-default-status",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Default Job Status",
    description: "Sets status assigned to new jobs unless explicitly overridden.",
    keywords: ["default status", "jobs", "new job"]
  },
  {
    id: "job-completion-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Require Completion Approval",
    description: "Requires approval before job can be marked complete.",
    keywords: ["completion", "approval", "job closeout"]
  },
  {
    id: "job-timecard-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Require Timecard Approval",
    description: "Requires timecard review/approval according to company policy.",
    keywords: ["timecard approval", "job", "labor controls"]
  },
  {
    id: "job-overtime-approval",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Job Settings",
    setting: "Overtime Approval Required + Threshold",
    description: "Requires overtime approval and sets daily overtime trigger threshold.",
    keywords: ["overtime", "approval", "threshold", "job settings"]
  },
  {
    id: "company-check-pickup-locations",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Payables Settings",
    setting: "Check Pickup Locations",
    description: "Maintains saved pickup locations used in check/payment operations.",
    keywords: ["check pickup", "locations", "payables"]
  },
  {
    id: "company-journal-deletion",
    category: "Company Settings",
    section: "Company Settings",
    tab: "Banking Settings",
    setting: "Allow Journal Entry Deletion",
    description: "Controls whether users can delete journal entries after creation.",
    keywords: ["journal entry", "deletion", "banking", "controls"]
  },
  {
    id: "notif-email-enabled",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Email Notifications",
    description: "Enables/disables email delivery channel for supported notification events.",
    keywords: ["notifications", "email", "channel"]
  },
  {
    id: "notif-inapp-enabled",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "In-App Notifications",
    description: "Enables/disables in-app notification channel for supported events.",
    keywords: ["notifications", "in-app", "channel"]
  },
  {
    id: "notif-overdue-bills",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Overdue Bills + Frequency",
    description: "Sends overdue bill notifications on selected cadence (daily/weekly/biweekly).",
    keywords: ["overdue bills", "frequency", "daily", "weekly", "biweekly"]
  },
  {
    id: "notif-bill-payments",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Bill Payments",
    description: "Notifies users when bill payment events occur.",
    keywords: ["bill payments", "notifications"]
  },
  {
    id: "notif-vendor-invitations",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Vendor Invitations",
    description: "Notifies users for vendor invitation workflow events.",
    keywords: ["vendor invitations", "notifications"]
  },
  {
    id: "notif-job-assignments",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Job Assignments",
    description: "Notifies users when they are assigned to jobs.",
    keywords: ["job assignments", "notifications"]
  },
  {
    id: "notif-receipt-uploads",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Receipt Uploads",
    description: "Notifies on receipt upload events.",
    keywords: ["receipt uploads", "notifications"]
  },
  {
    id: "notif-bill-approval-requests",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Bill Approval Requests",
    description: "Notifies users when asked to approve or code bills.",
    keywords: ["bill approval", "coding request", "notifications"]
  },
  {
    id: "notif-credit-card-coding",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Credit Card Coding Requests",
    description: "Notifies users when they are asked to help code card transactions.",
    keywords: ["credit card", "coding", "request", "notifications"]
  },
  {
    id: "notif-chat",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Team Chat Notifications",
    description: "Controls @mention, channel, and direct message notification toggles.",
    keywords: ["team chat", "mentions", "channel messages", "direct messages"]
  },
  {
    id: "notif-financial-overview",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Notifications",
    setting: "Financial Overview Report + Frequency",
    description: "Schedules automated financial summary report notifications with cadence selection.",
    keywords: ["financial overview", "report", "schedule", "frequency"]
  },
  {
    id: "notif-email-templates",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Email Templates",
    setting: "Template Editing",
    description: "Allows preview/edit of system email templates and placeholders.",
    keywords: ["email templates", "preview", "edit", "placeholders"]
  },
  {
    id: "notif-email-history",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Email History",
    setting: "Sent Email Audit",
    description: "Shows sent email logs with status, recipient, type, and errors.",
    keywords: ["email history", "sent", "status", "errors"]
  },
  {
    id: "notif-sms-settings",
    category: "Notifications & Email",
    section: "Notifications & Email",
    tab: "Text Messaging",
    setting: "Company SMS Settings",
    description: "Configures company text messaging behavior and provider settings.",
    keywords: ["sms", "text messaging", "company sms"]
  },
  {
    id: "security-password-change",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Security",
    setting: "Change Password",
    description: "Updates current user password via reset/change flow.",
    keywords: ["password", "security", "change"]
  },
  {
    id: "security-2fa",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Security",
    setting: "Two-Factor Authentication",
    description: "Enables/disables extra authentication factor for account security.",
    keywords: ["2fa", "two-factor", "security", "authentication"]
  },
  {
    id: "security-data-export-import",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Data & Privacy",
    setting: "Export / Import Data",
    description: "Handles company data export and import for backup/migration scenarios.",
    keywords: ["export", "import", "backup", "data"]
  },
  {
    id: "security-delete-account",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Data & Privacy",
    setting: "Delete Account (Danger Zone)",
    description: "Irreversible account deletion workflow requiring explicit confirmation.",
    keywords: ["delete account", "danger zone", "irreversible"]
  },
  {
    id: "security-file-uploads",
    category: "Data & Security",
    section: "Data & Security",
    tab: "File Uploads",
    setting: "File Upload Policies",
    description: "Controls file size/type and upload behavior through file upload settings.",
    keywords: ["file uploads", "limits", "security", "types"]
  },
  {
    id: "security-third-party-storage",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Third-Party Storage",
    setting: "Third-Party Storage Integrations",
    description: "Configures external storage providers and connection behavior.",
    keywords: ["third-party storage", "integration", "cloud storage"]
  },
  {
    id: "security-search-index",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Search",
    setting: "Search Index Manager",
    description: "Manages search indexing behavior and rebuild/maintenance workflows.",
    keywords: ["search index", "manager", "reindex", "search"]
  },
  {
    id: "security-audit-log",
    category: "Data & Security",
    section: "Data & Security",
    tab: "Audit Log",
    setting: "Company Audit Log",
    description: "Tracks user actions and critical changes within company scope.",
    keywords: ["audit log", "activity", "history", "security"]
  },
  {
    id: "users-access-toggles",
    category: "User Management",
    section: "User Profile",
    tab: "Access",
    setting: "Punch Clock / PM Lynk Access",
    description: "Toggles app-level access per user for Punch Clock and PM Lynk.",
    keywords: ["user access", "punch clock", "pm lynk", "toggle"]
  },
  {
    id: "users-role-and-status",
    category: "User Management",
    section: "User Profile",
    tab: "Profile",
    setting: "Role and Status",
    description: "Sets user role assignment and account status lifecycle state.",
    keywords: ["role", "status", "approved", "pending", "suspended"]
  },
  {
    id: "users-login-history",
    category: "User Management",
    section: "User Profile",
    tab: "Login History",
    setting: "Login Event History",
    description: "Shows login records by app source, timestamp, and related metadata.",
    keywords: ["login history", "app source", "auth events"]
  },
  {
    id: "company-mgmt-overview-company-info",
    category: "Company Management",
    section: "Company Management",
    tab: "Overview",
    setting: "Company Information Overview",
    description: "Displays company profile summary and branding state for admin review.",
    keywords: ["company management", "overview", "company information"]
  },
  {
    id: "company-mgmt-logo-upload",
    category: "Company Management",
    section: "Company Management",
    tab: "Overview",
    setting: "Company Logo Upload/Replace",
    description: "Uploads and replaces company logo used across app branding.",
    keywords: ["logo", "upload", "company management", "branding"]
  },
  {
    id: "subscription-overview",
    category: "Subscription",
    section: "Subscription Portal",
    tab: "Overview",
    setting: "Plan Overview + Status",
    description: "Displays active tier, status, billing cycle, and plan action controls.",
    keywords: ["subscription", "overview", "status", "tier", "billing cycle"]
  },
  {
    id: "subscription-invoices",
    category: "Subscription",
    section: "Subscription Portal",
    tab: "Invoices",
    setting: "Invoice History",
    description: "Shows Stripe invoice records and links/PDF access.",
    keywords: ["subscription", "invoices", "stripe", "history"]
  },
  {
    id: "subscription-payment-method",
    category: "Subscription",
    section: "Subscription Portal",
    tab: "Payment Method",
    setting: "Saved Payment Methods",
    description: "Manages cards on file and update payment method workflow.",
    keywords: ["subscription", "payment method", "cards", "stripe"]
  },
  {
    id: "subscription-tier-definition",
    category: "Subscription",
    section: "Super Admin Subscription Settings",
    tab: "Tier Definitions",
    setting: "Tier Name / Pricing / Features",
    description: "Defines subscription tiers, pricing cadence, and feature access matrix.",
    keywords: ["tier", "pricing", "features", "subscription manager"]
  },
  {
    id: "subscription-tier-default-active",
    category: "Subscription",
    section: "Super Admin Subscription Settings",
    tab: "Tier Definitions",
    setting: "Tier Active + Default Flags",
    description: "Controls whether a tier is active and whether it is the default for new companies.",
    keywords: ["tier active", "default tier", "subscription"]
  },
  {
    id: "subscription-company-assignment",
    category: "Subscription",
    section: "Super Admin Subscription Settings",
    tab: "Company Subscription Manager",
    setting: "Assign Tier to Company",
    description: "Maps companies to subscription tiers with billing interval and status.",
    keywords: ["assign subscription", "company tier", "interval", "status"]
  }
];
