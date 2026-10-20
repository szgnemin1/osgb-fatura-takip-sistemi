export interface Firm {
  id: string;
  name: string;
  basePersonLimit: number; // Taban Kişi Limiti
  baseFee: number; // Taban Ücret
  extraPersonFee: number; // Ekstra Kişi Ücreti
  expertPercentage: number; // Uzman Yüzdesi
  doctorPercentage: number; // Doktor Yüzdesi
  defaultInvoiceType: InvoiceType; // Varsayılan Fatura Tipi
}

export enum TransactionType {
  INVOICE = 'FATURA',
  PAYMENT = 'TAHSİLAT'
}

export enum InvoiceType {
  E_FATURA = 'E-Fatura',
  E_ARSIV = 'E-Arşiv'
}

export type TransactionStatus = 'PENDING' | 'APPROVED';

export interface Transaction {
  id: string;
  firmId: string;
  date: string;
  type: TransactionType;
  invoiceType?: InvoiceType; // Sadece fatura ise
  description: string;
  debt: number; // Borç (Kesilen Fatura)
  credit: number; // Alacak (Ödenen Para)
  month: number;
  year: number;
  status: TransactionStatus; // Onay durumu
  // Hesaplama detaylarını saklamak için (Historical data)
  calculatedDetails?: {
    employeeCount: number;
    extraItemAmount: number;
    expertShare: number;
    doctorShare: number;
  };
}

export interface PreparationItem {
  firmId: string;
  currentEmployeeCount: number;
  extraItemAmount: number;
}