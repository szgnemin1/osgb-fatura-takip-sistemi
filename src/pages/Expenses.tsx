import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { ExpenseCategory, Expense, Transaction } from '../types';
import { 
  Wallet, Plus, Trash2, PieChart as PieIcon, List, 
  CalendarDays, TrendingUp, 
  ChevronLeft, ChevronRight, X, Tag, Search,
  Calendar, BarChart3,
  Sparkles, Check,
  TrendingDown, Scale
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

const DEFAULT_OSGB_CATEGORIES = [
  'Personel & Maaş Ödemeleri',
  'İşyeri Kirası & Stopaj',
  'Araç Yakıtı & Ulaşım Masrafları',
  'Tıbbi Malzeme & Tetkik Ekipmanları',
  'Kırtasiye & Ofis Giderleri',
  'Yemek & Mutfak Masrafları',
  'Muhasebe & Mali Müşavirlik',
  'Yazılım, Sunucu & IT Hizmetleri',
  'Elektrik, Su & Doğalgaz',
  'Diğer Çeşitli Masraflar'
];

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const MONTH_SHORT_NAMES = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

const Expenses: React.FC = () => {
  // --- VERİ STATE ---
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); 
  
  // --- GÖRÜNÜM STATE ---
  const [activeTab, setActiveTab] = useState<'MATRIX' | 'ENTRY' | 'REPORT'>('MATRIX');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // --- MODAL STATE ---
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // --- FORM STATE ---
  const [newCatName, setNewCatName] = useState('');
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // --- FİLTRE VE ARAMA STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState<number>(0); // 0: Tümü

  // Veri Yükleme
  const loadData = () => {
    setCategories(db.getExpenseCategories());
    setExpenses(db.getExpenses());
    setTransactions(db.getTransactions());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = db.subscribe(() => loadData());
    return () => unsubscribe();
  }, []);

  // --- İŞLEMLER ---
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    db.addExpenseCategory(newCatName.trim());
    setNewCatName('');
  };

  const handleDeleteCategory = (id: string, name: string) => {
    const relatedCount = expenses.filter(e => e.categoryId === id).length;
    const confirmMsg = relatedCount > 0 
      ? `"${name}" kategorisi ve buna bağlı ${relatedCount} adet gider kaydı silinecektir. Emin misiniz?`
      : `"${name}" kategorisini silmek istediğinize emin misiniz?`;
    
    if (window.confirm(confirmMsg)) {
      db.deleteExpenseCategory(id);
    }
  };

  const handleAddDefaultCategories = () => {
    const existingNames = new Set(categories.map(c => c.name.toLowerCase()));
    let addedCount = 0;
    DEFAULT_OSGB_CATEGORIES.forEach(catName => {
      if (!existingNames.has(catName.toLowerCase())) {
        db.addExpenseCategory(catName);
        addedCount++;
      }
    });
    if (addedCount > 0) {
      loadData();
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.categoryId || !expenseForm.amount) return;

    const dateObj = new Date(expenseForm.date);
    const amountVal = parseFloat(expenseForm.amount.replace(',', '.'));
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Lütfen geçerli bir tutar girin.');
      return;
    }

    db.addExpense({
      categoryId: expenseForm.categoryId,
      amount: amountVal,
      date: expenseForm.date,
      description: expenseForm.description.trim(),
      month: dateObj.getMonth() + 1,
      year: dateObj.getFullYear()
    });

    setExpenseForm(prev => ({
      ...prev,
      amount: '',
      description: ''
    }));

    if (isAddExpenseModalOpen) {
      setIsAddExpenseModalOpen(false);
    }
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) {
      db.deleteExpense(id);
    }
  };

  // --- HESAPLAMALAR VE METRİKLER ---
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Seçili yıla ait giderler
  const expensesInSelectedYear = useMemo(() => {
    return expenses.filter(e => e.year === selectedYear);
  }, [expenses, selectedYear]);

  // Yıllık Matris Verisi
  const matrixData = useMemo(() => {
    return categories.map((cat, index) => {
      const months = Array(12).fill(0);
      let total = 0;
      expensesInSelectedYear.filter(e => e.categoryId === cat.id).forEach(e => {
        if (e.month >= 1 && e.month <= 12) {
          months[e.month - 1] += e.amount;
          total += e.amount;
        }
      });
      return { 
        ...cat, 
        months, 
        total,
        color: COLORS[index % COLORS.length]
      };
    }).sort((a, b) => b.total - a.total);
  }, [categories, expensesInSelectedYear]);

  // Aylık Sütun Toplamları (Matris Tablosu)
  const monthlyColumnTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    matrixData.forEach(row => {
      row.months.forEach((amt, mIdx) => {
        totals[mIdx] += amt;
      });
    });
    return totals;
  }, [matrixData]);

  // Yıllık Toplam Gider
  const totalExpenseYear = useMemo(() => {
    return matrixData.reduce((sum, item) => sum + item.total, 0);
  }, [matrixData]);

  // En Yüksek Gider Kalemi
  const maxExpenseItem = useMemo(() => {
    return matrixData.length > 0 && matrixData[0].total > 0 ? matrixData[0] : null;
  }, [matrixData]);

  const maxExpenseShare = useMemo(() => {
    if (!maxExpenseItem || totalExpenseYear === 0) return 0;
    return Math.round((maxExpenseItem.total / totalExpenseYear) * 100);
  }, [maxExpenseItem, totalExpenseYear]);

  // Bu Ayın Gideri
  const thisMonthExpense = useMemo(() => {
    return expensesInSelectedYear
      .filter(e => e.month === currentMonth)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expensesInSelectedYear, currentMonth]);

  // Aktif Kategori Sayısı (Harcaması olan)
  const activeCategoriesCount = useMemo(() => {
    return matrixData.filter(d => d.total > 0).length;
  }, [matrixData]);

  // Pasta Grafiği Verisi
  const pieData = useMemo(() => {
    return matrixData
      .filter(d => d.total > 0)
      .map(d => ({ name: d.name, value: d.total }));
  }, [matrixData]);

  // Gelir vs Gider Grafiği Verisi (Aylık)
  const financialTrendData = useMemo(() => {
    const result = [];
    const currentIncomes = transactions.filter(
      t => t.year === selectedYear && 
      (t.type === 'TAHSİLAT' || t.type === 'PAYMENT') && 
      (t.status === 'APPROVED' || !t.status)
    );

    for (let i = 0; i < 12; i++) {
      const monthNum = i + 1;
      const expense = expensesInSelectedYear
        .filter(e => e.month === monthNum)
        .reduce((sum, e) => sum + e.amount, 0);
      const income = currentIncomes
        .filter(t => t.month === monthNum)
        .reduce((sum, t) => sum + (t.credit || 0), 0);

      result.push({
        monthIndex: monthNum,
        name: MONTH_SHORT_NAMES[i],
        fullName: MONTH_NAMES[i],
        Gelir: income,
        Gider: expense,
        Net: income - expense
      });
    }
    return result;
  }, [selectedYear, expensesInSelectedYear, transactions]);

  // Yıllık Toplam Gelir ve Net Durum
  const totalIncomeYear = useMemo(() => {
    return financialTrendData.reduce((sum, item) => sum + item.Gelir, 0);
  }, [financialTrendData]);

  const netBalanceYear = totalIncomeYear - totalExpenseYear;

  // Filtrelenmiş Gider Kayıtları (Tab 2)
  const filteredExpenseList = useMemo(() => {
    return expensesInSelectedYear.filter(item => {
      // Kategori filtresi
      if (filterCategory !== 'ALL' && item.categoryId !== filterCategory) {
        return false;
      }
      // Ay filtresi
      if (filterMonth !== 0 && item.month !== filterMonth) {
        return false;
      }
      // Arama filtresi
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const catName = categories.find(c => c.id === item.categoryId)?.name.toLowerCase() || '';
        const desc = (item.description || '').toLowerCase();
        return catName.includes(q) || desc.includes(q);
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expensesInSelectedYear, filterCategory, filterMonth, searchQuery, categories]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300 pb-20 md:pb-12 max-w-full">
      
      {/* =========================================================================
          ÜST BAŞLIK VE KONTROLLER (HEADER BAR)
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/80 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-lg backdrop-blur-md">
        
        {/* Sol: Başlık ve Rozet */}
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-500/30 rounded-xl text-rose-400 shadow-inner">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Gider Yönetimi
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Mali Takip
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              İşletme masrafları, kategori bütçeleri ve yıllık harcama matrisi
            </p>
          </div>
        </div>

        {/* Sağ: Yıl Seçici, Hızlı Butonlar ve Tab Menüsü */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          
          {/* Yıl Değiştirici */}
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 shadow-sm">
            <button 
              type="button"
              onClick={() => setSelectedYear(y => y - 1)} 
              className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Önceki Yıl"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-white px-3 font-mono tabular-nums">
              {selectedYear}
            </span>
            <button 
              type="button"
              onClick={() => setSelectedYear(y => y + 1)} 
              className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Sonraki Yıl"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {selectedYear !== currentYear && (
              <button
                type="button"
                onClick={() => setSelectedYear(currentYear)}
                className="ml-1 text-[10px] font-semibold bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 px-2 py-0.5 rounded border border-blue-500/30 transition-colors"
              >
                Bu Yıl
              </button>
            )}
          </div>

          {/* Kategori Yönetimi Butonu */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="Kategorileri Düzenle"
          >
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            <span>Kategoriler ({categories.length})</span>
          </button>

          {/* Yeni Gider Ekle Butonu */}
          <button
            type="button"
            onClick={() => setIsAddExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 active:scale-95 border border-emerald-500/40"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Gider Ekle</span>
          </button>

          {/* Tab Seçicileri (Segmented) */}
          <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('MATRIX')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'MATRIX'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Yıllık Matris</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ENTRY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ENTRY'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Hareketler & Giriş</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REPORT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'REPORT'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Analiz & Rapor</span>
            </button>
          </div>

        </div>
      </div>

      {/* =========================================================================
          ÖZET KPI KARTLARI (HER SEKMEYE REHBERLİK EDEN MODERN METRİKLER)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Kart 1: Yıllık Toplam Gider */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Yıllık Toplam Gider
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
              {formatCurrency(totalExpenseYear)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{selectedYear} Mali Yılı</span>
            <span className="text-slate-400">{expensesInSelectedYear.length} işlem kaydı</span>
          </div>
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-all" />
        </div>

        {/* Kart 2: Bu Ayki Harcama */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bu Ayki Harcama
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              {formatCurrency(thisMonthExpense)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{MONTH_NAMES[currentMonth - 1]} Ayı</span>
            <span className="text-slate-400">
              {selectedYear === currentYear ? 'Güncel Dönem' : `${selectedYear} Arşivi`}
            </span>
          </div>
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-all" />
        </div>

        {/* Kart 3: En Büyük Gider Kalemi */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              En Yüksek Gider
            </span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-base font-bold text-white truncate" title={maxExpenseItem ? maxExpenseItem.name : '-'}>
              {maxExpenseItem ? maxExpenseItem.name : 'Kayıt Yok'}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold font-mono text-purple-400">
                {maxExpenseItem ? formatCurrency(maxExpenseItem.total) : '0 ₺'}
              </span>
              {maxExpenseShare > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/40">
                  Toplamın %{maxExpenseShare}'i
                </span>
              )}
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-all" />
        </div>

        {/* Kart 4: Bütçe Dengesi / Kategori Sayısı */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl shadow-md relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Net Nakit Akışı
            </span>
            <div className={`p-2 rounded-xl ${netBalanceYear >= 0 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border-rose-500/20'} border`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono tracking-tight ${netBalanceYear >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(netBalanceYear)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Gelir: {formatCurrency(totalIncomeYear)}</span>
            <span className="text-slate-400">{activeCategoriesCount}/{categories.length} Kategori</span>
          </div>
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-all" />
        </div>

      </div>

      {/* =========================================================================
          SEKME 1: YILLIK GİDER MATRİSİ TABLOSU (TAM GENİŞLİK, DÜZGÜN KAYDIRMA)
          ========================================================================= */}
      {activeTab === 'MATRIX' && (
        <div className="space-y-4">
          
          {/* Matris Bilgi & İpuçları Çubuğu */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-900/50 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>{selectedYear}</strong> yılı aylık gider dağılımı. Mavi vurgulu sütun mevcut ayı temsil eder.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Mevcut Ay: {MONTH_NAMES[currentMonth - 1]}
              </span>
              <span className="text-slate-600">|</span>
              <span>Toplam {categories.length} Kategori</span>
            </div>
          </div>

          {/* Matris Tablo Kapsayıcısı */}
          {categories.length === 0 ? (
            /* Kategori Yoksa Boş Durum */
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
              <div className="p-4 bg-purple-500/10 rounded-full text-purple-400 border border-purple-500/20">
                <Tag className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Henüz Gider Kategorisi Eklenmemiş</h3>
                <p className="text-sm text-slate-400 max-w-md mt-1">
                  Giderlerinizi takip etmek için ilk kategorinizi ekleyebilir veya OSGB için hazır önerilen kategorileri tek tıkla yükleyebilirsiniz.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleAddDefaultCategories}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Varsayılan OSGB Kategorilerini Yükle
                </button>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Özel Kategori Oluştur
                </button>
              </div>
            </div>
          ) : (
            /* Matris Tablosu */
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1050px]">
                  
                  {/* TABLO BAŞLIĞI */}
                  <thead>
                    <tr className="bg-slate-950/90 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                      
                      {/* Sol Sabit Başlık: Gider Kalemi */}
                      <th className="p-3.5 sticky left-0 z-20 bg-slate-950 w-56 min-w-[200px] border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        Gider Kalemi
                      </th>

                      {/* 12 Ay */}
                      {MONTH_SHORT_NAMES.map((monthName, idx) => {
                        const isCurrent = idx === currentMonth - 1 && selectedYear === currentYear;
                        return (
                          <th 
                            key={monthName}
                            className={`p-3 text-center w-20 min-w-[76px] border-r border-slate-800/60 transition-colors ${
                              isCurrent 
                                ? 'bg-blue-500/15 text-blue-300 font-extrabold border-b-2 border-b-blue-500' 
                                : ''
                            }`}
                          >
                            <span className="block">{monthName}</span>
                            {isCurrent && <span className="text-[9px] text-blue-400 font-normal lowercase">şimdi</span>}
                          </th>
                        );
                      })}

                      {/* Sağ Sabit Başlık: Toplam */}
                      <th className="p-3.5 text-right sticky right-0 z-20 bg-slate-950 w-32 min-w-[120px] text-slate-200 border-l border-slate-800 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">
                        Yıllık Toplam
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* --- GENEL TOPLAM SATIRI (ÖNE ÇIKAN SÜTUN TOPLAMLARI) --- */}
                    <tr className="bg-slate-800/80 border-b-2 border-slate-700 text-xs font-bold text-slate-200 shadow-sm">
                      <td className="p-3.5 sticky left-0 z-20 bg-slate-800 border-r border-slate-700 text-blue-400 font-black flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                        <span>GENEL TOPLAM</span>
                        <span className="text-[10px] font-normal text-slate-400">12 Ay</span>
                      </td>
                      
                      {monthlyColumnTotals.map((colTotal, idx) => {
                        const isCurrent = idx === currentMonth - 1 && selectedYear === currentYear;
                        return (
                          <td 
                            key={idx} 
                            className={`p-3 text-center font-mono border-r border-slate-700/60 tabular-nums ${
                              isCurrent ? 'bg-blue-500/20 text-blue-300 font-black' : 'text-slate-200'
                            }`}
                          >
                            {colTotal > 0 ? (
                              <span className="font-bold">{formatCurrency(colTotal)}</span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="p-3.5 text-right font-black font-mono text-sm text-rose-400 sticky right-0 z-20 bg-slate-800 border-l border-slate-700 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">
                        {formatCurrency(totalExpenseYear)}
                      </td>
                    </tr>

                    {/* --- KATEGORİ SATIRLARI --- */}
                    {matrixData.map((row, rowIdx) => {
                      const sharePercent = totalExpenseYear > 0 
                        ? Math.round((row.total / totalExpenseYear) * 100) 
                        : 0;

                      return (
                        <tr 
                          key={row.id}
                          className={`text-xs transition-colors group ${
                            rowIdx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/60'
                          } hover:bg-slate-800/60`}
                        >
                          {/* Kategori Adı ve Renk Noktası (Sticky Left) */}
                          <td className="p-3 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-r border-slate-800/80 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center gap-2.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: row.color }} 
                              />
                              <span className="font-medium text-slate-200 truncate group-hover:text-white" title={row.name}>
                                {row.name}
                              </span>
                            </div>
                          </td>

                          {/* 12 Ayın Harcama Değerleri */}
                          {row.months.map((amt, mIdx) => {
                            const isCurrent = mIdx === currentMonth - 1 && selectedYear === currentYear;
                            return (
                              <td 
                                key={mIdx}
                                className={`p-3 text-center font-mono border-r border-slate-800/40 tabular-nums transition-colors ${
                                  isCurrent ? 'bg-blue-500/5 group-hover:bg-blue-500/10' : ''
                                }`}
                              >
                                {amt > 0 ? (
                                  <span className="text-slate-300 font-semibold group-hover:text-white">
                                    {formatCurrency(amt)}
                                  </span>
                                ) : (
                                  <span className="text-slate-700/60 select-none">·</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Kategori Yıllık Toplamı (Sticky Right) */}
                          <td className="p-3 text-right sticky right-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 border-l border-slate-800/80 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">
                            <div className="flex flex-col items-end">
                              <span className="font-bold font-mono text-slate-100 group-hover:text-white">
                                {formatCurrency(row.total)}
                              </span>
                              {sharePercent > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  %{sharePercent}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Alt Bilgi Çubuğu */}
              <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  Toplam <strong>{categories.length}</strong> kategoride <strong>{formatCurrency(totalExpenseYear)}</strong> yıllık gider gerçekleşti.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ENTRY')}
                    className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4"
                  >
                    Gider hareketlerini listele →
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          SEKME 2: GİDER HAREKETLERİ & HIZLI GİRİŞ (GENİŞ, FERAH, DARALMAYAN DÜZEN)
          ========================================================================= */}
      {activeTab === 'ENTRY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sol/Üst: Filtreler ve Gider Kayıtları Tablosu (8 Kolon) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Arama ve Filtre Kontrol Çubuğu */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Arama Kutusu */}
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Gider açıklaması veya kategori ara..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Kategori Filtresi */}
                <div className="w-full sm:w-48">
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL">Tüm Kategoriler ({categories.length})</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Ay Filtresi */}
                <div className="w-full sm:w-36">
                  <select
                    value={filterMonth}
                    onChange={e => setFilterMonth(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value={0}>Tüm Aylar</option>
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aktif Filtre İpuçları */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                <span>
                  {filteredExpenseList.length} kayıt listeleniyor
                  {(searchQuery || filterCategory !== 'ALL' || filterMonth !== 0) && (
                    <span className="text-blue-400 ml-1.5 font-medium">(Filtrelenmiş)</span>
                  )}
                </span>
                <span className="font-mono font-bold text-slate-200">
                  Toplam: {formatCurrency(filteredExpenseList.reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
            </div>

            {/* Hareketler Listesi */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <List className="w-4 h-4 text-blue-400" />
                  Gider Kayıtları Geçmişi ({selectedYear})
                </h3>
                <span className="text-xs text-slate-500">
                  En yeni kayıtlar önce sıralanır
                </span>
              </div>

              {filteredExpenseList.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm font-medium">Bu kriterlere uygun gider kaydı bulunamadı.</p>
                  <p className="text-xs text-slate-500 mt-1">Yeni bir gider eklemek için sağdaki formu kullanabilirsiniz.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {filteredExpenseList.map((exp, index) => {
                    const catObj = categories.find(c => c.id === exp.categoryId);
                    const catColor = COLORS[categories.findIndex(c => c.id === exp.categoryId) % COLORS.length] || '#3b82f6';
                    const expDateFormatted = new Date(exp.date).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });

                    return (
                      <div 
                        key={exp.id} 
                        className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Sol: Tarih, Kategori ve Açıklama */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div 
                            className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                            style={{ backgroundColor: catColor }} 
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white">
                                {catObj ? catObj.name : 'Bilinmeyen Kategori'}
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 font-mono">
                                {expDateFormatted}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 truncate max-w-md" title={exp.description || 'Açıklama belirtilmemiş'}>
                              {exp.description || <span className="italic text-slate-600">Açıklama yok</span>}
                            </p>
                          </div>
                        </div>

                        {/* Sağ: Tutar ve Sil Butonu */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-sm text-rose-400">
                            {formatCurrency(exp.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Bu gideri sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Sağ Kolon: Hızlı Gider Ekle & Kategori Yönetimi (4 Kolon - Ferah Görünüm) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Hızlı Gider Ekle Kartı */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </div>
                  Hızlı Gider Girişi
                </h3>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                  {selectedYear}
                </span>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Gider Kategorisi <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={expenseForm.categoryId}
                    onChange={e => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Kategori Seçiniz...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                      Tarih <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseForm.date}
                      onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-emerald-400 mb-1.5 block">
                      Tutar (₺) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Açıklama / Fatura No / Not
                  </label>
                  <input
                    type="text"
                    placeholder="Masraf açıklaması veya fatura detayı..."
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!expenseForm.categoryId || !expenseForm.amount}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  Gideri Kaydet
                </button>
              </form>
            </div>

            {/* Kategori Yönetim Paneli */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  Kategoriler ({categories.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddDefaultCategories}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold"
                  title="Eksik varsayılan kategorileri ekle"
                >
                  + Varsayılanları Ekle
                </button>
              </div>

              {/* Hızlı Kategori Ekleme */}
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Yeni kategori adı..."
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Kategori Rozetleri */}
              <div className="flex flex-wrap gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar content-start">
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Henüz kategori eklenmemiş.</p>
                ) : (
                  categories.map((cat, idx) => {
                    const count = expensesInSelectedYear.filter(e => e.categoryId === cat.id).length;
                    const catColor = COLORS[idx % COLORS.length];

                    return (
                      <div 
                        key={cat.id}
                        className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-xs"
                      >
                        <span 
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: catColor }} 
                        />
                        <span className="text-slate-300 font-medium truncate max-w-[120px]" title={cat.name}>
                          {cat.name}
                        </span>
                        {count > 0 && (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono">
                            {count}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="w-4 h-4 rounded flex items-center justify-center text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors ml-0.5"
                          title="Kategoriyi Sil"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          SEKME 3: FİNANSAL ANALİZ VE RAPORLAR
          ========================================================================= */}
      {activeTab === 'REPORT' && (
        <div className="space-y-6">
          
          {/* Grafikler 2 Sütun */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Grafik 1: Gelir (Tahsilat) vs Gider */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Aylık Nakit Akışı (Gelir vs Gider)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedYear} yılı boyunca tahsil edilen gelirler ve yapılan giderler
                  </p>
                </div>
              </div>

              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financialTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncomeNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpenseNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${Math.round(val / 1000)}k`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                      formatter={(val: number) => formatCurrency(val)} 
                    />
                    <Legend verticalAlign="top" iconSize={10} wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }} />
                    <Area type="monotone" dataKey="Gelir" stroke="#10b981" strokeWidth={2} fill="url(#colorIncomeNew)" />
                    <Area type="monotone" dataKey="Gider" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenseNew)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grafik 2: Kategori Dağılımı (Donut) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[380px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-purple-400" />
                    Kategori Bazlı Gider Dağılımı
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Harcamaların kategorilere göre oransal ağırlığı
                  </p>
                </div>
              </div>

              {pieData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <PieIcon className="w-10 h-10 mb-2 opacity-30" />
                  <span>Grafik için henüz gider verisi bulunmuyor.</span>
                </div>
              ) : (
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={65} 
                        outerRadius={95} 
                        paddingAngle={4} 
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                        formatter={(val: number) => formatCurrency(val)} 
                      />
                      <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right" 
                        wrapperStyle={{ fontSize: '11px', maxHeight: '250px', overflowY: 'auto' }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>

          {/* Aylık Mali Performans Özeti Tablosu */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                {selectedYear} Aylık Mali Netice Tablosu
              </h3>
              <span className="text-xs font-mono font-bold text-slate-300">
                Yıllık Net Bakiye: <span className={netBalanceYear >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(netBalanceYear)}</span>
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                    <th className="p-3">Ay</th>
                    <th className="p-3 text-right">Tahsil Edilen Gelir</th>
                    <th className="p-3 text-right">Yapılan Gider</th>
                    <th className="p-3 text-right">Net Fark (Kar/Zarar)</th>
                    <th className="p-3 text-center">Gider / Gelir Oranı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {financialTrendData.map((item, idx) => {
                    const ratio = item.Gelir > 0 ? Math.round((item.Gider / item.Gelir) * 100) : 0;
                    const isProfitable = item.Net >= 0;

                    return (
                      <tr 
                        key={item.monthIndex} 
                        className={`hover:bg-slate-800/40 transition-colors ${
                          idx % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-900/50'
                        }`}
                      >
                        <td className="p-3 font-sans font-medium text-slate-300">
                          {item.fullName}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-400">
                          {item.Gelir > 0 ? formatCurrency(item.Gelir) : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-rose-400">
                          {item.Gider > 0 ? formatCurrency(item.Gider) : '-'}
                        </td>
                        <td className={`p-3 text-right font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.Net !== 0 ? formatCurrency(item.Net) : '-'}
                        </td>
                        <td className="p-3 text-center font-sans">
                          {item.Gelir > 0 ? (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              ratio <= 50 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              ratio <= 80 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              %{ratio}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL: YENİ GİDER EKLE (HER SEKMEYLE ETKİLEŞİMLİ POPUP)
          ========================================================================= */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsAddExpenseModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Yeni Gider Kaydı Ekle</h3>
                <p className="text-xs text-slate-400">Gider tutarını ve kategorisini belirterek sisteme kaydedin.</p>
              </div>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Kategori <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={expenseForm.categoryId}
                  onChange={e => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Kategori Seçiniz...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Tarih <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-emerald-400 mb-1.5 block">
                    Tutar (₺) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Açıklama / Fatura No / Not
                </label>
                <input
                  type="text"
                  placeholder="Gider açıklaması..."
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={!expenseForm.categoryId || !expenseForm.amount}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: KATEGORİ YÖNETİMİ (TAM KONTROL POPUP)
          ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
              <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Gider Kategorileri Yönetimi</h3>
                <p className="text-xs text-slate-400">Yeni kategori oluşturun veya mevcutları düzenleyin.</p>
              </div>
            </div>

            {/* Yeni Kategori Ekleme Formu */}
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-5">
              <input
                type="text"
                placeholder="Örn: Personel Eğitimi, Akaryakıt, Ofis..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!newCatName.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Ekle
              </button>
            </form>

            {/* Kategoriler Listesi */}
            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-800">
              {categories.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Henüz kayıtlı kategori bulunmamaktadır.
                </div>
              ) : (
                categories.map((cat, idx) => {
                  const relatedExpenses = expenses.filter(e => e.categoryId === cat.id);
                  const relatedSum = relatedExpenses.reduce((s, e) => s + e.amount, 0);

                  return (
                    <div 
                      key={cat.id} 
                      className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }} 
                        />
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                          {relatedExpenses.length} kayıt ({formatCurrency(relatedSum)})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Kategoriyi ve ilgili kayıtları sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Alt Kısım: Varsayılanları Yükle & Kapat */}
            <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={handleAddDefaultCategories}
                className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Varsayılan OSGB Kategorilerini Yükle
              </button>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Expenses;