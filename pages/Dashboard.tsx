import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { DollarSign, FileCheck, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0, balance: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const s = db.getStats();
    setStats(s);

    const transactions = db.getTransactions();
    // Group by month for last 6 months - ONLY APPROVED
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { month: d.getMonth() + 1, year: d.getFullYear(), name: d.toLocaleString('tr-TR', { month: 'short' }) };
    }).reverse();

    const data = last6Months.map(m => {
      const monthTrans = transactions.filter(t => 
        t.month === m.month && 
        t.year === m.year &&
        (t.status === 'APPROVED' || t.status === undefined) // Sadece onaylıları grafikte göster
      );
      return {
        name: m.name,
        Faturalanan: monthTrans.reduce((sum, t) => sum + t.debt, 0),
        Tahsilat: monthTrans.reduce((sum, t) => sum + t.credit, 0)
      };
    });
    setChartData(data);
  }, []);

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold text-slate-100">Genel Bakış</h2>
        <p className="text-slate-400 mt-1">Finansal durum özeti ve istatistikler</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-24 h-24 text-emerald-500" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-300">Kasa Bakiyesi</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{formatCurrency(stats.balance)}</p>
          <p className="text-sm text-slate-500 mt-2">Toplam Tahsilat</p>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileCheck className="w-24 h-24 text-blue-500" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
              <FileCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-300">Kesilen Faturalar</h3>
          </div>
          <p className="text-3xl font-bold text-blue-400">{formatCurrency(stats.totalBilled)}</p>
          <p className="text-sm text-slate-500 mt-2">Toplam Hakediş (Onaylı)</p>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-24 h-24 text-purple-500" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
              <DollarSign className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-300">Yapılan Tahsilat</h3>
          </div>
          <p className="text-3xl font-bold text-purple-400">{formatCurrency(stats.totalCollected)}</p>
          <p className="text-sm text-slate-500 mt-2">Bankaya Giren</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-slate-200 mb-6">Son 6 Ay Finansal Hareket (Onaylı)</h3>
        <div className="w-full h-80 min-h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="Faturalanan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Tahsilat" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;