/** Formats integer paise as Indian Rupees, e.g. 5830000 -> "₹58,300.00". */
export function formatPaise(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
  }).format(rupees);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}
