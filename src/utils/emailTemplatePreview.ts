const DEFAULT_SAMPLE_VALUES: Record<string, string> = {
  customer_name: "John Doe",
  company_name: "GreenStar Builders",
  invoice_number: "INV-1042",
  amount: "$12,480.00",
  due_date: "Friday, May 8, 2026",
  vendor_name: "Atlas Mechanical",
  invitation_link: "https://builderlynk.com/invitations/sample-token",
  job_name: "4700 Spruce Street",
  assignee_name: "Jane Smith",
  start_date: "Monday, May 4, 2026",
  uploader_name: "Michael Tsarfati",
  filename: "schedule-of-values.pdf",
  rfp_title: "Electrical Package - Core & Shell",
  rfp_number: "RFP-026",
  scope_of_work_block:
    '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #e5e7eb;"><p style="margin:0 0 10px 0;font-size:14px;font-weight:600;">Scope of Work:</p><p style="margin:0;font-size:14px;color:#4b5563;">Provide labor, materials, supervision, and closeout for the electrical rough-in and finish package.</p></div>',
  custom_message_block:
    '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px 18px;margin:20px 0;"><p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#9a3412;">Project-specific note from GreenStar Builders</p><p style="margin:0;font-size:15px;color:#7c2d12;">Please review alternates 2 and 3 carefully and include lead times with your bid.</p></div>',
  cta_secondary_copy:
    "Open BuilderLYNK to review the issued information, communicate with the team, and submit your bid.",
  cta_href: "https://builderlynk.com/vendor/dashboard",
  cta_label: "Open BuilderLYNK",
};

const RFP_SAMPLE_VALUES: Record<string, string> = {
  ...DEFAULT_SAMPLE_VALUES,
  company_name: "GreenStar Builders",
  vendor_name: "Titan Electric",
  rfp_title: "Electrical Package - 4700 Spruce",
  rfp_number: "RFP-047",
  due_date: "Thursday, April 30, 2026",
};

const normalizeTemplateKey = (key: string | null | undefined) =>
  String(key || "").trim().toLowerCase();

export const getEmailTemplateSampleValues = (templateKey: string | null | undefined) => {
  switch (normalizeTemplateKey(templateKey)) {
    case "rfp_invitation":
      return RFP_SAMPLE_VALUES;
    default:
      return DEFAULT_SAMPLE_VALUES;
  }
};

export const renderEmailTemplatePreview = (
  template: string,
  templateKey: string | null | undefined,
) => {
  const sampleValues = getEmailTemplateSampleValues(templateKey);
  let rendered = String(template || "");

  Object.entries(sampleValues).forEach(([key, value]) => {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  });

  return rendered.replace(/\{\{[\w_]+\}\}/g, "[placeholder]");
};
