export type VendorPortalRole = "owner" | "basic_user";

export const VENDOR_PORTAL_ROLE_OPTIONS: Array<{
  value: VendorPortalRole;
  label: string;
  description: string;
}> = [
  {
    value: "owner",
    label: "Company Owner",
    description: "Label this person as the main vendor contact for their company.",
  },
  {
    value: "basic_user",
    label: "Vendor Employee",
    description: "Standard coworker label for anyone else on the vendor team.",
  },
];

export const normalizeVendorPortalRole = (value: unknown): VendorPortalRole => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "owner" ? "owner" : "basic_user";
};

export const getVendorPortalRoleLabel = (value: unknown) =>
  VENDOR_PORTAL_ROLE_OPTIONS.find((option) => option.value === normalizeVendorPortalRole(value))?.label || "Vendor Employee";
