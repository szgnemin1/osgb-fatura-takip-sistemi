import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ExpenseCategory, Expense, Transaction } from '../types';
import { 
  Wallet, Plus, Trash2, PieChart as PieIcon, List, 
  CalendarDays, TrendingUp, CreditCard, 
  ChevronLeft, ChevronRight, X, Tag
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

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
      const currentIncomes = transactions.filter(t => t.year === selectedYear && t.type === 'TAHSİLAT' && (t.status === 'APPROVED' || !t.status));

      for(let i=0; i<12; i++) {
          const expense = currentExpenses.filter(e => e.month === i + 1).reduce((sum, e) => sum + e.amount, 0);
          const income = currentIncomes.filter(t => t.month === i + 1).reduce((sum, t) => sum + t.credit, 0);
          result.push({
              name: new Date(0, i).toLocaleString('tr-TR', { month: 'short' }),
              Gelir: income,
              Gider: expense,
              Net: income - expense
          });
      }
      return result;
  };

  // --- ISTATISTIK ---
  const totalExpenseYear = getMatrixData().reduce((sum, item) => sum + item.total, 0);
  const maxExpenseItem = getMatrixData().length > 0 ? getMatrixData()[0] : null;
  const currentMonth = new Date().getMonth() + 1;
  const thisMonthExpense = expenses.filter(e => e.year === selectedYear && e.month === currentMonth).reduce((sum, e) => sum + e.amount, 0);

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

      {/* --- RAPORLAR (REPORT) --- */}
      {activeTab === 'REPORT' && (
          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow relative overflow-hidden">
                      <p className="text-xs text-slate-400 uppercase font-bold mb-1">Yıllık Gider</p>
                      <p className="text-2xl font-bold text-rose-400">{formatCurrency(totalExpenseYear)}</p>
                      <Wallet className="absolute bottom-2 right-2 w-12 h-12 text-slate-700 opacity-20"/>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow relative overflow-hidden">
                      <p className="text-xs text-slate-400 uppercase font-bold mb-1">En Yüksek</p>
                      <p className="text-xl font-bold text-white truncate">{maxExpenseItem ? maxExpenseItem.name : '-'}</p>
                      <p className="text-xs text-slate-500">{maxExpenseItem ? formatCurrency(maxExpenseItem.total) : ''}</p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow relative overflow-hidden">
                      <p className="text-xs text-slate-400 uppercase font-bold mb-1">Bu Ay</p>
                      <p className="text-2xl font-bold text-blue-400">{formatCurrency(thisMonthExpense)}</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col h-[300px]">
                      <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500"/> Gelir & Gider</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getBarData()} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <defs>
                                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }} formatter={(val:number) => formatCurrency(val)} />
                              <Legend verticalAlign="top" iconSize={10} wrapperStyle={{fontSize: '10px'}}/>
                              <Area type="monotone" dataKey="Gelir" stroke="#10b981" fill="url(#colorIncome)" />
                              <Area type="monotone" dataKey="Gider" stroke="#ef4444" fill="url(#colorExpense)" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-lg flex flex-col h-[300px]">
                      <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-500"/> Dağılım</h3>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={getPieData()} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                  {getPieData().map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }} formatter={(val:number) => formatCurrency(val)} />
                              <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '10px'}} />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Expenses;
