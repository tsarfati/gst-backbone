export interface InvoiceCodingDistribution {
  amount?: number | null;
  cost_code_id?: string | null;
  job_id?: string | null;
  cost_codes?: {
    job_id?: string | null;
    jobs?: { id?: string | null } | null;
  } | null;
}

export interface InvoiceCodingInput {
  amount?: number | null;
  job_id?: string | null;
  cost_code_id?: string | null;
  cost_codes?: {
    job_id?: string | null;
    jobs?: { id?: string | null } | null;
  } | null;
  distributions?: InvoiceCodingDistribution[];
}

export interface InvoiceCodingResult {
  isComplete: boolean;
  issues: string[];
  totalDistributed: number;
  hasDistributionLines: boolean;
}

const CODING_EPSILON = 0.01;

const normalizeNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function evaluateInvoiceCoding(input: InvoiceCodingInput): InvoiceCodingResult {
  const issues: string[] = [];
  const invoiceAmount = normalizeNumber(input.amount);
  const distributions = (input.distributions || []).filter((line) => line && normalizeNumber(line.amount) > 0);

  if (invoiceAmount <= 0) {
    issues.push("Bill amount must be greater than 0.");
  }

  if (distributions.length > 0) {
    const missingCostCode = distributions.some((line) => !line.cost_code_id);
    if (missingCostCode) {
      issues.push("Every distribution line must have a cost code.");
    }

    const missingJob = distributions.some((line) => {
      const resolvedJobId = line.job_id || line.cost_codes?.job_id || line.cost_codes?.jobs?.id || null;
      const hasCostCodeMetadata = !!line.cost_codes;
      return !resolvedJobId && !hasCostCodeMetadata;
    });
    if (missingJob) {
      issues.push("Every distribution line must be assigned to a job.");
    }

    const totalDistributed = distributions.reduce((sum, line) => sum + normalizeNumber(line.amount), 0);
    if (Math.abs(totalDistributed - invoiceAmount) > CODING_EPSILON) {
      issues.push("Distribution total must match the full bill amount.");
    }

    return {
      isComplete: issues.length === 0,
      issues,
      totalDistributed,
      hasDistributionLines: true,
    };
  }

  if (!input.cost_code_id) {
    issues.push("A cost code is required before approval.");
  }
  const resolvedCostCodeJobId = input.cost_codes?.job_id || input.cost_codes?.jobs?.id || null;
  const hasCostCodeMetadata = !!input.cost_codes;
  if (!input.job_id && !resolvedCostCodeJobId && !hasCostCodeMetadata) {
    issues.push("A job is required before approval.");
  }

  return {
    isComplete: issues.length === 0,
    issues,
    totalDistributed: 0,
    hasDistributionLines: false,
  };
}
