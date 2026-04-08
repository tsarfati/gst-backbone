type PaymentLineLike = {
  invoice_id?: string | null;
  payment_id?: string | null;
  amount_paid?: number | string | null;
  payments?: { amount?: number | string | null } | null;
};

export function getEffectivePaidByInvoice(paymentLines: PaymentLineLike[] = []) {
  const linesByPaymentId = new Map<string, PaymentLineLike[]>();
  const paidByInvoiceId = new Map<string, number>();

  paymentLines.forEach((line, index) => {
    const paymentId = line.payment_id || `line-${index}`;
    const rows = linesByPaymentId.get(paymentId) || [];
    rows.push(line);
    linesByPaymentId.set(paymentId, rows);
  });

  linesByPaymentId.forEach((lines) => {
    const lineTotal = lines.reduce((sum, line) => sum + Number(line.amount_paid || 0), 0);
    const paymentAmount = Number(lines[0]?.payments?.amount || 0);
    const scale = paymentAmount > 0 && lineTotal > paymentAmount + 0.01
      ? paymentAmount / lineTotal
      : 1;

    lines.forEach((line) => {
      const invoiceId = line.invoice_id;
      if (!invoiceId) return;
      const effectivePaid = Number(line.amount_paid || 0) * scale;
      paidByInvoiceId.set(invoiceId, (paidByInvoiceId.get(invoiceId) || 0) + effectivePaid);
    });
  });

  return paidByInvoiceId;
}
