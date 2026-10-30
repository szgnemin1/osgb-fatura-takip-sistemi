
import { Firm, Transaction, TransactionType, PreparationItem, InvoiceType, GlobalSettings, PricingTier, ExpenseCategory, Expense, AppUser, TelegramConfig, TelegramAllowedUser } from '../types';

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const STORAGE_KEYS = {
  FIRMS: 'osgb_firms',
  TRANSACTIONS: 'osgb_transactions',
  PREPARATION: 'osgb_preparation',
  GLOBAL_SETTINGS: 'osgb_global_settings',
  LOGS: 'osgb_logs',
  CLOUD_CONFIG: 'osgb_cloud_config',
  EXPENSE_CATEGORIES: 'osgb_expense_categories',
  EXPENSES: 'osgb_expenses',
  EXTERNAL_HEALTH: 'osgb_external_health'
};


// Sunucudan veri okuma
const isElectron = false; // Disabled Electron Support for Web Version

// --- VERİ ÇAKIŞMA KİLİDİ ---
type Listener = () => void;
let listeners: Listener[] = [];

const notifyListeners = () => { listeners.forEach(l => l()); };


// Ortak Fetch sarmalayıcı (Token yönetimi için)
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        window.dispatchEvent(new Event('auth_error'));
        throw new Error(response.status.toString());
    }
    return response;
};

let activePersistPromise: Promise<boolean> | null = null;
let pendingPersistQueued = false;

const persistData = async (): Promise<boolean> => {
    if (activePersistPromise) {
        pendingPersistQueued = true;
        return activePersistPromise;
    }

        activePersistPromise = (async () => {
        try {
            const fullData: any = {};
            Object.values(STORAGE_KEYS).forEach(k => {
                const item = localStorage.getItem(k);
                if (item) fullData[k] = item;
            });

            await fetchWithAuth('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullData)
            });
            return true;
        } catch (e) {
            console.error("Sunucuya kayıt hatası:", e);
            return false;
        } finally {
                        activePersistPromise = null;
            if (pendingPersistQueued) {
                pendingPersistQueued = false;
                persistData();
            }
        }
    })();

    return activePersistPromise;
};

let saveTimeout: any = null;
const debounceSaveToDisk = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => { persistData(); }, 300);
};

const getStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) { return defaultValue; }
};

const setStorage = <T>(key: string, value: T) => {
   
  localStorage.setItem(key, JSON.stringify(value));
  debounceSaveToDisk();
  notifyListeners(); 
};

