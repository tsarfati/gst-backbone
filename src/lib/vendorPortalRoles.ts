export type VendorPortalRole =
  | "owner"
  | "admin"
  | "accounting"
  | "project_contact"
  | "estimator"
  | "compliance_manager"
  | "basic_user";

export const VENDOR_PORTAL_ROLE_OPTIONS: Array<{
  value: VendorPortalRole;
  label: string;
  description: string;
}> = [
  {
    value: "owner",
    label: "Owner",
    description: "Full vendor portal control, including team management and settings.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Can manage users and most vendor portal workflows.",
  },
  {
    value: "accounting",
    label: "Accounting",
    description: "Focused on bills, payments, and contract visibility.",
  },
  {
    value: "project_contact",
    label: "Project Contact",
    description: "Can work in job collaboration, plans, submittals, and messages.",
  },
  {
    value: "estimator",
    label: "Estimator",
    description: "Focused on RFPs, plan review, and bid submission.",
  },
  {
    value: "compliance_manager",
    label: "Compliance Manager",
    description: "Handles compliance documents and related communication.",
  },
  {
    value: "basic_user",
    label: "Basic User",
    description: "Light access for messages and limited job visibility.",
  },
];

export const normalizeVendorPortalRole = (value: unknown): VendorPortalRole => {
  const normalized = String(value || "").trim().toLowerCase();
  if (VENDOR_PORTAL_ROLE_OPTIONS.some((option) => option.value === normalized)) {
    return normalized as VendorPortalRole;
  }
  return "basic_user";
};

export const getVendorPortalRoleLabel = (value: unknown) =>
  VENDOR_PORTAL_ROLE_OPTIONS.find((option) => option.value === normalizeVendorPortalRole(value))?.label || "Basic User";
