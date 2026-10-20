
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingDown, AlertTriangle, Filter } from 'lucide-react';

interface DebtorFirm {
  id: string;
  name: string;
  balance: number;
  lastPaymentDate: Date | null;
  monthsUnpaid: number;
}

const DebtTracking = () => {
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<DebtorFirm[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null); // 1 to 12 (12 means 12+)

  useEffect(() => {
    const firms = db.getFirms();
    const transactions = db.getTransactions();
    const calculatedDebtors: DebtorFirm[] = [];

    firms.forEach(firm => {
      // Sadece onaylı işlemleri al
      const firmTrans = transactions.filter(t => t.firmId === firm.id && (t.status === 'APPROVED' || !t.status));
      
      const totalDebt = firmTrans.reduce((sum, t) => sum + t.debt, 0);
      const totalCredit = firmTrans.reduce((sum, t) => sum + t.credit, 0);
      const balance = totalDebt - totalCredit;

      // Sadece borcu olanları listeye al (1 TL altı küsuratları önemseme)
      if (balance > 1) {
        // Son ödeme tarihini bul
        const payments = firmTrans.filter(t => t.type === 'TAHSİLAT' || t.type === 'ÇEK').map(t => new Date(t.date).getTime());
        const lastPaymentTime = payments.length > 0 ? Math.max(...payments) : null;
        
        // Eğer hiç ödeme yapmadıysa, ilk faturanın tarihini baz al (Borçlanma başlangıcı)
        const invoices = firmTrans.filter(t => t.type === 'FATURA').map(t => new Date(t.date).getTime());
        const firstInvoiceTime = invoices.length > 0 ? Math.min(...invoices) : new Date().getTime();

        const referenceTime = lastPaymentTime || firstInvoiceTime;
        const now = new Date().getTime();
        
        // Ay farkını hesapla (Yaklaşık 30 gün)
        const diffDays = (now - referenceTime) / (1000 * 60 * 60 * 24);
        const monthsUnpaid = Math.max(1, Math.ceil(diffDays / 30));

        calculatedDebtors.push({
          id: firm.id,
          name: firm.name,
          balance,
          lastPaymentDate: lastPaymentTime ? new Date(lastPaymentTime) : null,
          monthsUnpaid
        });
      }
    });

    // Sort by balance desc
    calculatedDebtors.sort((a, b) => b.balance - a.balance);
    setDebtors(calculatedDebtors);

    // Chart Data Preparation (1 to 12 Months)
    const newChartData = [];
    for (let i = 1; i <= 12; i++) {
        let count = 0;
        let name = `${i} Ay`;
        
        if (i === 12) {
            count = calculatedDebtors.filter(d => d.monthsUnpaid >= 12).length;
            name = "12+ Ay";
        } else {
            count = calculatedDebtors.filter(d => d.monthsUnpaid === i).length;
        }

        newChartData.push({ name, count, id: i });
    }
    setChartData(newChartData);

  }, []);

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  // Kademeli Listeleme Fonksiyonu
  const renderTier = (min: number, max: number, title: string, colorClass: string) => {
    const list = debtors.filter(d => d.balance >= min && d.balance <= max);
    if (list.length === 0) return null;

    return (
      <div className="mb-6">
        <h4 className={`text-sm font-bold uppercase tracking-wider mb-2 ${colorClass} border-b border-slate-700 pb-1 flex justify-between`}>
          <span>{title}</span>
          <span>{list.length} Firma</span>
        </h4>
        <div className="space-y-1">
          {list.map(firm => (
            <div 
              key={firm.id} 
              onClick={() => navigate('/details', { state: { selectedFirmId: firm.id } })}
              className="flex justify-between items-center text-sm p-2 bg-slate-800/50 hover:bg-slate-700 cursor-pointer rounded transition-colors"
            >
              <span className="text-slate-300 truncate w-32" title={firm.name}>{firm.name}</span>
              <span className="font-mono font-medium text-slate-200">{formatCurrency(firm.balance)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filteredDebtors = selectedDuration 
    ? debtors.filter(d => selectedDuration === 12 ? d.monthsUnpaid >= 12 : d.monthsUnpaid === selectedDuration)
    : debtors;

  // Bar rengini belirleme (Risk seviyesine göre)
  const getBarColor = (id: number) => {
      if (selectedDuration === id) return '#f43f5e'; // Seçiliyse Parlak Pembe
      if (id >= 10) return '#ef4444'; // 10-12 Ay: Kırmızı
      if (id >= 7) return '#f97316';  // 7-9 Ay: Turuncu
      if (id >= 4) return '#eab308';  // 4-6 Ay: Sarı
      return '#3b82f6';               // 1-3 Ay: Mavi
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-6 animate-in fade-in duration-500">
      
      {/* SOL TARAF: GRAFİK VE DETAY LİSTESİ */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <header>
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-rose-500" />
            Borç Takip ve Yaşlandırma
          </h2>
          <p className="text-slate-400 mt-2">Ödenmeyen bakiyelerin süre analizi (12 Aylık Projeksiyon).</p>
        </header>

        {/* GRAFİK */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg h-80">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-500" />
            Borç Yaşlandırma Analizi (Firma Sayısı)
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} onClick={(data) => setSelectedDuration(data?.activePayload?.[0]?.payload?.id || null)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 10}} />
              <YAxis stroke="#94a3b8" allowDecimals={false} />
              <Tooltip 
                cursor={{fill: '#1e293b'}}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer">
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.id)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 text-center mt-2">Detayları görmek için sütunlara tıklayınız.</p>
        </div>

        {/* SEÇİLEN KATEGORİ DETAYI */}
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
             <h3 className="font-bold text-slate-200 flex items-center gap-2">
               {selectedDuration 
                 ? `${selectedDuration === 12 ? '12 aydan uzun' : selectedDuration + ' aydır'} süredir ödeme yapmayanlar`
                 : 'Tüm Borçlu Firmalar'}
             </h3>
             {selectedDuration && (
               <button onClick={() => setSelectedDuration(null)} className="text-xs text-blue-400 hover:text-blue-300">Filtreyi Temizle</button>
             )}
          </div>
          <div className="flex-1 overflow-auto p-0">
             <table className="w-full text-left table-fixed">
               <thead className="bg-slate-900 text-[10px] sm:text-xs uppercase text-slate-400 sticky top-0">
                 <tr>
                   <th className="p-3">Firma Adı</th>
                   <th className="p-3 text-right w-20 sm:w-24">Borç Süresi</th>
                   <th className="p-3 text-right w-20 sm:w-24">Son Ödeme</th>
                   <th className="p-3 text-right w-20 sm:w-24">Bakiye</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-700">
                 {filteredDebtors.map(firm => (
                   <tr 
                     key={firm.id} 
                     onClick={() => navigate('/details', { state: { selectedFirmId: firm.id } })}
                     className="hover:bg-slate-700/50 cursor-pointer transition-colors"
                   >
                     <td className="p-3 text-slate-300 text-xs sm:text-sm overflow-hidden">
                       <div className="truncate" title={firm.name}>{firm.name}</div>
                     </td>
                     <td className="p-3 text-right">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${
                         firm.monthsUnpaid >= 10 ? 'bg-rose-500/20 text-rose-400' : 
                         firm.monthsUnpaid >= 7 ? 'bg-orange-500/20 text-orange-400' :
                         firm.monthsUnpaid >= 4 ? 'bg-yellow-500/20 text-yellow-400' :
                         'bg-blue-500/20 text-blue-400'
                       }`}>
                         {firm.monthsUnpaid} Ay
                       </span>
                     </td>
                     <td className="p-3 text-right text-slate-400 text-sm">
                       {firm.lastPaymentDate ? firm.lastPaymentDate.toLocaleDateString('tr-TR') : 'Hiç Yok'}
                     </td>
                     <td className="p-3 text-right font-bold text-slate-200 text-sm">
                       {formatCurrency(firm.balance)}
                     </td>
                   </tr>
                 ))}
                 {filteredDebtors.length === 0 && (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* SAĞ TARAF: KADEMELİ LİSTE */}
      <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col p-4 overflow-hidden">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Borç Sıralaması
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {renderTier(60000, 999999999, '60.000 TL ve Üzeri', 'text-rose-500')}
          {renderTier(40000, 59999, '40.000 TL - 59.999 TL', 'text-orange-500')}
          {renderTier(20000, 39999, '20.000 TL - 39.999 TL', 'text-yellow-500')}
          {renderTier(10000, 19999, '10.000 TL - 19.999 TL', 'text-blue-400')}
          {renderTier(1000, 9999, '1.000 TL - 9.999 TL', 'text-slate-400')}
          {renderTier(0, 999, '0 TL - 999 TL', 'text-slate-500')}
        </div>
      </div>

    </div>
  );
};

export default DebtTracking;
