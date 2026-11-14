import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAYMENT_STATUS_LABELS, type TransactionDTO } from '@mandimitra/shared';

const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'MandiMitraSans-Regular.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'MandiMitraSans-Bold.ttf');

/** Neutralises spreadsheet formula injection and quotes CSV values. */
export function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const r = (paise: number) => (paise / 100).toFixed(2);

export function transactionsToCsv(items: TransactionDTO[]): string {
  const header = [
    'Receipt No', 'Date', 'Crop', 'Quantity', 'Unit', 'Rate per unit (INR)', 'Gross (INR)', 'Commission %', 'Commission (INR)',
    'Transport (INR)', 'Other deductions (INR)', 'Net payable (INR)', 'Received (INR)', 'Outstanding (INR)', 'Payment status',
    'Buyer', 'Seller', 'Notes',
  ];
  const rows = items.map((t) => [
    t.receiptNumber, t.transactionDate.slice(0, 10), t.cropName, t.quantity, t.unit, r(t.ratePerUnitPaise), r(t.grossAmountPaise),
    t.commissionPercentage, r(t.commissionAmountPaise), r(t.transportChargePaise), r(t.otherDeductionsPaise), r(t.netAmountPaise),
    r(t.amountReceivedPaise), r(t.outstandingPaise), PAYMENT_STATUS_LABELS[t.paymentStatus], t.buyerName, t.sellerName, t.paymentNotes,
  ]);
  // BOM so Excel opens UTF-8 (Hindi names) correctly.
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ist = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const istDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });

export function receiptPdf(t: TransactionDTO, owner: { name: string; isDemo: boolean }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 36, info: { Title: `MandiMitra receipt ${t.receiptNumber}`, Author: 'MandiMitra AI' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', FONT_REGULAR);
    doc.registerFont('bold', FONT_BOLD);

    const green = '#14532d';
    const muted = '#6b7280';
    const W = doc.page.width - 72;

    doc.rect(0, 0, doc.page.width, 70).fill(green);
    doc.fillColor('#ffffff').font('bold').fontSize(16).text('MandiMitra AI', 36, 22);
    doc.font('regular').fontSize(8).text('Digital transaction receipt', 36, 44);
    doc.font('bold').fontSize(9).text(t.receiptNumber, 36, 26, { width: W, align: 'right' });
    doc.font('regular').fontSize(8).text(istDate(t.transactionDate), 36, 44, { width: W, align: 'right' });

    let y = 90;
    if (owner.isDemo) {
      doc.roundedRect(36, y, W, 18, 4).fill('#fef3c7');
      doc.fillColor('#92400e').font('bold').fontSize(7.5).text('DEMO RECEIPT: synthetic data', 36, y + 5, { width: W, align: 'center' });
      y += 28;
    }

    const party = (label: string, value: string | undefined, x: number) => {
      doc.fillColor(muted).font('regular').fontSize(7.5).text(label.toUpperCase(), x, y);
      doc.fillColor('#111827').font('bold').fontSize(10).text(value || 'Not recorded', x, y + 11, { width: W / 2 - 8 });
    };
    party('Seller', t.sellerName ?? owner.name, 36);
    party('Buyer', t.buyerName, 36 + W / 2);
    y += 40;

    doc.moveTo(36, y).lineTo(36 + W, y).strokeColor('#e5e7eb').stroke();
    y += 12;

    const row = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => {
      doc.fillColor(opts.color ?? '#374151').font(opts.bold ? 'bold' : 'regular').fontSize(opts.bold ? 11 : 9.5);
      doc.text(label, 36, y, { width: W * 0.6 });
      doc.text(value, 36, y, { width: W, align: 'right' });
      y += opts.bold ? 20 : 17;
    };
    row('Crop', t.cropName);
    row('Quantity', `${t.quantity.toLocaleString('en-IN')} ${t.unit}`);
    row(`Rate per ${t.unit}`, inr(t.ratePerUnitPaise));
    row('Gross amount', inr(t.grossAmountPaise));
    row(`Commission (${t.commissionPercentage}%)`, `− ${inr(t.commissionAmountPaise)}`);
    row('Transport charges', `− ${inr(t.transportChargePaise)}`);
    row('Other deductions', `− ${inr(t.otherDeductionsPaise)}`);
    y += 4;
    doc.roundedRect(36, y - 4, W, 30, 6).fill('#f0fdf4');
    y += 5;
    row('Net payable', inr(t.netAmountPaise), { bold: true, color: green });
    y += 8;
    row('Received so far', inr(t.amountReceivedPaise));
    row('Outstanding', inr(t.outstandingPaise));
    row('Payment status', PAYMENT_STATUS_LABELS[t.paymentStatus], { bold: false });
    if (t.confirmedAt) row('Confirmed by user at', ist(t.confirmedAt));

    y += 10;
    doc.fillColor(muted).font('regular').fontSize(7).text(
      'This receipt was generated by MandiMitra AI from details entered and confirmed by the account holder. ' +
        'It is a personal record only. It is not proof of payment and not a legal acknowledgement by the other party.',
      36, y, { width: W, align: 'center' },
    );
    doc.end();
  });
}
