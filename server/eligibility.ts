export function checkEligibility(invoice: {
  amountRemaining: string | number;
  dueDate: string;
  status: string | null;
  holdFlag: boolean | null;
}): boolean {
  const amount = Number(invoice.amountRemaining);
  if (amount <= 0) return false;

  const dueDate = new Date(invoice.dueDate);
  const now = new Date();
  const diffDays = Math.ceil(
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0 || diffDays > 45) return false;

  if (
    invoice.status &&
    !["APPROVED", "VALIDATED"].includes(invoice.status.toUpperCase())
  ) {
    return false;
  }

  if (invoice.holdFlag === true) return false;

  return true;
}
