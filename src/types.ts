
export enum PricingModel {
  STANDARD = 'STANDART',
  TOLERANCE = 'TOLERANSLI',
  TIERED = 'KADEMELI'
}

export interface PricingTier {
  min: number;
  max: number;
  price: number;
}

export enum ServiceType {
  BOTH = 'BOTH',
  EXPERT_ONLY = 'EXPERT_ONLY',
  DOCTOR_ONLY = 'DOCTOR_ONLY'
}

export interface Firm {
  id: string;
  name: string;
  basePersonLimit: number;
  baseFee: number;
  extraPersonFee: number;
  expertPercentage: number;
  doctorPercentage: number;
  defaultInvoiceType: InvoiceType;
  
  // Extended properties for Advanced Pricing & Features
  parentFirmId?: string;
  taxNumber?: string;
  sgkNumber?: string; // Hizmet Alan İşyeri SGK/DETSİS No
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  yearlyFee?: number;
  pricingModel: PricingModel;
  tolerancePercentage?: number;
  tiers?: PricingTier[];
  serviceType?: ServiceType;
  isKdvExcluded?: boolean;
  savedPoolConfig?: string[];
  dangerClass?: string; // e.g. "Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"

  // Secondary Model Configuration
  hasSecondaryModel?: boolean;
  secondaryPricingModel?: PricingModel;
  secondaryBaseFee?: number;
  secondaryBasePersonLimit?: number;
  secondaryExtraPersonFee?: number;
  secondaryTiers?: PricingTier[];

  // Tetkik Takip Integration Fields
  assignedDoctor?: string;
  assignedSpecialist?: string;
  defaultExams?: string[];
  defaultPaymentMethod?: 'CASH' | 'POS' | 'INVOICE';

  // Quote Workflow
  quoteStatus?: 'BEKLIYOR' | 'ONAYDA' | 'ONAYLANDI';
  proposedBasePersonLimit?: number;
  proposedBaseFee?: number;
  proposedExtraPersonFee?: number;
}

export enum TransactionType {
  INVOICE = 'FATURA',
  PAYMENT = 'TAHSİLAT',
  CHEQUE = 'ÇEK'
}

export type ChequeStatus = 'PORTFOY' | 'PENDING_APPROVAL' | 'COLLECTED';

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
  invoiceType?: InvoiceType;
  description: string;
  debt: number;
  credit: number;
  month: number;
  year: number;
  status: TransactionStatus;
  dueDate?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeStatus?: ChequeStatus;
  calculatedDetails?: {
    employeeCount: number;
    extraItemAmount: number;
    expertShare: number;
    doctorShare: number;
    serviceAmount?: number;
    yearlyFeeAmount?: number;
  };
}

export interface PreparationItem {
  firmId: string;
  currentEmployeeCount: number;
  extraItemAmount: number;
  addYearlyFee?: boolean;
  externalHealthRecordIds?: string[];
}

export interface GlobalSettings {
  expertPercentage: number;
  doctorPercentage: number;
  vatRateExpert: number;
  vatRateDoctor: number;
  vatRateHealth: number;
  reportEmail?: string;
  bankInfo: string;
  simpleDebtMode?: boolean;
    companyLogo?: string;
    quoteIntroTemplate?: string;
    quoteFooterTemplate?: string; // YENİ: Sadeleştirilmiş Borç Modu
}

export interface LogEntry {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  deviceInfo: string;
}

// --- GİDER YÖNETİMİ TİPLERİ ---
export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  date: string;
  amount: number;
  description: string;
  month: number;
  year: number;
}

// --- KULLANICI YÖNETİMİ TİPLERİ ---
export interface AppUser {
  id: number | string;
  username: string;
  role: 'admin' | 'user';
  twoFactorEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// --- TELEGRAM BOT TİPLERİ ---
export interface TelegramConfig {
  isConfigured: boolean;
  isActive: boolean;
  botUsername: string;
  maskedToken: string;
  isPollingRunning: boolean;
  allowedUsers: TelegramAllowedUser[];
}

export interface TelegramAllowedUser {
  id: number;
  telegram_id: string;
  name: string;
  created_at: string;
}

// --- CARİ MUTABAKAT & WHATSAPP TİPLERİ ---
export type ReconciliationStatus = 'PENDING_SEND' | 'SENT' | 'APPROVED' | 'DISPUTED';

export interface ReconciliationItem {
  id: string;
  firm_id: string;
  firm_name: string;
  period: string;
  balance: number;
  total_billed: number;
  total_paid: number;
  status: ReconciliationStatus;
  phone: string;
  token: string;
  sent_at?: string;
  response_at?: string;
  response_status?: 'MUTABIK' | 'FARK_VAR';
  response_balance?: number;
  response_note?: string;
  client_ip?: string;
  created_at: string;
  updated_at?: string;
}

export interface WhatsAppStatus {
  isConnected: boolean;
  qrCode: string | null;
  phoneNumber?: string;
  name?: string;
}