export const db = {
  subscribe: (listener: Listener) => {
      listeners.push(listener);
      return () => { listeners = listeners.filter(l => l !== listener); };
  },

  // VERİTABANI BAŞLATMA (Sadece Web / Sunucu Uyumlu)
  initData: async (forceSync = false): Promise<boolean> => {
    try {
        let parsedData: any = null;

        // BROWSER: Sunucudan Çek
        const response = await fetchWithAuth('/api/data');
        if (response.ok) {
            parsedData = await response.json();
        }

        // LocalStorage'ı güncelle (Yerel PENDING faturaları koruyarak birleştir)
        if (parsedData && Object.keys(parsedData).length > 0) {
            Object.keys(parsedData).forEach(key => { 
                if (!parsedData[key]) return;

                if (key === STORAGE_KEYS.TRANSACTIONS) {
                    const localStr = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
                    if (localStr) {
                        try {
                            const localTrans: any[] = JSON.parse(localStr);
                            const serverTrans: any[] = JSON.parse(parsedData[key]);
                            const serverIdMap = new Map(serverTrans.map(t => [t.id, t]));
                            
                            // Sunucuda henüz olmayan yerel PENDING faturaları koru (ezilip silinmesini önle)
                            const localPendingToKeep = localTrans.filter(lt => !serverIdMap.has(lt.id) && lt.status === 'PENDING');
                            const merged = [...serverTrans, ...localPendingToKeep];
                            localStorage.setItem(key, JSON.stringify(merged));
                            return;
                        } catch (err) {
                            console.error('Transactions merge error:', err);
                        }
                    }
                }
                
                localStorage.setItem(key, parsedData[key]); 
            });
            notifyListeners();
            return true;
        }
    } catch (e) { 
        console.error("DB Başlatma Hatası", e);
        throw e;
    }
    return false;
  },

  forceSync: () => { persistData(); notifyListeners(); },
  saveDataImmediate: async () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    return await persistData();
  },

  getFirms: (): Firm[] => getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []).sort((a, b) => a.name.localeCompare(b.name)),
  saveFirms: (firms: Firm[]) => setStorage(STORAGE_KEYS.FIRMS, firms),
  
  addFirm: (firm: Omit<Firm, 'id'>) => {
    const firms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    const newFirm = { ...firm, id: generateId() };
    setStorage(STORAGE_KEYS.FIRMS, [...firms, newFirm]);
    return newFirm;
  },

  updateFirm: (firm: Firm) => {
    const firms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    setStorage(STORAGE_KEYS.FIRMS, firms.map(f => f.id === firm.id ? firm : f));
  },

  deleteFirm: (id: string) => {
    const firms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    setStorage(STORAGE_KEYS.FIRMS, firms.filter(f => f.id !== id));
    if (!isElectron) {
      fetchWithAuth('/api/firms/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      }).catch(() => {});
    }
  },

  deleteFirmsBulk: (ids: string[]) => {
    const firms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    setStorage(STORAGE_KEYS.FIRMS, firms.filter(f => !ids.includes(f.id)));
    if (!isElectron) {
      fetchWithAuth('/api/firms/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      }).catch(() => {});
    }
  },

  getTransactions: (): Transaction[] => getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []).map(t => ({...t, status: t.status || 'APPROVED'})),

  addTransaction: async (transaction: Omit<Transaction, 'id'>) => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const newTransaction: Transaction = { ...transaction, id: generateId() };
    const updated = [...transactions, newTransaction];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    notifyListeners();
    if (!isElectron) {
      try {
        await fetchWithAuth('/api/transactions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: [newTransaction] })
        });
      } catch (_) {
        await persistData();
      }
    } else {
      await persistData();
    }
    return newTransaction;
  },

  addTransactionsBulk: async (newTransactionsList: Omit<Transaction, 'id'>[]) => {
    if (!newTransactionsList || newTransactionsList.length === 0) return [];
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const createdList: Transaction[] = newTransactionsList.map(t => ({
      ...t,
      id: generateId()
    }));
    
    // Tek seferde LocalStorage'a yaz ve listener'ları bilgilendir
    const updated = [...transactions, ...createdList];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    notifyListeners();
    
    // Anında ve garantili olarak sunucuya yaz
    if (!isElectron) {
      try {
        await fetchWithAuth('/api/transactions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: createdList })
        });
      } catch (_) {
        await persistData();
      }
    } else {
      await persistData();
    }
    return createdList;
  },

  updateTransaction: (transaction: Transaction) => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index !== -1) {
        transactions[index] = transaction;
        setStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
    }
  },

  updateTransactionStatus: async (id: string, status: 'APPROVED' | 'PENDING') => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const target = transactions.find(t => t.id === id);
    const updated = transactions.map(t => t.id === id ? { ...t, status } : t);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    notifyListeners();

    if (status === 'APPROVED' && !isElectron) {
       try {
           await fetchWithAuth('/api/transactions/approve', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ id, transaction: target ? { ...target, status: 'APPROVED' } : undefined })
           });
       } catch (e) {
           console.error('Onay hatası:', e);
           persistData();
       }
    } else {
       persistData();
    }
  },

  updateTransactionsStatusBulk: async (ids: string[], status: 'APPROVED' | 'PENDING') => {
    if (!ids || ids.length === 0) return;
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const idSet = new Set(ids);
    const updated = transactions.map(t => idSet.has(t.id) ? { ...t, status } : t);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    notifyListeners();

    if (status === 'APPROVED' && !isElectron) {
       try {
           await fetchWithAuth('/api/transactions/approve', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ ids })
           });
       } catch (e) {
           console.error('Toplu onay hatası:', e);
           persistData();
       }
    } else {
       persistData();
    }
  },

  deleteTransaction: (id: string) => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const toDelete = transactions.find(t => t.id === id);
    if (toDelete?.calculatedDetails?.externalHealthRecordIds) {
        db.markExternalHealthServicesAsUnbilled(toDelete.calculatedDetails.externalHealthRecordIds);
    }
    setStorage(STORAGE_KEYS.TRANSACTIONS, transactions.filter(t => t.id !== id));
    if (!isElectron) {
      fetchWithAuth('/api/transactions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      }).catch(() => {});
    }
  },

  deleteTransactionsBulk: (ids: string[]) => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const extIdsToUnbill: string[] = [];
    transactions.forEach(t => {
        if (ids.includes(t.id) && t.calculatedDetails?.externalHealthRecordIds) {
            extIdsToUnbill.push(...t.calculatedDetails.externalHealthRecordIds);
        }
    });
    if (extIdsToUnbill.length > 0) {
        db.markExternalHealthServicesAsUnbilled(extIdsToUnbill);
    }
    setStorage(STORAGE_KEYS.TRANSACTIONS, transactions.filter(t => !ids.includes(t.id)));
    if (!isElectron) {
      fetchWithAuth('/api/transactions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      }).catch(() => {});
    }
  },

  // --- GİDER YÖNETİMİ ---
  getExpenseCategories: (): ExpenseCategory[] => getStorage<ExpenseCategory[]>(STORAGE_KEYS.EXPENSE_CATEGORIES, []),
  
  addExpenseCategory: (name: string) => {
    const cats = getStorage<ExpenseCategory[]>(STORAGE_KEYS.EXPENSE_CATEGORIES, []);
    const newCat = { id: generateId(), name };
    setStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, [...cats, newCat]);
    return newCat;
  },

  deleteExpenseCategory: (id: string) => {
    const cats = getStorage<ExpenseCategory[]>(STORAGE_KEYS.EXPENSE_CATEGORIES, []);
    setStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, cats.filter(c => c.id !== id));
  },

  getExpenses: (): Expense[] => getStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []),

  addExpense: (expense: Omit<Expense, 'id'>) => {
    const expenses = getStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    const newExpense = { ...expense, id: generateId() };
    setStorage(STORAGE_KEYS.EXPENSES, [...expenses, newExpense]);
    return newExpense;
  },

  deleteExpense: (id: string) => {
    const expenses = getStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    setStorage(STORAGE_KEYS.EXPENSES, expenses.filter(e => e.id !== id));
  },

  getPreparationItems: (): PreparationItem[] => getStorage<PreparationItem[]>(STORAGE_KEYS.PREPARATION, []),
  
  savePreparationItems: (items: PreparationItem[]) => { setStorage(STORAGE_KEYS.PREPARATION, items); },

  getExternalHealthServices: () => getStorage<any[]>(STORAGE_KEYS.EXTERNAL_HEALTH, []),

  markExternalHealthServicesAsBilled: (ids: string[]) => {
      const services = getStorage<any[]>(STORAGE_KEYS.EXTERNAL_HEALTH, []);
      const updated = services.map(s => ids.includes(s.id) ? { ...s, isBilled: true } : s);
      setStorage(STORAGE_KEYS.EXTERNAL_HEALTH, updated);
      if (!isElectron) {
        fetchWithAuth('/api/external-health/bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, isBilled: true })
        }).catch(() => {});
      }
  },

  markExternalHealthServicesAsUnbilled: (ids: string[]) => {
      const services = getStorage<any[]>(STORAGE_KEYS.EXTERNAL_HEALTH, []);
      const updated = services.map(s => ids.includes(s.id) ? { ...s, isBilled: false } : s);
      setStorage(STORAGE_KEYS.EXTERNAL_HEALTH, updated);
      if (!isElectron) {
        fetchWithAuth('/api/external-health/bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, isBilled: false })
        }).catch(() => {});
      }
  },

  getStats: () => {
    const transactions = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []).filter(t => (t.status || 'APPROVED') === 'APPROVED');
    const billed = transactions.filter(t => t.type === TransactionType.INVOICE).reduce((sum, t) => sum + t.debt, 0);
    const collected = transactions.filter(t => t.type === TransactionType.PAYMENT).reduce((sum, t) => sum + t.credit, 0);
    const expenses = getStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []).reduce((sum, e) => sum + e.amount, 0);
    return { 
        totalBilled: billed, 
        totalCollected: collected, 
        balance: billed - collected,
        totalExpenses: expenses,
        netProfit: collected - expenses
    };
  },

  getGlobalSettings: (): GlobalSettings => getStorage<GlobalSettings>(STORAGE_KEYS.GLOBAL_SETTINGS, {
      expertPercentage: 60, 
      doctorPercentage: 40, 
      vatRateExpert: 20, 
      vatRateDoctor: 10, 
      vatRateHealth: 10, 
      reportEmail: '', 
      bankInfo: '',
      simpleDebtMode: false // Varsayılan kapalı
  }),

  saveGlobalSettings: (settings: GlobalSettings) => { setStorage(STORAGE_KEYS.GLOBAL_SETTINGS, settings); },

  getFullBackup: () => ({
      firms: getStorage(STORAGE_KEYS.FIRMS, []),
      transactions: getStorage(STORAGE_KEYS.TRANSACTIONS, []),
      preparation: getStorage(STORAGE_KEYS.PREPARATION, []),
      globalSettings: getStorage(STORAGE_KEYS.GLOBAL_SETTINGS, {}),
      expenseCategories: getStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, []),
      expenses: getStorage(STORAGE_KEYS.EXPENSES, []),
      backupDate: new Date().toISOString(),
      version: '2.2.0'
  }),

  restoreBackup: (data: any) => {
    try {
      if (data.firms) setStorage(STORAGE_KEYS.FIRMS, data.firms);
      if (data.transactions) setStorage(STORAGE_KEYS.TRANSACTIONS, data.transactions);
      if (data.preparation) setStorage(STORAGE_KEYS.PREPARATION, data.preparation);
      if (data.globalSettings) setStorage(STORAGE_KEYS.GLOBAL_SETTINGS, data.globalSettings);
      if (data.expenseCategories) setStorage(STORAGE_KEYS.EXPENSE_CATEGORIES, data.expenseCategories);
      if (data.expenses) setStorage(STORAGE_KEYS.EXPENSES, data.expenses);
      persistData(); 
      return true;
    } catch (e) { return false; }
  },

  getDbPath: () => dbFilePath,
  
  getLocalIpAddress: () => {
      return 'localhost';
  },

  bulkImportFirms: (data: any[]) => {
    const currentFirms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
    const currentTrans = getStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    let newFirmsCount = 0;
    let newTransCount = 0;

    data.forEach(row => {
      const name = row['Firma Adı'] || row['name'];
      if (!name) return;
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
        defaultInvoiceType: row['Fatura Tipi'] === 'E-Arşiv' ? InvoiceType.E_ARSIV : InvoiceType.E_FATURA,
        pricingModel: row['Fiyatlandırma Modeli'] || 'STANDART',
        tolerancePercentage: Number(row['Tolerans (%)']) || 0,
        isKdvExcluded: row['Fiyatlar KDV Hariç mi?'] === 'Evet'
      };
      currentFirms.push(newFirm);
      newFirmsCount++;
      const openingBalance = Number(row['Başlangıç Borcu']) || 0;
      if (openingBalance > 0) {
        currentTrans.push({
          id: generateId(), firmId: newId, date: new Date().toISOString(), type: TransactionType.INVOICE, description: 'Açılış Devir Bakiyesi', debt: openingBalance, credit: 0, month: new Date().getMonth() + 1, year: new Date().getFullYear(), status: 'APPROVED', invoiceType: newFirm.defaultInvoiceType
        });
        newTransCount++;
      }
    });
    setStorage(STORAGE_KEYS.FIRMS, currentFirms);
    setStorage(STORAGE_KEYS.TRANSACTIONS, currentTrans);
    return { newFirmsCount, newTransCount };
  },

  bulkUpdatePricing: (generalData: any[], tierData: any[]) => {
      const currentFirms = getStorage<Firm[]>(STORAGE_KEYS.FIRMS, []);
      let updatedCount = 0;

      generalData.forEach(row => {
          const id = row['ID (DOKUNMAYIN)'];
          if (!id) return;
          const firmIndex = currentFirms.findIndex(f => f.id === id);
          if (firmIndex !== -1) {
              currentFirms[firmIndex].baseFee = Number(row['Taban Ücret']) || 0;
              currentFirms[firmIndex].basePersonLimit = Number(row['Taban Kişi Limiti']) || 0;
              currentFirms[firmIndex].extraPersonFee = Number(row['Ekstra Kişi Ücreti']) || 0;
              currentFirms[firmIndex].yearlyFee = Number(row['Yıllık İşlem Ücreti']) || 0;
              currentFirms[firmIndex].pricingModel = row['Model (STANDART/KADEMELI)'] || currentFirms[firmIndex].pricingModel;
              currentFirms[firmIndex].tolerancePercentage = Number(row['Tolerans (%)']) || 0;
              currentFirms[firmIndex].tiers = [];
              updatedCount++;
          }
      });

      if (tierData && tierData.length > 0) {
          tierData.forEach(row => {
              const id = row['Firma ID (DOKUNMAYIN)'];
              if (!id) return;
              const firm = currentFirms.find(f => f.id === id);
              if (firm) {
                  const newTier: PricingTier = { min: Number(row['Min Kişi']) || 0, max: Number(row['Max Kişi']) || 0, price: Number(row['Fiyat']) || 0 };
                  if (!firm.tiers) firm.tiers = [];
                  firm.tiers.push(newTier);
              }
          });
      }
      setStorage(STORAGE_KEYS.FIRMS, currentFirms);
      return updatedCount;
  },
  
  factoryReset: () => {
      localStorage.clear();
      // Browser modunda sunucuya da temizlik isteği atılabilir ama şimdilik manuel sync yeterli
      notifyListeners();
  },

  clearAllTransactions: () => { setStorage(STORAGE_KEYS.TRANSACTIONS, []); },

  getCloudUrl: () => {
    return getStorage<string>(STORAGE_KEYS.CLOUD_CONFIG, '');
  },

  saveCloudUrl: (url: string) => {
    setStorage(STORAGE_KEYS.CLOUD_CONFIG, url);
  },

  // --- KULLANICI YÖNETİMİ METOTLARI ---
  getCurrentUser: (): { username: string; role: 'admin' | 'user' } => {
    return {
      username: localStorage.getItem('auth_username') || 'admin',
      role: (localStorage.getItem('auth_role') as 'admin' | 'user') || 'admin'
    };
  },

  getMe: async (): Promise<AppUser> => {
    const res = await fetchWithAuth('/api/me');
    return await res.json();
  },

  changeMyCredentials: async (creds: { currentPassword: string; newUsername?: string; newPassword?: string }) => {
    const res = await fetchWithAuth('/api/users/change-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bilgiler güncellenemedi.');
    if (data.token) localStorage.setItem('auth_token', data.token);
    if (data.username) localStorage.setItem('auth_username', data.username);
    if (data.role) localStorage.setItem('auth_role', data.role);
    window.dispatchEvent(new CustomEvent('auth_user_updated', { detail: { username: data.username, role: data.role } }));
    return data;
  },

  getUsers: async (): Promise<AppUser[]> => {
    const res = await fetchWithAuth('/api/users');
    return await res.json();
  },

  createUser: async (userData: { username: string; password: string; role: 'admin' | 'user'; twoFactorEnabled?: boolean }): Promise<any> => {
    const res = await fetchWithAuth('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kullanıcı eklenemedi.');
    return data;
  },

  updateUser: async (id: number | string, userData: { username?: string; password?: string; role?: 'admin' | 'user'; twoFactorEnabled?: boolean }): Promise<any> => {
    const res = await fetchWithAuth(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kullanıcı güncellenemedi.');
    return data;
  },

  deleteUser: async (id: number | string): Promise<any> => {
    const res = await fetchWithAuth(`/api/users/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kullanıcı silinemedi.');
    return data;
  },

  // --- 2FA (GOOGLE AUTHENTICATOR) METOTLARI ---
  setup2FA: async (): Promise<{ secret: string; otpauthUrl: string; username: string }> => {
    const res = await fetchWithAuth('/api/2fa/setup', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '2FA kurulumu başlatılamadı.');
    return data;
  },

  verifyAndEnable2FA: async (secret: string, code: string): Promise<any> => {
    const res = await fetchWithAuth('/api/2fa/verify-and-enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '2FA doğrulanamadı.');
    return data;
  },

  disable2FA: async (currentPassword: string): Promise<any> => {
    const res = await fetchWithAuth('/api/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '2FA devre dışı bırakılamadı.');
    return data;
  },

  resetUser2FA: async (userId: number | string): Promise<any> => {
    const res = await fetchWithAuth(`/api/users/${userId}/reset-2fa`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '2FA sıfırlanamadı.');
    return data;
  },

  loginWith2FA: async (tempToken: string, code: string): Promise<{ token: string; username: string; role: string }> => {
    const res = await fetch('/api/login/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Doğrulama başarısız.');
    return data;
  },

  // --- TELEGRAM BOT YÖNETİM METOTLARI ---
  getTelegramConfig: async (): Promise<TelegramConfig> => {
    const res = await fetchWithAuth('/api/telegram/config');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Telegram ayarları alınamadı.');
    return data;
  },

  saveTelegramConfig: async (config: { token?: string; isActive: boolean }): Promise<{ success: boolean; isActive: boolean; botUsername: string; message: string }> => {
    const res = await fetchWithAuth('/api/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Telegram ayarları kaydedilemedi.');
    return data;
  },

  testTelegramBot: async (token?: string): Promise<{ success: boolean; bot?: { id: number; username: string; first_name: string } }> => {
    const res = await fetchWithAuth('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bot testi başarısız.');
    return data;
  },

  addTelegramUser: async (telegramId: string, name: string): Promise<{ success: boolean; user: TelegramAllowedUser }> => {
    const res = await fetchWithAuth('/api/telegram/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Yetkili eklenemedi.');
    return data;
  },

  deleteTelegramUser: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    const res = await fetchWithAuth(`/api/telegram/users/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Yetkili silinemedi.');
    return data;
  }
};
