import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ExpenseCategory, Expense, Transaction } from '../types';
import { 
  Wallet, Plus, Trash2, PieChart as PieIcon, List, 
  CalendarDays, TrendingUp, CreditCard, 
  ChevronLeft, ChevronRight, X, Tag, Scale, BarChart3
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#06b6d4', '#f97316'];

const Expenses = () => {
  // State
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); 
  
  const [activeTab, setActiveTab] = useState<'ENTRY' | 'MATRIX' | 'REPORT'>('MATRIX');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form State
  const [newCatName, setNewCatName] = useState('');
  const [expenseForm, setExpenseForm] = useState({
      categoryId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: ''
  });

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
      if(!newCatName.trim()) return;
      db.addExpenseCategory(newCatName);
      setNewCatName('');
  };

  const handleDeleteCategory = (id: string) => {
      if(window.confirm('Bu kategoriyi ve ilişkili gider geçmişini silmek istediğinize emin misiniz?')) {
          db.deleteExpenseCategory(id);
      }
  };

  const handleAddExpense = (e: React.FormEvent) => {
      e.preventDefault();
      if(!expenseForm.categoryId || !expenseForm.amount) return;

      const dateObj = new Date(expenseForm.date);
      db.addExpense({
          categoryId: expenseForm.categoryId,
          amount: Number(expenseForm.amount),
          date: expenseForm.date,
          description: expenseForm.description,
          month: dateObj.getMonth() + 1,
          year: dateObj.getFullYear()
      });
      setExpenseForm(prev => ({...prev, amount: '', description: ''})); 
  };

  const handleDeleteExpense = (id: string) => {
      if(window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
          db.deleteExpense(id);
      }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  // --- VERİ HAZIRLAMA ---
  const getMatrixData = () => {
      const filteredExpenses = expenses.filter(e => e.year === selectedYear);
      return categories.map(cat => {
          const months = Array(12).fill(0);
          let total = 0;
          filteredExpenses.filter(e => e.categoryId === cat.id).forEach(e => {
              months[e.month - 1] += e.amount;
              total += e.amount;
          });
          return { ...cat, months, total };
      }).sort((a, b) => b.total - a.total); 
  };

  const getPieData = () => {
      return getMatrixData().filter(d => d.total > 0).map(d => ({ name: d.name, value: d.total }));
  };

  const getBarData = () => {
      const result = [];
      const currentExpenses = expenses.filter(e => e.year === selectedYear);
      const currentIncomes = transactions.filter(t => t.year === selectedYear && (t.type === 'TAHSİLAT' || t.type === 'PAYMENT') && (t.status === 'APPROVED' || !t.status));

      for(let i=0; i<12; i++) {
          const expense = currentExpenses.filter(e => e.month === i + 1).reduce((sum, e) => sum + e.amount, 0);
          const income = currentIncomes.filter(t => t.month === i + 1).reduce((sum, t) => sum + (t.credit || 0), 0);
          const shortName = new Date(2000, i, 1).toLocaleString('tr-TR', { month: 'short' });
          const fullName = new Date(2000, i, 1).toLocaleString('tr-TR', { month: 'long' });
          result.push({
              monthNum: i + 1,
              name: shortName,
              fullName: fullName,
              Gelir: income,
              Gider: expense,
              Net: income - expense,
              ratio: income > 0 ? Math.round((expense / income) * 100) : 0
          });
      }
      return result;
  };

  // --- ISTATISTIK ---
  const totalExpenseYear = getMatrixData().reduce((sum, item) => sum + item.total, 0);
  const maxExpenseItem = getMatrixData().length > 0 ? getMatrixData()[0] : null;
  const currentMonth = new Date().getMonth() + 1;
  const thisMonthExpense = expenses.filter(e => e.year === selectedYear && e.month === currentMonth).reduce((sum, e) => sum + e.amount, 0);

  // Analiz İstatistikleri
  const currentIncomesYear = transactions.filter(t => t.year === selectedYear && (t.type === 'TAHSİLAT' || t.type === 'PAYMENT') && (t.status === 'APPROVED' || !t.status));
  const totalIncomeYear = currentIncomesYear.reduce((sum, t) => sum + (t.credit || 0), 0);
  const netProfitYear = totalIncomeYear - totalExpenseYear;
  const expenseRatioYear = totalIncomeYear > 0 ? Math.round((totalExpenseYear / totalIncomeYear) * 100) : 0;
  const monthlyData = getBarData();

  return (
    <div className="flex flex-col h-[calc(100vh-1rem)] space-y-4 animate-in fade-in duration-500 overflow-hidden">
      
      {/* COMPACT HEADER */}
      <header className="flex flex-row justify-between items-center bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <div className="p-1.5 bg-rose-500/20 rounded-lg text-rose-500"><Wallet className="w-5 h-5" /></div>
            Gider Yönetimi
          </h2>
          
          {/* Yıl Seçici - Header içine alındı */}
          {activeTab !== 'ENTRY' && (
             <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                <button onClick={() => setSelectedYear(y => y - 1)} className="hover:text-white text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-bold text-white tabular-nums">{selectedYear}</span>
                <button onClick={() => setSelectedYear(y => y + 1)} className="hover:text-white text-slate-400"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
            {[
              { id: 'MATRIX', label: 'Tablo', icon: CalendarDays },
              { id: 'ENTRY', label: 'Giriş', icon: Plus },
              { id: 'REPORT', label: 'Analiz', icon: PieIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
        </div>
      </header>

      {/* --- TABLO GÖRÜNÜMÜ (COMPACT MATRIX - EKRANA TAM SIĞDIRMA & SIFIR YATAY KAYDIRMA) --- */}
      {activeTab === 'MATRIX' && (
          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-xl relative min-h-0">
              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                  <table className="w-full table-fixed text-left border-collapse">
                      <thead className="bg-slate-900/95 text-[10px] uppercase text-slate-400 font-bold sticky top-0 z-20 shadow-md">
                          <tr>
                              <th className="py-2.5 px-2.5 border-b border-r border-slate-800 w-[18%] truncate font-bold text-slate-300">Gider Kalemi</th>
                              {['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'].map((m, mIdx) => {
                                  const isCurrent = mIdx === currentMonth - 1 && selectedYear === new Date().getFullYear();
                                  return (
                                      <th 
                                          key={m} 
                                          className={`py-2 px-0.5 text-center w-[6%] border-b border-r border-slate-800 font-bold truncate transition-colors ${
                                              isCurrent ? 'bg-blue-600/30 text-blue-300 font-extrabold' : ''
                                          }`}
                                          title={m}
                                      >
                                          {m}
                                      </th>
                                  );
                              })}
                              <th className="py-2.5 px-2 text-right border-b border-slate-800 w-[10%] truncate font-bold text-white">TOPLAM</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                          {/* Toplam Satırı - Sticky */}
                          <tr className="bg-slate-800/95 font-bold sticky top-[29px] z-20 shadow-sm text-xs">
                              <td className="py-2 px-2.5 text-blue-400 border-r border-slate-700 truncate font-extrabold">TOPLAM</td>
                              {Array(12).fill(0).map((_, i) => {
                                  const colTotal = getMatrixData().reduce((sum, r) => sum + r.months[i], 0);
                                  const isCurrent = i === currentMonth - 1 && selectedYear === new Date().getFullYear();
                                  return (
                                      <td 
                                          key={i} 
                                          className={`py-2 px-0.5 text-center text-blue-400 font-mono border-r border-slate-700 truncate text-[11px] tabular-nums tracking-tight ${
                                              isCurrent ? 'bg-blue-600/20 font-bold' : ''
                                          }`}
                                          title={colTotal > 0 ? formatCurrency(colTotal) : ''}
                                      >
                                          {colTotal > 0 ? formatCurrency(colTotal) : '-'}
                                      </td>
                                  );
                              })}
                              <td className="py-2 px-2 text-right text-rose-400 font-mono font-black border-l border-slate-700 truncate text-[11px] tabular-nums" title={formatCurrency(totalExpenseYear)}>
                                  {formatCurrency(totalExpenseYear)}
                              </td>
                          </tr>

                          {/* Veriler */}
                          {getMatrixData().map((row, idx) => (
                              <tr key={row.id} className={`group text-xs ${idx % 2 === 0 ? 'bg-slate-800/40' : 'bg-slate-800/10'} hover:bg-slate-700/50 transition-colors`}>
                                  <td className="py-2 px-2.5 font-medium text-slate-300 border-r border-slate-700/50 truncate group-hover:text-white" title={row.name}>
                                      {row.name}
                                  </td>
                                  {row.months.map((amount, mIdx) => {
                                      const isCurrent = mIdx === currentMonth - 1 && selectedYear === new Date().getFullYear();
                                      return (
                                          <td 
                                              key={mIdx} 
                                              className={`py-2 px-0.5 text-center font-mono border-r border-slate-700/30 truncate text-[11px] tabular-nums tracking-tight transition-colors ${
                                                  isCurrent ? 'bg-blue-500/5' : ''
                                              } ${amount > 0 ? 'text-slate-200 group-hover:text-white font-medium' : 'text-slate-600'}`}
                                              title={amount > 0 ? formatCurrency(amount) : ''}
                                          >
                                              {amount > 0 ? formatCurrency(amount) : <span className="text-slate-600 select-none">-</span>}
                                          </td>
                                      );
                                  })}
                                  <td className="py-2 px-2 font-bold text-right text-slate-200 border-l border-slate-700/50 font-mono truncate text-[11px] tabular-nums group-hover:text-white" title={formatCurrency(row.total)}>
                                      {formatCurrency(row.total)}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- VERİ GİRİŞİ (ENTRY) --- */}
      {activeTab === 'ENTRY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
              <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <CreditCard className="w-32 h-32 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-700 pb-4">
                          <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-500"><Plus className="w-5 h-5" /></div>
                          Yeni Gider Ekle
                      </h3>
                      <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                          <div className="col-span-2">
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Kategori</label>
                              <select required value={expenseForm.categoryId} onChange={e => setExpenseForm({...expenseForm, categoryId: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 appearance-none">
                                  <option value="">Seçiniz...</option>
                                  {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Tarih</label>
                              <input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-emerald-500 uppercase mb-1 block">Tutar</label>
                              <input type="number" min="0" step="0.01" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono text-lg font-bold outline-none focus:border-emerald-500" placeholder="0.00" />
                          </div>
                          <div className="col-span-2">
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Açıklama</label>
                              <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500" placeholder="Not ekleyin..." />
                          </div>
                          <div className="col-span-2 pt-2">
                              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]">
                                  <Plus className="w-5 h-5" /> Kaydet
                              </button>
                          </div>
                      </form>
                  </div>

                  <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-lg flex-1 min-h-[200px]">
                      <div className="p-4 border-b border-slate-700 bg-slate-800/50"><h4 className="font-bold text-slate-300 flex items-center gap-2"><List className="w-4 h-4 text-blue-400" /> Son Kayıtlar</h4></div>
                      <div className="divide-y divide-slate-700/50">
                        {expenses.slice().reverse().slice(0, 10).map(exp => (
                            <div key={exp.id} className="p-3 flex items-center justify-between hover:bg-slate-700/20 text-sm">
                                <div>
                                    <div className="font-bold text-slate-200">{categories.find(c => c.id === exp.categoryId)?.name}</div>
                                    <div className="text-xs text-slate-500">{new Date(exp.date).toLocaleDateString('tr-TR')} • {exp.description}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-white">{formatCurrency(exp.amount)}</span>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-600 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                      </div>
                  </div>
              </div>

              <div className="lg:col-span-4 bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl h-fit sticky top-4">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-purple-500"/> Kategoriler</h3>
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                      <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Yeni Kategori..." className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500" />
                      <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-xl"><Plus className="w-5 h-5"/></button>
                  </form>
                  <div className="flex flex-wrap gap-2 max-h-[60vh] overflow-y-auto content-start">
                      {categories.map(cat => (
                          <div key={cat.id} className="group flex items-center gap-2 pl-3 pr-2 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-full">
                              <span className="text-slate-300 text-xs font-medium">{cat.name}</span>
                              <button onClick={() => handleDeleteCategory(cat.id)} className="w-4 h-4 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-500 hover:text-white"><X className="w-3 h-3"/></button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- RAPORLAR & ANALİZ (REPORT) --- */}
      {activeTab === 'REPORT' && (
          <div className="flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar pb-6">
              
              {/* 1. ÜST FİNANSAL GÖSTERGE KARTLARI (4'LÜ DÜZEN) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Kart 1: Yıllık Gelir (Tahsilat) */}
                  <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 shadow-md relative overflow-hidden group hover:border-slate-600 transition-colors">
                      <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Yıllık Tahsilat (Gelir)</p>
                      <p className="text-2xl font-black font-mono text-emerald-400">{formatCurrency(totalIncomeYear)}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{selectedYear} Toplam Gelir</p>
                      <TrendingUp className="absolute bottom-2 right-2 w-12 h-12 text-emerald-500/10 pointer-events-none group-hover:text-emerald-500/20 transition-colors"/>
                  </div>

                  {/* Kart 2: Yıllık Gider */}
                  <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 shadow-md relative overflow-hidden group hover:border-slate-600 transition-colors">
                      <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Yıllık Toplam Gider</p>
                      <p className="text-2xl font-black font-mono text-rose-400">{formatCurrency(totalExpenseYear)}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{selectedYear} Toplam Harcama</p>
                      <Wallet className="absolute bottom-2 right-2 w-12 h-12 text-rose-500/10 pointer-events-none group-hover:text-rose-500/20 transition-colors"/>
                  </div>

                  {/* Kart 3: Net Bakiye (Kâr/Zarar) */}
                  <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 shadow-md relative overflow-hidden group hover:border-slate-600 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Net Bilanço</p>
                          {totalIncomeYear > 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono">
                                  Gider %{expenseRatioYear}
                              </span>
                          )}
                      </div>
                      <p className={`text-2xl font-black font-mono ${netProfitYear >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(netProfitYear)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                          {netProfitYear >= 0 ? 'Net Kâr Durumu' : 'Net Bütçe Açığı'}
                      </p>
                      <Scale className="absolute bottom-2 right-2 w-12 h-12 text-slate-500/10 pointer-events-none group-hover:text-slate-500/20 transition-colors"/>
                  </div>

                  {/* Kart 4: Bu Ay & En Yüksek */}
                  <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 shadow-md relative overflow-hidden group hover:border-slate-600 transition-colors">
                      <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1">Bu Ayki Gider</p>
                      <p className="text-2xl font-black font-mono text-blue-400">{formatCurrency(thisMonthExpense)}</p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate" title={maxExpenseItem ? `${maxExpenseItem.name}: ${formatCurrency(maxExpenseItem.total)}` : ''}>
                          En Yüksek: <span className="font-semibold text-slate-200">{maxExpenseItem ? maxExpenseItem.name : '-'}</span>
                      </p>
                      <CalendarDays className="absolute bottom-2 right-2 w-12 h-12 text-blue-500/10 pointer-events-none group-hover:text-blue-500/20 transition-colors"/>
                  </div>
              </div>

              {/* 2. GRAFİKLER (GELİR/GİDER ALAN GRAFİĞİ + DONUT DAĞILIM) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Gelir & Gider Grafiği */}
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col h-[360px]">
                      <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-emerald-400"/> Gelir & Gider Nakit Akışı ({selectedYear})
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">
                              Aylık Karşılaştırma
                          </span>
                      </div>
                      <div className="flex-1 w-full min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <defs>
                                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} formatter={(val:number) => formatCurrency(val)} />
                                  <Legend verticalAlign="top" iconSize={10} wrapperStyle={{fontSize: '11px', paddingBottom: '10px'}}/>
                                  <Area type="monotone" dataKey="Gelir" stroke="#10b981" strokeWidth={2} fill="url(#colorIncome)" />
                                  <Area type="monotone" dataKey="Gider" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpense)" />
                              </AreaChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Kategori Bazlı Gider Dağılımı (Gelişmiş Donut & İlerleme Listesi) */}
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col h-[360px]">
                      <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                              <PieIcon className="w-4 h-4 text-purple-400"/> Gider Dağılımı ({selectedYear})
                          </h3>
                          {getPieData().length > 0 && (
                              <span className="text-xs text-slate-400 font-mono">
                                  {getPieData().length} Kategori • {formatCurrency(totalExpenseYear)}
                              </span>
                          )}
                      </div>

                      {getPieData().length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                              <PieIcon className="w-10 h-10 opacity-20" />
                              <span>Bu yıla ait harcama verisi bulunamadı.</span>
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 min-h-0">
                              {/* Donut Grafik */}
                              <div className="w-full sm:w-1/2 h-44 sm:h-full relative flex items-center justify-center">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                          <Pie 
                                              data={getPieData()} 
                                              cx="50%" 
                                              cy="50%" 
                                              innerRadius={50} 
                                              outerRadius={75} 
                                              paddingAngle={3} 
                                              dataKey="value"
                                          >
                                              {getPieData().map((_, index) => (
                                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#1e293b" strokeWidth={1} />
                                              ))}
                                          </Pie>
                                          <Tooltip 
                                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px', borderRadius: '8px' }} 
                                              formatter={(val: number) => [formatCurrency(val), 'Tutar']} 
                                          />
                                      </PieChart>
                                  </ResponsiveContainer>
                                  {/* Donut Ortası Başlık */}
                                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Toplam</span>
                                      <span className="text-xs font-bold text-white font-mono">{formatCurrency(totalExpenseYear)}</span>
                                  </div>
                              </div>

                              {/* Kaydırılabilir Kategori Dağılım Listesi & İlerleme Çubukları */}
                              <div className="w-full sm:w-1/2 h-full overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                  {getPieData().map((item, index) => {
                                      const color = COLORS[index % COLORS.length];
                                      const percent = totalExpenseYear > 0 ? ((item.value / totalExpenseYear) * 100).toFixed(1) : '0';
                                      return (
                                          <div key={item.name} className="bg-slate-900/60 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                                              <div className="flex items-center justify-between text-xs mb-1">
                                                  <div className="flex items-center gap-1.5 truncate mr-2">
                                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                      <span className="text-slate-200 font-medium truncate" title={item.name}>{item.name}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                      <span className="font-mono font-bold text-white text-[11px]">{formatCurrency(item.value)}</span>
                                                      <span className="text-[10px] text-purple-400 font-semibold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40 font-mono">
                                                          %{percent}
                                                      </span>
                                                  </div>
                                              </div>
                                              {/* İlerleme Çubuğu */}
                                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                  <div 
                                                      className="h-full rounded-full transition-all duration-500" 
                                                      style={{ width: `${percent}%`, backgroundColor: color }} 
                                                  />
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              {/* 3. AYLIK FİNANSAL NETİCE TABLOSU (P&L BREAKDOWN) */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                  <div className="p-3.5 bg-slate-900/80 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          {selectedYear} Aylık Finansal Bilanço Özeti
                      </h4>
                      <span className="text-xs font-mono font-bold text-slate-300">
                          Net Yıllık Fark: <span className={netProfitYear >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(netProfitYear)}</span>
                      </span>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs">
                          <thead>
                              <tr className="bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-700">
                                  <th className="p-2.5">Ay</th>
                                  <th className="p-2.5 text-right">Tahsil Edilen Gelir</th>
                                  <th className="p-2.5 text-right">Yapılan Gider</th>
                                  <th className="p-2.5 text-right">Net Fark (Kâr/Zarar)</th>
                                  <th className="p-2.5 text-center">Gider / Gelir Oranı</th>
                                  <th className="p-2.5 text-center">Mali Durum</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50 font-mono">
                              {monthlyData.map((row, idx) => {
                                  const hasActivity = row.Gelir > 0 || row.Gider > 0;
                                  const isProfit = row.Net >= 0;
                                  const isCurrent = row.monthNum === currentMonth && selectedYear === new Date().getFullYear();
                                  return (
                                      <tr key={row.monthNum} className={`hover:bg-slate-700/40 transition-colors ${idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'} ${isCurrent ? 'bg-blue-900/15' : ''}`}>
                                          <td className="p-2.5 font-sans font-medium text-slate-200 flex items-center gap-1.5">
                                              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                                              <span>{row.fullName}</span>
                                          </td>
                                          <td className="p-2.5 text-right font-bold text-emerald-400">
                                              {row.Gelir > 0 ? formatCurrency(row.Gelir) : <span className="text-slate-600">-</span>}
                                          </td>
                                          <td className="p-2.5 text-right font-bold text-rose-400">
                                              {row.Gider > 0 ? formatCurrency(row.Gider) : <span className="text-slate-600">-</span>}
                                          </td>
                                          <td className={`p-2.5 text-right font-bold ${row.Net > 0 ? 'text-emerald-400' : row.Net < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                              {row.Net !== 0 ? formatCurrency(row.Net) : <span className="text-slate-600">-</span>}
                                          </td>
                                          <td className="p-2.5 text-center font-sans">
                                              {row.Gelir > 0 ? (
                                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                      row.ratio <= 50 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                      row.ratio <= 85 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                  }`}>
                                                      %{row.ratio}
                                                  </span>
                                              ) : (
                                                  <span className="text-slate-600">-</span>
                                              )}
                                          </td>
                                          <td className="p-2.5 text-center font-sans">
                                              {!hasActivity ? (
                                                  <span className="text-slate-600 text-[10px]">-</span>
                                              ) : isProfit ? (
                                                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">Kârda</span>
                                              ) : (
                                                  <span className="text-[10px] font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">Açık</span>
                                              )}
                                          </td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                          {/* Toplam Satırı */}
                          <tfoot className="bg-slate-900/90 font-bold border-t-2 border-slate-700 text-xs font-mono">
                              <tr>
                                  <td className="p-2.5 font-sans font-bold text-white">YILLIK TOPLAM</td>
                                  <td className="p-2.5 text-right text-emerald-400">{formatCurrency(totalIncomeYear)}</td>
                                  <td className="p-2.5 text-right text-rose-400">{formatCurrency(totalExpenseYear)}</td>
                                  <td className={`p-2.5 text-right font-black ${netProfitYear >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {formatCurrency(netProfitYear)}
                                  </td>
                                  <td className="p-2.5 text-center font-sans">
                                      {totalIncomeYear > 0 ? (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                              %{expenseRatioYear}
                                          </span>
                                      ) : '-'}
                                  </td>
                                  <td className="p-2.5 text-center font-sans">
                                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${
                                          netProfitYear >= 0 
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                      }`}>
                                          {netProfitYear >= 0 ? 'NET KÂR' : 'NET ZARAR'}
                                      </span>
                                  </td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>
              </div>

          </div>
      )}
    </div>
  );
};

export default Expenses;
