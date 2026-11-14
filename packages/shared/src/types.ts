import type { PaymentStatus, Unit, UserRole } from './constants.js';
import type { TransactionDraft } from './schemas.js';

/** All money values in API responses are integer paise (₹1 = 100 paise). */
export interface Amounts {
  grossAmountPaise: number;
  commissionAmountPaise: number;
  transportChargePaise: number;
  otherDeductionsPaise: number;
  netAmountPaise: number;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  preferredLanguage: string;
  saveTranscriptsByDefault: boolean;
  isDemo: boolean;
}

export interface TransactionDTO extends Amounts {
  id: string;
  receiptNumber: string;
  cropName: string;
  quantity: number;
  unit: Unit;
  ratePerUnitPaise: number;
  commissionPercentage: number;
  buyerName?: string;
  sellerName?: string;
  transactionDate: string;
  paymentDueDate?: string;
  isOverdue: boolean;
  paymentStatus: PaymentStatus;
  paymentNotes?: string;
  transcript?: string;
  extractedData?: TransactionDraft;
  confirmed: boolean;
  confirmedAt?: string;
  amountReceivedPaise: number;
  outstandingPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecordDTO {
  id: string;
  transactionId: string;
  amountPaise: number;
  method: string;
  note?: string;
  paidAt: string;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
