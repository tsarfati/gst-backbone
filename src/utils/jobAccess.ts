export const canAccessJobIds = (
  jobIds: Array<string | null | undefined>,
  isPrivileged: boolean,
  allowedJobIds: string[],
): boolean => {
  void isPrivileged;
  const normalized = jobIds.filter((id): id is string => !!id);
  if (normalized.length === 0) return true;
  return normalized.every((id) => allowedJobIds.includes(id));
};

// Strict mode for financial visibility: user must be assigned to at least one job on the record.
export const canAccessAssignedJobOnly = (
  jobIds: Array<string | null | undefined>,
  isPrivileged: boolean,
  allowedJobIds: string[],
): boolean => {
  void isPrivileged;
  const normalized = jobIds.filter((id): id is string => !!id);
  if (normalized.length === 0) return false;
  return normalized.every((id) => allowedJobIds.includes(id));
};

export const ensureAllowedJobFilter = (
  selectedJobId: string | null | undefined,
  isPrivileged: boolean,
  allowedJobIds: string[],
): string | null => {
  void isPrivileged;
  if (!selectedJobId) return null;
  return allowedJobIds.includes(selectedJobId) ? selectedJobId : null;
};
