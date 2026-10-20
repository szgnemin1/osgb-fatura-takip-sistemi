import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { Transaction, TransactionType, InvoiceType, Firm, ServiceType, GlobalSettings } from '../types';
import {
  Receipt,
  CheckCircle,
  Trash2,
  History,
  Copy,
  ClipboardCopy,
  Filter,
  CheckSquare,
  Square,
  Check,
  Search,
  XCircle,
  Users
} from 'lucide-react';
import MultiUserCuttingModal from '../components/MultiUserCuttingModal';

// --- YARDIMCI FONKSİYONLAR ---
const numberToTurkishText = (amount: number): string => {
  if (amount === 0) return "SIFIR";
  const ones = ["", "BİR", "İKİ", "ÜÇ", "DÖRT", "BEŞ", "ALTI", "YEDİ", "SEKİZ", "DOKUZ"];
  const tens = ["", "ON", "YİRMİ", "OTUZ", "KIRK", "ELLİ", "ALTMIŞ", "YETMİŞ", "SEKSEN", "DOKSAN"];
  const groups = ["", "BİN", "MİLYON", "MİLYAR"];
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  const convertGroup = (num: number) => {
    if (num === 0) return "";
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;
    let res = "";
    if (h === 1) res += "YÜZ"; else if (h > 1) res += ones[h] + "YÜZ";
    res += tens[t] + ones[o];
    return res;
  };

  let str = "";
  let tempInt = integerPart;
  let groupIndex = 0;
  if (tempInt === 0) str = "SIFIR";
  while (tempInt > 0) {
    const part = tempInt % 1000;
    if (part > 0) {
      let partStr = convertGroup(part);
      if (groupIndex === 1 && part === 1) partStr = "";
      str = partStr + groups[groupIndex] + str;
    }
    tempInt = Math.floor(tempInt / 1000);
    groupIndex++;
  }
  let result = `YALNIZ${str}TÜRKLİRASI`;
  if (decimalPart > 0) result += convertGroup(decimalPart) + "KURUŞ";
  return result + "DIR.";
};

// --- GÜÇLENDİRİLMİŞ KOPYALAMA FONKSİYONU ---
const safeCopyToClipboard = async (text: string) => {
  if (typeof window !== 'undefined' && (window as any).process && (window as any).process.type === 'renderer') {
    try {
      const { clipboard } = (window as any).require('electron');
      clipboard.writeText(text);
      return Promise.resolve();
    } catch (e) {
      console.error("Electron clipboard hatası:", e);
    }
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (!successful) throw new Error('Fallback copy failed');
    }
  } catch (err) {
    console.error("Kopyalama hatası:", err);
  }
};

interface CopyBadgeProps {
  text?: string | number;
  label?: string;
  title?: string;
  className?: string;
  valueToCopy?: string | number;
}

const CopyBadge: React.FC<CopyBadgeProps> = ({ text, label, title, className = '', valueToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.focus();
    const content = valueToCopy !== undefined ? valueToCopy : text;
    let val = "";
    if (typeof content === 'number') {
      val = content.toFixed(2);
    } else {
      val = String(content || "");
    }
    if (!val) return;
    safeCopyToClipboard(val).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const hasLabel = label !== undefined && label !== "";

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Kopyalandı!" : (title || "Kopyala")}
      className={`inline-flex items-center justify-center gap-0.5 px-1 py-0.5 rounded transition-all duration-150 select-none text-[9px] font-medium leading-none ${
        copied
          ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
          : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-blue-500 hover:bg-slate-700/80'
      } ${className}`}
    >
      {copied ? <Check className="w-2.5 h-2.5 shrink-0" /> : <Copy className="w-2.5 h-2.5 shrink-0 opacity-70" />}
      {hasLabel && <span>{copied ? 'Ok' : label}</span>}
      {!hasLabel && copied && <span className="text-[8px] font-bold">Ok</span>}
    </button>
  );
};

