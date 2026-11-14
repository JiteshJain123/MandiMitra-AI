import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@mandimitra/shared';
import { cn } from '@/lib/utils';

const styles: Record<PaymentStatus, string> = {
  pending: 'bg-turmeric-50 text-turmeric-700 ring-turmeric-500/30',
  partially_paid: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  paid: 'bg-mandi-50 text-mandi-700 ring-mandi-500/30',
  disputed: 'bg-ledger-50 text-ledger-700 ring-ledger-500/30',
};

export function StatusBadge({ status, overdue }: { status: PaymentStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', styles[status])}>
        {PAYMENT_STATUS_LABELS[status]}
      </span>
      {overdue && <span className="rounded-full bg-ledger-50 px-2 py-0.5 text-xs font-medium text-ledger-700 ring-1 ring-inset ring-ledger-500/30">Overdue</span>}
    </span>
  );
}
