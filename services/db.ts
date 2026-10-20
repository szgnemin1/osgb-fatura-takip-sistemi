
import { Firm, Transaction, TransactionType, PreparationItem, InvoiceType } from '../types';

// Simple, reliable ID generator without external dependencies
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const STORAGE_KEYS = {
  FIRMS: 'osgb_firms',
  TRANSACTIONS: 'osgb_transactions',
  PREPARATION: 'osgb_preparation',
  CLOUD_CONFIG: 'osgb_cloud_config' // Yeni Key
};

// Helper for localStorage
const getStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error('Storage read error', e);
    return defaultValue;
  }
};

const setStorage = <T>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write error', e);
  }
};

export const db = {
  // Firms
  getFirms: (): Firm[] => {
    return getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
  },
  
  addFirm: (firm: Omit<Firm, 'id'>) => {
    const firms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    const newFirm = { ...firm, id: generateId() };
    setStorage(STORAGE_KEYS.FIRMS, [...firms, newFirm]);
    return newFirm;
  },

  getFirmById: (id: string): Firm | undefined => {
    const firms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    return firms.find(f => f.id === id);
  },

  // Transactions
  getTransactions: (): Transaction[] => {
    const trans = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    // Migration: Eski kayıtlarda status yoksa APPROVED varsay
    return trans.map(t => ({
      ...t,
      status: t.status || 'APPROVED'
    }));
  },

  addTransaction: (transaction: Omit<Transaction, 'id'>) => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const newTransaction = { ...transaction, id: generateId() };
    setStorage(STORAGE_KEYS.TRANSACTIONS, [...transactions, newTransaction]);
    return newTransaction;
  },

  updateTransactionStatus: (id: string, status: 'APPROVED' | 'PENDING') => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const updated = transactions.map(t => t.id === id ? { ...t, status } : t);
    setStorage(STORAGE_KEYS.TRANSACTIONS, updated);
  },

  deleteTransaction: (id: string) => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const updated = transactions.filter(t => t.id !== id);
    setStorage(STORAGE_KEYS.TRANSACTIONS, updated);
  },

  // Preparation (Drafts)
  getPreparationItems: (): PreparationItem[] => {
    return getStorage<PreparationItem[]>(STORAGE_KEYS.PREPARATION, []);
  },

  savePreparationItems: (items: PreparationItem[]) => {
    setStorage(STORAGE_KEYS.PREPARATION, items);
  },

  // Dashboard Aggregates
  getStats: () => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    
    // Sadece ONAYLI işlemleri hesaba kat
    const approvedTransactions = transactions.filter(t => (t.status || 'APPROVED') === 'APPROVED');

    const totalBilled = approvedTransactions
      .filter(t => t.type === TransactionType.INVOICE)
      .reduce((sum, t) => sum + t.debt, 0);

    const totalCollected = approvedTransactions
      .filter(t => t.type === TransactionType.PAYMENT)
      .reduce((sum, t) => sum + t.credit, 0);

    return {
      totalBilled,
      totalCollected,
      balance: totalCollected // Basit nakit durumu (Giren Para)
    };
  },

  // DATA MANAGEMENT (BACKUP & RESTORE & IMPORT)
  
  getFullBackup: () => {
    return {
      firms: getStorage(STORAGE_KEYS.FIRMS, []),
      transactions: getStorage(STORAGE_KEYS.TRANSACTIONS, []),
      preparation: getStorage(STORAGE_KEYS.PREPARATION, []),
      backupDate: new Date().toISOString(),
      version: '1.2.0'
    };
  },

  restoreBackup: (data: any) => {
    try {
      if (data.firms) setStorage(STORAGE_KEYS.FIRMS, data.firms);
      if (data.transactions) setStorage(STORAGE_KEYS.TRANSACTIONS, data.transactions);
      if (data.preparation) setStorage(STORAGE_KEYS.PREPARATION, data.preparation);
      return true;
    } catch (e) {
      console.error("Restore failed", e);
      return false;
    }
  },

  bulkImportFirms: (data: any[]) => {
    const currentFirms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    const currentTrans = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    
    let newFirmsCount = 0;
    let newTransCount = 0;

    data.forEach(row => {
      // Excel row mapping
      const name = row['Firma Adı'] || row['name'];
      if (!name) return; // İsimsiz kayıt atla

      // Firma zaten var mı?
      if (currentFirms.some(f => f.name.toLowerCase() === name.toLowerCase())) return;

      const newId = generateId();
      
      const newFirm: Firm = {
        id: newId,
        name: name,
        basePersonLimit: Number(row['Taban Kişi']) || 10,
        baseFee: Number(row['Taban Ücret']) || 1000,
        extraPersonFee: Number(row['Ekstra Kişi Ücreti']) || 50,
        expertPercentage: Number(row['Uzman %']) || 60,
        doctorPercentage: Number(row['Doktor %']) || 40,
        defaultInvoiceType: row['Fatura Tipi'] === 'E-Arşiv' ? InvoiceType.E_ARSIV : InvoiceType.E_FATURA
      };

      currentFirms.push(newFirm);
      newFirmsCount++;

      // Açılış Bakiyesi Var mı?
      const openingBalance = Number(row['Başlangıç Borcu']) || 0;
      if (openingBalance > 0) {
        currentTrans.push({
          id: generateId(),
          firmId: newId,
          date: new Date().toISOString(),
          type: TransactionType.INVOICE,
          description: 'Açılış Devir Bakiyesi',
          debt: openingBalance,
          credit: 0,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          status: 'APPROVED',
          invoiceType: newFirm.defaultInvoiceType
        });
        newTransCount++;
      }
    });

    setStorage(STORAGE_KEYS.FIRMS, currentFirms);
    setStorage(STORAGE_KEYS.TRANSACTIONS, currentTrans);

    return { newFirmsCount, newTransCount };
  },

  // CLOUD CONFIG
  getCloudUrl: () => {
    return getStorage<string>(STORAGE_KEYS.CLOUD_CONFIG, '');
  },

  saveCloudUrl: (url: string) => {
    setStorage(STORAGE_KEYS.CLOUD_CONFIG, url);
  }
};
