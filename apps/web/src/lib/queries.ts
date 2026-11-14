import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Amounts, Paginated, PaymentRecordDTO, TransactionDTO, TransactionDraft } from '@mandimitra/shared';
import { api } from './api';

export interface ExtractionResult {
  draft: TransactionDraft;
  missingFields: string[];
  warnings: string[];
  evidence: Partial<Record<keyof TransactionDraft, string>>;
}

export interface TranscribeResponse {
  transcript: string;
  requestId: string;
  model?: string;
  detectedLanguageCode?: string;
  languageCodeSent: string;
  truncated: boolean;
  processingTimeSeconds?: number;
  audio: { format: string; durationSeconds?: number };
  extraction: ExtractionResult | null;
}

export interface Analytics {
  totals: {
    transactions: number; grossSalesPaise: number; netPayablePaise: number; receivedPaise: number; pendingPaise: number;
    partiallyPaidCount: number; overdueCount: number; overduePaise: number;
  };
  statusDistribution: { status: TransactionDTO['paymentStatus']; count: number; netPaise: number }[];
  cropWise: { crop: string; count: number; grossPaise: number; netPaise: number }[];
  monthly: { month: string; count: number; grossPaise: number; netPaise: number; receivedPaise: number }[];
  recent: TransactionDTO[];
}

export type PreviewResponse = { amounts: Amounts & { ratePerUnitPaise: number }; summaryText: string; speechLanguage: string };

export const useAnalytics = () => useQuery({ queryKey: ['analytics'], queryFn: () => api.get<Analytics>('/api/analytics') });

export function useTransactions(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
  return useQuery({
    queryKey: ['transactions', qs],
    queryFn: () => api.get<Paginated<TransactionDTO>>(`/api/transactions?${qs}`),
    placeholderData: keepPreviousData,
  });
}

export const useTransaction = (id: string) =>
  useQuery({ queryKey: ['transaction', id], queryFn: () => api.get<{ transaction: TransactionDTO }>(`/api/transactions/${id}`).then((r) => r.transaction) });

export const usePayments = (id: string) =>
  useQuery({ queryKey: ['payments', id], queryFn: () => api.get<{ payments: PaymentRecordDTO[] }>(`/api/transactions/${id}/payments`).then((r) => r.payments) });

export const useAllPayments = () =>
  useQuery({ queryKey: ['payments', 'all'], queryFn: () => api.get<{ payments: (PaymentRecordDTO & { cropName?: string; receiptNumber?: string })[] }>('/api/payments').then((r) => r.payments) });
