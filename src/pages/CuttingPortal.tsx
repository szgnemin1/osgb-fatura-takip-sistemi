import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle,
  Copy,
  Check,
  ClipboardCopy,
  CheckSquare,
  Square,
  XCircle,
  History,
  RotateCcw,
  KeyRound,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { InvoiceType, ServiceType } from '../types';

// --- YARDIMCI FONKSİYONLAR (Invoices.tsx İle Birebir Aynı) ---
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

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' ₺';
};

// --- GÜÇLENDİRİLMİŞ KOPYALAMA FONKSİYONU ---
const safeCopyToClipboard = async (text: string) => {
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

const InvoiceTypeBadge = ({ type }: { type?: string }) => {
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

interface TerminalInvoice {
  id: string;
  firmId: string;
  firmName: string;
  taxNumber: string;
  taxOffice: string;
  address: string;
  invoiceType: string;
  debt: number;
  credit?: number;
  date: string;
  description: string;
  month: number;
  year: number;
  status: 'PENDING' | 'APPROVED';
  calculatedDetails?: {
    expertShare?: number;
    doctorShare?: number;
    extraItemAmount?: number;
  };
  priorBalance?: number;
  firm?: {
    id: string;
    name: string;
    taxNumber?: string;
    tcNumber?: string;
    sgkNumber?: string;
    taxOffice?: string;
    address?: string;
    defaultInvoiceType?: string;
    expertPercentage?: number;
    doctorPercentage?: number;
    serviceType?: string;
  };
}

interface BatchTerminalResponse {
  success: boolean;
  operatorName: string;
  code: string;
  batchId: string;
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  globalSettings?: {
    vatRateExpert?: number;
    vatRateDoctor?: number;
    simpleDebtMode?: boolean;
    bankInfo?: string;
  };
  invoices: TerminalInvoice[];
}

// --- AKILLI KOPYALAMA BUTONU ---
const TerminalSmartCopyButton: React.FC<{
  inv: TerminalInvoice;
  globalSettings?: any;
}> = ({ inv, globalSettings }) => {
  const [copied, setCopied] = useState(false);
  const priorBalance = inv.priorBalance || 0;
  const totalDebt = priorBalance + inv.debt;

  if (globalSettings?.simpleDebtMode && priorBalance <= 0.1) {
    return null;
  }

  const handleSmartTextCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.focus();
    try {
      const dateStr = new Date().toLocaleDateString('tr-TR');
      const bankText = globalSettings?.bankInfo || '';
      const formattedTotal = totalDebt.toFixed(2) + ' TL';
      let finalStr = "";

      if (globalSettings?.simpleDebtMode) {
        finalStr = `${dateStr} Tarihi itibariyle Toplam Borç Bakiyeniz: ${formattedTotal}'dir. ${bankText}`;
      } else {
        const textAmount = numberToTurkishText(inv.debt);
        finalStr = textAmount;
        if (priorBalance > 0.1) {
          finalStr += ` "${dateStr} Tarihi itibariyle Borç Bakiyesi: ${formattedTotal}'dir. ${bankText}`;
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

// ==========================================
// ANA BİLEŞEN: CUTTING PORTAL (Invoices.tsx Birebir Tasarımı)
// ==========================================
export const CuttingPortal: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('kod') || '';

  const [code, setCode] = useState(initialCode);
  const [pinInput, setPinInput] = useState(initialCode);
  const [batchData, setBatchData] = useState<BatchTerminalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invoices.tsx İle Birebir State'ler
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [filterType, setFilterType] = useState<'ALL' | InvoiceType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Veri Çekme
  const fetchTerminalData = async (opCode: string) => {
    if (!opCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/batches/terminal/${opCode.trim()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Bu koda ait aktif bir kesim görevi bulunamadı.');
      }
      const data: BatchTerminalResponse = await res.json();
      setBatchData(data);
      setCode(opCode.trim());
    } catch (e: any) {
      setError(e.message || 'Bağlantı hatası oluştu');
      setBatchData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get('kod');
    if (q) {
      setPinInput(q);
      fetchTerminalData(q);
    }
  }, [searchParams]);

  // Socket.io Canlı Senkronizasyon
  useEffect(() => {
    const socket = io();
    const handleUpdate = () => {
      if (code) {
        fetchTerminalData(code);
      }
    };
    socket.on('batch_updated', handleUpdate);
    socket.on('transaction_approved', handleUpdate);
    socket.on('db_updated', handleUpdate);

    return () => {
      socket.off('batch_updated', handleUpdate);
      socket.off('transaction_approved', handleUpdate);
      socket.off('db_updated', handleUpdate);
      socket.disconnect();
    };
  }, [code]);

  // Giriş Yap
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;
    setSearchParams({ kod: pinInput.trim() });
    fetchTerminalData(pinInput.trim());
  };

  // Bekleyen ve Onaylanan Listeleri
  const allInvoices = useMemo(() => batchData?.invoices || [], [batchData?.invoices]);
  const pendingInvoices = useMemo(() => {
    return allInvoices
      .filter(inv => inv.status === 'PENDING')
      .sort((a, b) => a.firmName.localeCompare(b.firmName, 'tr'));
  }, [allInvoices]);

  const approvedInvoices = useMemo(() => {
    return allInvoices
      .filter(inv => inv.status === 'APPROVED')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allInvoices]);

  // Filtreleme (Invoices.tsx ile Birebir)
  const filteredPending = useMemo(() => {
    return pendingInvoices.filter(inv => {
      const matchesType = filterType === 'ALL' || inv.invoiceType === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.firmName.toLowerCase().includes(q) ||
        (inv.taxNumber && inv.taxNumber.includes(q)) ||
        (inv.description && inv.description.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [pendingInvoices, filterType, searchQuery]);

  const filteredApproved = useMemo(() => {
    return approvedInvoices.filter(inv => {
      const matchesType = filterType === 'ALL' || inv.invoiceType === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.firmName.toLowerCase().includes(q) ||
        (inv.taxNumber && inv.taxNumber.includes(q)) ||
        (inv.description && inv.description.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [approvedInvoices, filterType, searchQuery]);

  // KPI İstatistikleri (Invoices.tsx İle Birebir)
  const stats = useMemo(() => {
    let totalCount = 0;
    let totalAmount = 0;
    let eFaturaCount = 0;
    let eFaturaAmount = 0;
    let eArsivCount = 0;
    let eArsivAmount = 0;
    let healthCount = 0;
    let healthAmount = 0;

    pendingInvoices.forEach(inv => {
      totalCount++;
      totalAmount += inv.debt;
      if (inv.invoiceType === InvoiceType.E_FATURA) {
        eFaturaCount++;
        eFaturaAmount += inv.debt;
      } else {
        eArsivCount++;
        eArsivAmount += inv.debt;
      }
      const hVal = inv.calculatedDetails?.extraItemAmount || 0;
      if (hVal > 0) {
        healthCount++;
        healthAmount += hVal;
      }
    });

    return {
      totalCount,
      totalAmount,
      eFaturaCount,
      eFaturaAmount,
      eArsivCount,
      eArsivAmount,
      healthCount,
      healthAmount
    };
  }, [pendingInvoices]);

  // Seçim Yönetimi
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPending.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPending.map(inv => inv.id));
    }
  };

  const selectedTotal = useMemo(() => {
    return filteredPending
      .filter(inv => selectedIds.includes(inv.id))
      .reduce((sum, inv) => sum + inv.debt, 0);
  }, [filteredPending, selectedIds]);

  // Tekli Onay (Cariye İşleme)
  const handleApprove = async (id: string) => {
    if (!code) return;
    try {
      const res = await fetch('/api/batches/terminal/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, transactionId: id })
      });
      if (res.ok) {
        setSelectedIds(prev => prev.filter(item => item !== id));
        fetchTerminalData(code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toplu Onay
  const handleBulkApprove = async () => {
    if (!code || selectedIds.length === 0) return;
    if (!window.confirm(`Seçilen ${selectedIds.length} adet faturayı onaylayıp cariye işlemek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      const res = await fetch('/api/batches/terminal/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, transactionIds: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchTerminalData(code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Onayı Geri Al
  const handleUnapprove = async (id: string) => {
    if (!code) return;
    try {
      const res = await fetch('/api/batches/terminal/unapprove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, transactionId: id })
      });
      if (res.ok) {
        fetchTerminalData(code);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Global Ayarlar
  const globalSettings = batchData?.globalSettings || {
    vatRateExpert: 20,
    vatRateDoctor: 20,
    simpleDebtMode: false,
    bankInfo: ''
  };

  // --- EĞER KOD GİRİLMEDİYSE: 4 HANELİ GÜVENLİK GİRİŞ EKRANI ---
  if (!batchData) {
    return (
      <div className="h-full w-full bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 mb-3 shadow-inner">
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">Fatura Kesim Terminali</h2>
            <p className="text-xs text-slate-400 mt-1">
              Lütfen size iletilen 4 haneli güvenlik şifrenizi girin.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 text-center tracking-wider">
                4 HANELİ GÜVENLİK ŞİFRESİ
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] text-blue-300 placeholder-slate-700 outline-none focus:border-blue-500 transition-colors shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || pinInput.trim().length !== 4}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Kontrol Ediliyor...</span>
              ) : (
                <>
                  <span>Giriş Yap & Faturaları Getir</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-5">
            Güvenlik gereği şifreler 4 haneli olup yöneticiniz tarafından yenilenebilir.
          </p>
        </div>
      </div>
    );
  }

  // --- KOD GİRİLDİĞİNDE: Invoices.tsx İLE BİREBİR AYNI TASARIM ---
  const progressPercent = batchData.totalCount > 0
    ? Math.round((batchData.approvedCount / batchData.totalCount) * 100)
    : 0;

  return (
    <div className="h-full flex flex-col p-2 space-y-2 overflow-hidden bg-slate-950">
      {/* --- ÜST BAŞLIK VE KONTROLLER (Invoices.tsx Birebir) --- */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-xl shadow-lg">
          
          {/* Sol: Başlık ve İlerleme Rozeti */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">Kesilecek Faturalar</h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold border border-blue-500/30">
                  {stats.totalCount} Taslak
                </span>

                {/* Operatör Bilgi Rozeti */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-200 font-bold">{batchData.operatorName}</span>
                  <span className="text-blue-400 font-mono text-[11px] font-bold tracking-wider">(Şifre: {code})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchData(null);
                      setCode('');
                      setSearchParams({});
                    }}
                    className="text-slate-500 hover:text-slate-300 ml-1 text-[10px] underline"
                    title="Kodu Değiştir"
                  >
                    Değiştir
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sağ: Tab ve Filtre Seçicileri (Invoices.tsx İle Birebir) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Canlı İlerleme Çubuğu */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">İlerleme:</span>
              <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-bold text-emerald-400">
                {batchData.approvedCount}/{batchData.totalCount} (%{progressPercent})
              </span>
            </div>

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
                <span>Kestiklerim ({approvedInvoices.length})</span>
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
          </div>
        </div>

        {/* --- KPI ÖZET KARTLARI (Invoices.tsx Birebir) --- */}
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

      {/* --- ANA TABLO KARTI (Invoices.tsx Birebir) --- */}
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
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-all shadow-sm"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Onayla</span>
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
        </div>

        {/* ======================================================== */}
        {/* --- TAB 1: BEKLEYEN FATURALAR (DESKTOP TABLO) --- */}
        {/* ======================================================== */}
        {activeTab === 'PENDING' && (
          <>
            {/* Desktop Table View */}
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
                    const firm = inv.firm;
                    let expertVal = inv.calculatedDetails?.expertShare || 0;
                    let doctorVal = inv.calculatedDetails?.doctorShare || 0;
                    let healthVal = inv.calculatedDetails?.extraItemAmount || 0;

                    if (expertVal === 0 && doctorVal === 0 && firm) {
                      let eRate = firm.expertPercentage ?? 50;
                      let dRate = firm.doctorPercentage ?? 50;
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
                            <TerminalSmartCopyButton
                              inv={inv}
                              globalSettings={globalSettings}
                            />
                            <button
                              type="button"
                              onClick={() => handleApprove(inv.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm transition-all active:scale-95"
                              title="Bu Faturayı Kestim (Onayla)"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
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
                          <p className="text-xs font-medium">Size atanan bekleyen fatura bulunamadı veya tümünü kestiniz!</p>
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

            {/* Mobile Card View (Invoices.tsx Birebir) */}
            <div className="md:hidden flex-1 overflow-y-auto p-2 space-y-2 bg-slate-950/40">
              {filteredPending.map(inv => {
                const firm = inv.firm;
                let expertVal = inv.calculatedDetails?.expertShare || 0;
                let doctorVal = inv.calculatedDetails?.doctorShare || 0;
                let healthVal = inv.calculatedDetails?.extraItemAmount || 0;

                if (expertVal === 0 && doctorVal === 0 && firm) {
                  let eRate = firm.expertPercentage ?? 50;
                  let dRate = firm.doctorPercentage ?? 50;
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
                        className={`flex flex-col items-center p-1.5 rounded border ${
                          hasHealth
                            ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
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

                    {/* Footer Açıklama & İşlem */}
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 mt-1">
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {inv.description || inv.address || '-'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TerminalSmartCopyButton
                          inv={inv}
                          globalSettings={globalSettings}
                        />
                        <button
                          type="button"
                          onClick={() => handleApprove(inv.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Kestim (Onayla)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPending.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Bekleyen fatura bulunamadı.
                </div>
              )}
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* --- TAB 2: KESTİKLERİM / ONAYLANANLAR (HISTORY) --- */}
        {/* ======================================================== */}
        {activeTab === 'HISTORY' && (
          <div className="flex-1 overflow-auto bg-slate-950/30">
            <table className="w-full table-fixed text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 shadow-sm">
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-2 px-3">Firma Bilgisi & VKN</th>
                  <th className="py-2 px-2 text-right w-32">Kesilen Tutar</th>
                  <th className="py-2 px-2 text-center w-24">Tip</th>
                  <th className="py-2 px-2 text-center w-28">Durum</th>
                  <th className="py-2 px-3 text-right w-28">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredApproved.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100 text-xs truncate">{inv.firmName}</span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          {inv.taxNumber && <span className="font-mono">VKN: {inv.taxNumber}</span>}
                          {inv.description && <span className="text-slate-500 italic truncate max-w-[200px]">({inv.description})</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-bold font-mono text-emerald-400 text-xs">
                        {formatCurrency(inv.debt)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <InvoiceTypeBadge type={inv.invoiceType} />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        <span>Kesildi</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleUnapprove(inv.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition-colors"
                        title="Yanlışlıkla onayladıysanız bekleyenlere geri alın"
                      >
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>Geri Al</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredApproved.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                      Henüz bu oturumda onaylanan / kesilen fatura yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CuttingPortal;