const SmartCopyButton = ({
  inv,
  globalSettings,
  allTransactions,
  firms
}: {
  inv: Transaction;
  globalSettings: GlobalSettings;
  allTransactions: Transaction[];
  firms: Firm[];
}) => {
  const [copied, setCopied] = useState(false);

  const targetIds = [inv.firmId];
  const branches = firms.filter(f => f.parentFirmId === inv.firmId);
  branches.forEach(b => targetIds.push(b.id));

  const firmTrans = allTransactions.filter(t => targetIds.includes(t.firmId) && (t.status === 'APPROVED' || !t.status));
  const totalDebited = firmTrans.reduce((sum, t) => sum + t.debt, 0);
  const totalPaid = firmTrans.reduce((sum, t) => sum + t.credit, 0);
  const priorBalance = totalDebited - totalPaid;
  const totalDebt = priorBalance + inv.debt;

  if (globalSettings.simpleDebtMode && priorBalance <= 0.1) {
    return null;
  }

  const handleSmartTextCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.focus();
    try {
      const dateStr = new Date().toLocaleDateString('tr-TR');
      const bankText = globalSettings.bankInfo || '';
      const formattedTotal = totalDebt.toFixed(2) + ' TL';
      let finalStr = "";

      if (globalSettings.simpleDebtMode) {
        finalStr = `${dateStr} Tarihi itibariyle Toplam Borç Bakiyeniz: ${formattedTotal}'dir. ${bankText}`;
      } else {
        const textAmount = numberToTurkishText(inv.debt);
        finalStr = textAmount;
        if (priorBalance > 0.1) {
          const branchNote = branches.length > 0 ? ` (Şubeler Dahil)` : '';
          finalStr += ` "${dateStr} Tarihi itibariyle${branchNote} Borç Bakiyesi: ${formattedTotal}'dir. ${bankText}`;
        }
      }

      safeCopyToClipboard(finalStr).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSmartTextCopy}
      className={`p-1 rounded transition-all duration-150 border flex items-center justify-center text-xs font-semibold ${
        copied
          ? 'bg-emerald-600 text-white border-emerald-500 ring-1 ring-emerald-400'
          : 'bg-blue-600/90 text-white border-blue-500/60 hover:bg-blue-600 shadow-sm'
      }`}
      title={copied ? "Metin Kopyalandı!" : "Bakiyeyi ve Fatura Metnini Kopyala"}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
    </button>
  );
};

const InvoiceTypeBadge = ({ type }: { type?: InvoiceType }) => {
  if (type === InvoiceType.E_FATURA) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 whitespace-nowrap">
        E-FAT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
      E-ARŞ
    </span>
  );
};

type InvoiceWithDetails = Transaction & {
  firmName: string;
  taxNumber?: string;
  address?: string;
};

