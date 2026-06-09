const MILLION = 1_000_000;
const TOKENS_PER_MILLION = MILLION;

export function formatUsd(amountStr: string | number): string {
  const amount = typeof amountStr === 'string' ? parseFloat(amountStr) : amountStr;
  if (!isFinite(amount)) return '$0.00';
  if (amount === 0) return '$0.00';
  if (amount < 0.001) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatCostPerMillion(costPerToken: string | number): string {
  const cost = typeof costPerToken === 'string' ? parseFloat(costPerToken) : costPerToken;
  if (!isFinite(cost) || cost === 0) return '$0.00 / 1M tokens';
  const perMillion = cost * TOKENS_PER_MILLION;
  return `${formatUsd(perMillion)} / 1M tokens`;
}