const Invoices: React.FC = () => {
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceWithDetails[]>([]);
  const [approvedInvoices, setApprovedInvoices] = useState<InvoiceWithDetails[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [globalSettings, setGlobalSettings] = useState(db.getGlobalSettings());
  const [filterType, setFilterType] = useState<'ALL' | InvoiceType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Çoklu Kesim & İş Paylaşımı State'leri
  const [isMultiUserModalOpen, setIsMultiUserModalOpen] = useState(false);
  const [activeBatchInfo, setActiveBatchInfo] = useState<any>(null);

  const checkActiveBatch = async () => {
    try {
      const res = await fetch('/api/batches/active');
      if (res.ok) {
        const json = await res.json();
        setActiveBatchInfo(json);
      }
    } catch (_) {}
  };

  const loadData = () => {
    setGlobalSettings(db.getGlobalSettings());
    const allTrans = db.getTransactions();
    setAllTransactions(allTrans);
    const allFirms = db.getFirms();
    setFirms(allFirms);
    const firmMap = new Map<string, Firm>();
    allFirms.forEach(f => firmMap.set(f.id, f));

    const allInvoices = allTrans
      .filter(t => t.type === TransactionType.INVOICE)
      .map(t => {
        const firm = firmMap.get(t.firmId);
        return {
          ...t,
          firmName: firm?.name || 'Bilinmeyen Firma',
          taxNumber: firm?.taxNumber || '',
          address: firm?.address || ''
        };
      });

    setPendingInvoices(
      allInvoices
        .filter(t => t.status === 'PENDING')
        .sort((a, b) => a.firmName.localeCompare(b.firmName, 'tr'))
    );
    setApprovedInvoices(
      allInvoices
        .filter(t => t.status === 'APPROVED')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    setSelectedIds([]);
  };

  useEffect(() => {
    loadData();
    checkActiveBatch();
    const unsubscribe = db.subscribe(() => {
      loadData();
      checkActiveBatch();
    });
    return () => unsubscribe();
  }, []);

  // Filtrelenmiş Bekleyen Faturalar
  const filteredPending = useMemo(() => {
    return pendingInvoices.filter(inv => {
      if (filterType !== 'ALL' && inv.invoiceType !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = inv.firmName?.toLowerCase().includes(q);
        const matchTax = inv.taxNumber?.toLowerCase().includes(q);
        const matchDesc = inv.description?.toLowerCase().includes(q);
        if (!matchName && !matchTax && !matchDesc) return false;
      }
      return true;
    });
  }, [pendingInvoices, filterType, searchQuery]);

  // Filtrelenmiş Geçmiş Faturalar
  const filteredApproved = useMemo(() => {
    return approvedInvoices.filter(inv => {
      if (filterType !== 'ALL' && inv.invoiceType !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = inv.firmName?.toLowerCase().includes(q);
        const matchTax = inv.taxNumber?.toLowerCase().includes(q);
        if (!matchName && !matchTax) return false;
      }
      const invTime = new Date(inv.date).getTime();
      const startTime = historyStartDate ? new Date(historyStartDate).setHours(0, 0, 0, 0) : 0;
      const endTime = historyEndDate ? new Date(historyEndDate).setHours(23, 59, 59, 999) : Infinity;
      return invTime >= startTime && invTime <= endTime;
    });
  }, [approvedInvoices, filterType, searchQuery, historyStartDate, historyEndDate]);

  // İstatistiksel Özet Hesaplamaları (Tüm Bekleyenler üzerinden)
  const stats = useMemo(() => {
    const totalPendingCount = pendingInvoices.length;
    const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.debt, 0);

    const eFaturaList = pendingInvoices.filter(inv => inv.invoiceType === InvoiceType.E_FATURA);
    const eArsivList = pendingInvoices.filter(inv => inv.invoiceType !== InvoiceType.E_FATURA);

    const healthList = pendingInvoices.filter(inv => (inv.calculatedDetails?.extraItemAmount || 0) > 0);
    const healthTotal = healthList.reduce((sum, inv) => sum + (inv.calculatedDetails?.extraItemAmount || 0), 0);

    return {
      totalCount: totalPendingCount,
      totalAmount: totalPendingAmount,
      eFaturaCount: eFaturaList.length,
      eFaturaAmount: eFaturaList.reduce((sum, inv) => sum + inv.debt, 0),
      eArsivCount: eArsivList.length,
      eArsivAmount: eArsivList.reduce((sum, inv) => sum + inv.debt, 0),
      healthCount: healthList.length,
      healthAmount: healthTotal
    };
  }, [pendingInvoices]);

  // Seçili Faturaların Toplamı
  const selectedTotal = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return pendingInvoices
      .filter(inv => selectedSet.has(inv.id))
      .reduce((sum, inv) => sum + inv.debt, 0);
  }, [selectedIds, pendingInvoices]);

  // Tekil ve Toplu İşlemler
  const handleApprove = async (id: string, firmName: string) => {
    window.focus();
    if (window.confirm(`"${firmName}" faturasını onaylamak istediğinize emin misiniz?`)) {
      await db.updateTransactionStatus(id, 'APPROVED');
    }
  };

  const handleDeleteSingle = (id: string, firmName: string) => {
    window.focus();
    if (window.confirm(`"${firmName}" faturası taslaklardan silinecek. Emin misiniz?`)) {
      db.deleteTransaction(id);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPending.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPending.map(inv => inv.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(s => s !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    window.focus();
    if (selectedIds.length === 0) return;
    if (window.confirm(`Seçilen ${selectedIds.length} adet faturayı silmek istediğinize emin misiniz?`)) {
      db.deleteTransactionsBulk(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleBulkApprove = async () => {
    window.focus();
    if (selectedIds.length === 0) return;
    if (window.confirm(`Seçilen ${selectedIds.length} adet faturayı ONAYLAMAK istediğinize emin misiniz?`)) {
      await db.updateTransactionsStatusBulk(selectedIds, 'APPROVED');
      setSelectedIds([]);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] space-y-2 animate-in fade-in duration-200">

      {/* --- HEADER BAR (KOMPAKT) --- */}
      <div className="shrink-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-xl shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">Kesilecek Faturalar</h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold border border-blue-500/30">
                  {stats.totalCount} Taslak
                </span>
              </div>
            </div>
          </div>

          {/* Tab & Filter Switches */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Tab Switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('PENDING')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'PENDING'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3 h-3" />
                <span>Bekleyenler ({pendingInvoices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'HISTORY'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3 h-3" />
                <span>Geçmiş Arşiv ({approvedInvoices.length})</span>
              </button>
            </div>

            {/* Fatura Tipi Filtresi */}
            <div className="relative">
              <Filter className="absolute left-2 top-2 w-3 h-3 text-slate-500 pointer-events-none" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-6 pr-2.5 py-1 outline-none cursor-pointer hover:border-blue-500 transition-colors"
              >
                <option value="ALL">Tümü</option>
                <option value={InvoiceType.E_FATURA}>E-Fatura</option>
                <option value={InvoiceType.E_ARSIV}>E-Arşiv</option>
              </select>
            </div>

            {/* Çoklu Kesim (İş Paylaşımı) Butonu */}
            <button
              type="button"
              onClick={() => setIsMultiUserModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Çoklu Kesim</span>
              {activeBatchInfo?.active && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* AKTİF İŞ PAYLAŞIMI CANLI BİLDİRİM BANDI */}
        {activeBatchInfo?.active && (
          <div className="bg-gradient-to-r from-blue-950/70 to-indigo-950/60 border border-blue-500/30 px-3 py-2 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2 text-xs text-blue-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>
                <b>Çoklu Kesim Devam Ediyor:</b> {activeBatchInfo.operators?.length} operatör aktif çalışıyor.
              </span>
              <span className="text-slate-400 font-mono text-[11px] hidden md:inline">
                (Sabit: {window.location.origin}/#/kesim)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMultiUserModalOpen(true)}
              className="text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white px-2.5 py-1 rounded-lg border border-blue-500/40 font-semibold transition-colors shrink-0"
            >
              İlerlemeyi Gör & Paylaş
            </button>
          </div>
        )}

        {/* --- KPI ÖZET KARTLARI (KOMPAKT VE YER KAPLAMAYAN) --- */}
        {activeTab === 'PENDING' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm">
              <span className="text-[11px] text-slate-400">Toplam Bekleyen ({stats.totalCount})</span>
              <span className="text-xs font-bold font-mono text-slate-100">{formatCurrency(stats.totalAmount)}</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm">
              <span className="text-[11px] text-indigo-400">E-Fatura ({stats.eFaturaCount})</span>
              <span className="text-xs font-bold font-mono text-indigo-300">{formatCurrency(stats.eFaturaAmount)}</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm">
              <span className="text-[11px] text-amber-400">E-Arşiv ({stats.eArsivCount})</span>
              <span className="text-xs font-bold font-mono text-amber-300">{formatCurrency(stats.eArsivAmount)}</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm">
              <span className="text-[11px] text-emerald-400">Sağlık ({stats.healthCount})</span>
              <span className="text-xs font-bold font-mono text-emerald-300">{formatCurrency(stats.healthAmount)}</span>
            </div>
          </div>
        )}
      </div>

      {/* --- ANA TABLO KARTI --- */}
      <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col min-h-0">

        {/* --- ARAMA & TOPLU İŞLEM ARAÇ ÇUBUĞU --- */}
        <div className="px-2.5 py-1.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          
          {/* Canlı Arama */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Firma Adı, VKN veya Açıklama ara..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-6 py-1 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
                title="Temizle"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Çoklu Seçim Aksiyonları */}
          {activeTab === 'PENDING' && (
            <div className="flex items-center gap-1.5">
              {selectedIds.length > 0 ? (
                <div className="flex items-center gap-1.5 bg-blue-950/50 border border-blue-500/30 px-2 py-0.5 rounded-lg">
                  <span className="text-xs font-semibold text-blue-300">
                    {selectedIds.length} Seçildi <span className="text-slate-400 font-normal font-mono">({formatCurrency(selectedTotal)})</span>
                  </span>
                  <div className="h-3.5 w-px bg-blue-500/30 mx-0.5" />
                  <button
                    type="button"
                    onClick={handleBulkApprove}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-all"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Onayla</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="text-xs bg-rose-600/90 hover:bg-rose-600 text-white px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold transition-all"
                    title="Seçilenleri Sil"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Sil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-[11px] text-slate-400 hover:text-slate-200 px-1"
                  >
                    Temizle
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {filteredPending.length} fatura
                </span>
              )}

              {/* Mobilde Tümünü Seç Butonu */}
              <button
                type="button"
                onClick={toggleSelectAll}
                className="md:hidden text-xs text-slate-400 border border-slate-700 bg-slate-900 px-2 py-1 rounded-lg"
              >
                {selectedIds.length === filteredPending.length && filteredPending.length > 0 ? "Kaldır" : "Tümünü Seç"}
              </button>
            </div>
          )}

          {/* Geçmiş Tarih Filtresi */}
          {activeTab === 'HISTORY' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-500"
              />
              <span className="text-slate-600">-</span>
              <input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-500"
              />
              {(historyStartDate || historyEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryStartDate('');
                    setHistoryEndDate('');
                  }}
                  className="text-slate-400 hover:text-white p-1"
                  title="Tarihleri Temizle"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* --- TAB 1: BEKLEYEN FATURALAR (DESKTOP TABLO) --- */}
        {/* ======================================================== */}
        {activeTab === 'PENDING' && (
          <>
            {/* Desktop Table View (Tam Ekrana Sığan Kompakt Tasarım) */}
            <div className="hidden md:block flex-1 overflow-auto bg-slate-950/30">
              <table className="w-full table-fixed text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 shadow-sm">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-2 px-1 w-8 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="hover:text-white transition-colors"
                        title={selectedIds.length === filteredPending.length && filteredPending.length > 0 ? "Kaldır" : "Tümünü Seç"}
                      >
                        {selectedIds.length === filteredPending.length && filteredPending.length > 0 ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </th>
                    <th className="py-2 px-2">Firma Bilgisi & Detay</th>
                    <th className="py-2 px-1 text-center w-24">
                      <div className="flex items-center justify-center gap-1 text-blue-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Uzman</span>
                      </div>
                    </th>
                    <th className="py-2 px-1 text-center w-24">
                      <div className="flex items-center justify-center gap-1 text-purple-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>Hekim</span>
                      </div>
                    </th>
                    <th className="py-2 px-1 text-center w-24">
                      <div className="flex items-center justify-center gap-1 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Sağlık</span>
                      </div>
                    </th>
                    <th className="py-2 px-2 text-right w-28">Toplam</th>
                    <th className="py-2 px-1 text-center w-16">Tip</th>
                    <th className="py-2 px-2 text-right w-24">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPending.map(inv => {
                    const firm = firms.find(f => f.id === inv.firmId);
                    let expertVal = inv.calculatedDetails?.expertShare || 0;
                    let doctorVal = inv.calculatedDetails?.doctorShare || 0;
                    let healthVal = inv.calculatedDetails?.extraItemAmount || 0;

                    if (expertVal === 0 && doctorVal === 0 && firm) {
                      let eRate = firm.expertPercentage;
                      let dRate = firm.doctorPercentage;

                      if (firm.serviceType === ServiceType.EXPERT_ONLY) {
                        dRate = 0;
                        eRate = 100;
                      }
                      if (firm.serviceType === ServiceType.DOCTOR_ONLY) {
                        eRate = 0;
                        dRate = 100;
                      }

                      const vatExpert = globalSettings?.vatRateExpert ?? 20;
                      const vatDoctor = globalSettings?.vatRateDoctor ?? 20;

                      if (firm.serviceType === ServiceType.EXPERT_ONLY) {
                        expertVal = inv.debt / (1 + vatExpert / 100);
                      } else if (firm.serviceType === ServiceType.DOCTOR_ONLY) {
                        doctorVal = inv.debt / (1 + vatDoctor / 100);
                      } else {
                        const grossExpert = inv.debt * (eRate / 100);
                        const grossDoctor = inv.debt * (dRate / 100);
                        expertVal = grossExpert / (1 + vatExpert / 100);
                        doctorVal = grossDoctor / (1 + vatDoctor / 100);
                      }
                    }

                    const hasHealth = healthVal > 0;
                    const isSelected = selectedIds.includes(inv.id);

                    return (
                      <tr
                        key={inv.id}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-blue-950/25 border-l-2 border-l-blue-500'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-1.5 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelect(inv.id)}
                            className="text-slate-500 hover:text-blue-400"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>

                        {/* Firma Bilgisi & İlgili Rozetler */}
                        <td className="py-1.5 px-2 overflow-hidden">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className="font-semibold text-slate-100 text-xs truncate select-text cursor-text"
                              title={inv.firmName}
                            >
                              {inv.firmName}
                            </span>

                            {/* VKN, Adres ve Açıklama Satırı */}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 overflow-hidden">
                              {inv.taxNumber && (
                                <div className="inline-flex items-center gap-0.5 bg-slate-900 border border-slate-800 px-1 py-0.2 rounded shrink-0">
                                  <span className="text-slate-500 font-mono text-[9px]">VKN:</span>
                                  <span className="font-mono text-slate-300 select-text cursor-text">{inv.taxNumber}</span>
                                  <CopyBadge text={inv.taxNumber} label="" title="VKN Kopyala" className="border-0 bg-transparent p-0" />
                                </div>
                              )}

                              {inv.address && (
                                <div className="inline-flex items-center gap-0.5 bg-slate-900 border border-slate-800 px-1 py-0.2 rounded truncate max-w-[150px]">
                                  <span className="truncate select-text cursor-text" title={inv.address}>
                                    {inv.address}
                                  </span>
                                  <CopyBadge text={inv.address} label="" title="Adresi Kopyala" className="border-0 bg-transparent p-0 shrink-0" />
                                </div>
                              )}

                              {inv.description && (
                                <span className="text-[10px] text-slate-500 italic truncate max-w-[140px] select-text cursor-text" title={inv.description}>
                                  {inv.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* UZMAN HİZMETİ */}
                        <td className="py-1.5 px-1 text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5 bg-slate-900/60 border border-slate-800/80 px-1 py-0.5 rounded">
                            <span className="font-mono text-[11px] font-semibold text-slate-200 select-text cursor-text">
                              {formatCurrency(expertVal)}
                            </span>
                            <div className="flex items-center gap-1">
                              <CopyBadge text={expertVal} label="" title="Uzman Tutarını (Sayı) Kopyala" />
                              <CopyBadge
                                valueToCopy="İŞ GÜVENLİĞİ UZMANI HİZMET BEDELİ"
                                label="M"
                                title="İş Güvenliği Uzmanı Metnini Kopyala"
                                className="bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                              />
                            </div>
                          </div>
                        </td>

                        {/* HEKİM HİZMETİ */}
                        <td className="py-1.5 px-1 text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5 bg-slate-900/60 border border-slate-800/80 px-1 py-0.5 rounded">
                            <span className="font-mono text-[11px] font-semibold text-slate-200 select-text cursor-text">
                              {formatCurrency(doctorVal)}
                            </span>
                            <div className="flex items-center gap-1">
                              <CopyBadge text={doctorVal} label="" title="Hekim Tutarını (Sayı) Kopyala" />
                              <CopyBadge
                                valueToCopy="İŞYERİ HEKİMLİĞİ HİZMET BEDELİ"
                                label="M"
                                title="İşyeri Hekimliği Metnini Kopyala"
                                className="bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
                              />
                            </div>
                          </div>
                        </td>

                        {/* SAĞLIK HİZMETİ */}
                        <td className="py-1.5 px-1 text-center">
                          <div
                            className={`flex flex-col items-center justify-center gap-0.5 px-1 py-0.5 rounded border transition-all ${
                              hasHealth
                                ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                                : 'bg-slate-900/60 border-slate-800/80'
                            }`}
                          >
                            <span
                              className={`font-mono text-[11px] font-semibold select-text cursor-text ${
                                hasHealth ? 'text-emerald-300 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {formatCurrency(healthVal)}
                            </span>
                            <div className="flex items-center gap-1">
                              <CopyBadge text={healthVal} label="" title="Sağlık Tutarını (Sayı) Kopyala" />
                              <CopyBadge
                                valueToCopy="SAĞLIK HİZMETİ"
                                label="M"
                                title="Sağlık Hizmeti Metnini Kopyala"
                                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                              />
                            </div>
                          </div>
                        </td>

                        {/* TOPLAM TUTAR */}
                        <td className="py-1.5 px-2 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-bold text-slate-100 text-xs font-mono tracking-tight select-text cursor-text">
                              {formatCurrency(inv.debt)}
                            </span>
                            <div className="flex items-center gap-1">
                              <CopyBadge text={inv.debt} label="" title="Toplam Tutarı (Sayı) Kopyala" />
                              <CopyBadge
                                valueToCopy={numberToTurkishText(inv.debt)}
                                label="Yazı"
                                title="Yazıyla Tutarı Kopyala"
                                className="bg-slate-800 text-slate-300 hover:text-white border-slate-700"
                              />
                            </div>
                          </div>
                        </td>

                        {/* FATURA TİPİ */}
                        <td className="py-1.5 px-1 text-center">
                          <InvoiceTypeBadge type={inv.invoiceType} />
                        </td>

                        {/* İŞLEMLER */}
                        <td className="py-1.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <SmartCopyButton
                              inv={inv}
                              globalSettings={globalSettings}
                              allTransactions={allTransactions}
                              firms={firms}
                            />
                            <button
                              type="button"
                              onClick={() => handleApprove(inv.id, inv.firmName)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm transition-all active:scale-95"
                              title="Bu Faturayı Onayla"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(inv.id, inv.firmName)}
                              className="p-1 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded border border-slate-700 transition-all active:scale-95"
                              title="Bu Faturayı Taslaklardan Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPending.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Receipt className="w-6 h-6 text-slate-600" />
                          <p className="text-xs font-medium">Onay bekleyen kayıt bulunamadı.</p>
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="text-[11px] text-blue-400 hover:underline"
                            >
                              Aramayı temizle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex-1 overflow-y-auto p-2 space-y-2 bg-slate-950/40">
              {filteredPending.map(inv => {
                const firm = firms.find(f => f.id === inv.firmId);
                let expertVal = inv.calculatedDetails?.expertShare || 0;
                let doctorVal = inv.calculatedDetails?.doctorShare || 0;
                let healthVal = inv.calculatedDetails?.extraItemAmount || 0;

                if (expertVal === 0 && doctorVal === 0 && firm) {
                  let eRate = firm.expertPercentage;
                  let dRate = firm.doctorPercentage;
                  const vatExpert = globalSettings?.vatRateExpert ?? 20;
                  const vatDoctor = globalSettings?.vatRateDoctor ?? 20;

                  if (firm.serviceType === ServiceType.EXPERT_ONLY) {
                    expertVal = inv.debt / (1 + vatExpert / 100);
                  } else if (firm.serviceType === ServiceType.DOCTOR_ONLY) {
                    doctorVal = inv.debt / (1 + vatDoctor / 100);
                  } else {
                    const grossExpert = inv.debt * (eRate / 100);
                    const grossDoctor = inv.debt * (dRate / 100);
                    expertVal = grossExpert / (1 + vatExpert / 100);
                    doctorVal = grossDoctor / (1 + vatDoctor / 100);
                  }
                }
                const hasHealth = healthVal > 0;
                const isSelected = selectedIds.includes(inv.id);

                return (
                  <div
                    key={inv.id}
                    className={`bg-slate-900 rounded-lg p-2.5 border transition-all ${
                      isSelected
                        ? 'border-blue-500 shadow-md shadow-blue-500/10'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-1.5 mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelect(inv.id)}
                          className="text-slate-400 mt-0.5"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-100 text-xs truncate select-text">
                            {inv.firmName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <InvoiceTypeBadge type={inv.invoiceType} />
                            {inv.taxNumber && (
                              <div className="inline-flex items-center gap-0.5 text-[9px] bg-slate-950 border border-slate-800 px-1 py-0.2 rounded text-slate-400 font-mono">
                                <span>VKN: {inv.taxNumber}</span>
                                <CopyBadge text={inv.taxNumber} label="" title="VKN Kopyala" className="border-0 bg-transparent p-0" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-100 font-mono">
                          {formatCurrency(inv.debt)}
                        </div>
                        <div className="flex justify-end gap-1 mt-0.5">
                          <CopyBadge text={inv.debt} label="" />
                          <CopyBadge
                            valueToCopy={numberToTurkishText(inv.debt)}
                            label="Yazı"
                            className="text-[8px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detay Grid: Uzman, Hekim, Sağlık */}
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <div className="flex flex-col items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9px] text-blue-400 font-medium">UZMAN</span>
                        <span className="text-[11px] font-semibold text-slate-200 font-mono my-0.5">
                          {formatCurrency(expertVal)}
                        </span>
                        <div className="flex gap-1">
                          <CopyBadge text={expertVal} label="" className="scale-90" />
                          <CopyBadge
                            valueToCopy="İŞ GÜVENLİĞİ UZMANI HİZMET BEDELİ"
                            label="M"
                            className="scale-90 bg-blue-500/10 text-blue-400 border-blue-500/30"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-[9px] text-purple-400 font-medium">HEKİM</span>
                        <span className="text-[11px] font-semibold text-slate-200 font-mono my-0.5">
                          {formatCurrency(doctorVal)}
                        </span>
                        <div className="flex gap-1">
                          <CopyBadge text={doctorVal} label="" className="scale-90" />
                          <CopyBadge
                            valueToCopy="İŞYERİ HEKİMLİĞİ HİZMET BEDELİ"
                            label="M"
                            className="scale-90 bg-purple-500/10 text-purple-400 border-purple-500/30"
                          />
                        </div>
                      </div>

                      <div
                        className={`flex flex-col items-center p-1.5 rounded border transition-all ${
                          hasHealth
                            ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <span className="text-[9px] text-emerald-400 font-medium">SAĞLIK</span>
                        <span
                          className={`text-[11px] font-semibold font-mono my-0.5 ${
                            hasHealth ? 'text-emerald-300 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(healthVal)}
                        </span>
                        <div className="flex gap-1">
                          <CopyBadge text={healthVal} label="" className="scale-90" />
                          <CopyBadge
                            valueToCopy="SAĞLIK HİZMETİ"
                            label="M"
                            className="scale-90 bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800">
                      <div className="shrink-0">
                        <SmartCopyButton
                          inv={inv}
                          globalSettings={globalSettings}
                          allTransactions={allTransactions}
                          firms={firms}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApprove(inv.id, inv.firmName)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>ONAYLA</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSingle(inv.id, inv.firmName)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded border border-slate-700"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredPending.length === 0 && (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Onay bekleyen kayıt yok.
                </div>
              )}
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* --- TAB 2: GEÇMİŞ FATURALAR (ARŞİV TABLOSU) --- */}
        {/* ======================================================== */}
        {activeTab === 'HISTORY' && (
          <div className="flex-1 overflow-auto bg-slate-950/30">
            <table className="w-full table-fixed text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 shadow-sm">
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-2 px-2">Firma Bilgisi</th>
                  <th className="py-2 px-2 w-24 text-center">Tarih</th>
                  <th className="py-2 px-2 w-20 text-center">Tip</th>
                  <th className="py-2 px-2 text-right w-28">Tutar</th>
                  <th className="py-2 px-2 text-center w-20">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredApproved.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-1.5 px-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-200 text-xs truncate">{inv.firmName}</span>
                        {inv.taxNumber && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <span>VKN: {inv.taxNumber}</span>
                            <CopyBadge text={inv.taxNumber} label="" className="scale-75" />
                          </div>
                        )}
                        {inv.description && (
                          <span className="text-[10px] text-slate-500 italic truncate max-w-[200px]">{inv.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                      {new Date(inv.date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <InvoiceTypeBadge type={inv.invoiceType} />
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-bold text-slate-200 text-xs font-mono">
                          {formatCurrency(inv.debt)}
                        </span>
                        <CopyBadge text={inv.debt} label="" />
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Onaylandı
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredApproved.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                      Geçmiş arşive ait kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ÇOKLU KESİM & İŞ PAYLAŞIMI MODALI */}
      <MultiUserCuttingModal
        isOpen={isMultiUserModalOpen}
        onClose={() => {
          setIsMultiUserModalOpen(false);
          checkActiveBatch();
        }}
        pendingInvoicesCount={pendingInvoices.length}
      />

    </div>
  );
};

export default Invoices;
