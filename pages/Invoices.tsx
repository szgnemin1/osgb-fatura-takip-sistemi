import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Transaction, TransactionType, InvoiceType } from '../types';
import { exporter } from '../services/exporter';
import { Receipt, CheckCircle, Trash2, History, FileDown, FileSpreadsheet } from 'lucide-react';

const Invoices = () => {
  const [pendingInvoices, setPendingInvoices] = useState<(Transaction & { firmName: string })[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [approvedInvoices, setApprovedInvoices] = useState<(Transaction & { firmName: string })[]>([]);

  const loadData = () => {
    const allTransactions = db.getTransactions();
    const allFirms = db.getFirms();
    const firmMap = new Map(allFirms.map(f => [f.id, f.name]));

    const allInvoices = allTransactions
      .filter(t => t.type === TransactionType.INVOICE)
      .map(t => ({
        ...t,
        firmName: firmMap.get(t.firmId) || 'Bilinmeyen Firma'
      }));

    setPendingInvoices(
      allInvoices
        .filter(t => t.status === 'PENDING')
        .sort((a, b) => a.firmName.localeCompare(b.firmName))
    );

    setApprovedInvoices(
      allInvoices
        .filter(t => t.status === 'APPROVED')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = (id: string) => {
    if (window.confirm('Bu faturayı onaylıyor musunuz? Onaylandıktan sonra cari hesaplara işlenecektir.')) {
      db.updateTransactionStatus(id, 'APPROVED');
      loadData();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bu taslak faturayı silmek istediğinize emin misiniz?')) {
      db.deleteTransaction(id);
      loadData();
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('tr-TR');

  const handleExportExcel = () => {
    const dataToExport = [...pendingInvoices, ...(showHistory ? approvedInvoices : [])].map(inv => ({
      'Firma Adı': inv.firmName,
      'Uzman Hakediş': inv.calculatedDetails?.expertShare || 0,
      'Doktor Hakediş': inv.calculatedDetails?.doctorShare || 0,
      'Fatura Tutarı': inv.debt,
      'Fatura Tipi': inv.invoiceType,
      'Durum': inv.status === 'PENDING' ? 'Bekliyor' : 'Onaylandı',
      'Tarih': new Date(inv.date).toLocaleDateString('tr-TR'),
      'Açıklama': inv.description
    }));

    exporter.exportToExcel('Detayli_Fatura_Listesi', dataToExport);
  };

  const handleExportPDF = () => {
    const dataToExport = [...pendingInvoices, ...(showHistory ? approvedInvoices : [])].map(inv => [
      inv.firmName,
      formatCurrency(inv.calculatedDetails?.expertShare || 0),
      formatCurrency(inv.calculatedDetails?.doctorShare || 0),
      formatCurrency(inv.debt),
      inv.invoiceType || '-',
      inv.status === 'PENDING' ? 'Bekliyor' : 'Onaylandı'
    ]);

    exporter.exportToPDF(
      'Detaylı Fatura Listesi',
      ['Firma Adı', 'Uzman Hakediş', 'Dr. Hakediş', 'Fatura Tutarı', 'Tip', 'Durum'],
      dataToExport,
      'Detayli_Fatura_Listesi'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-blue-500" />
            Kesilecek Faturalar
          </h2>
          <p className="text-slate-400 mt-2">Onay bekleyen taslak faturaları yönetin.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-rose-700 hover:bg-rose-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showHistory ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <History className="w-4 h-4" />
            {showHistory ? 'Geçmişi Gizle' : 'Geçmişi Göster'}
          </button>
        </div>
      </header>

      {/* Bekleyen Faturalar (PENDING) */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl mb-8">
        <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2">
                Bekleyen Onaylar
                <span className="bg-yellow-500/20 text-yellow-500 text-xs py-0.5 px-2 rounded-full">{pendingInvoices.length}</span>
            </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700">
                <th className="p-4 text-slate-400 font-medium">Firma Adı</th>
                <th className="p-4 text-slate-400 font-medium">Uzman Hakediş</th>
                <th className="p-4 text-slate-400 font-medium">Doktor Hakediş</th>
                <th className="p-4 text-slate-400 font-medium text-right">Fatura Tutarı</th>
                <th className="p-4 text-slate-400 font-medium text-center">Fatura Tipi</th>
                <th className="p-4 text-slate-400 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {pendingInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 font-medium text-slate-200">
                    {inv.firmName}
                    <div className="text-xs text-slate-500">{inv.description}</div>
                  </td>
                  <td className="p-4 text-slate-400">
                    {formatCurrency(inv.calculatedDetails?.expertShare || 0)}
                  </td>
                  <td className="p-4 text-slate-400">
                    {formatCurrency(inv.calculatedDetails?.doctorShare || 0)}
                  </td>
                  <td className="p-4 text-right font-bold text-slate-200">
                    {formatCurrency(inv.debt)}
                  </td>
                  <td className="p-4 text-center">
                    <select 
                      defaultValue={inv.invoiceType || InvoiceType.E_FATURA}
                      className="bg-slate-900 border border-slate-600 text-xs text-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                    >
                      <option value={InvoiceType.E_FATURA}>E-Fatura</option>
                      <option value={InvoiceType.E_ARSIV}>E-Arşiv</option>
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={() => handleDelete(inv.id)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Sil">
                            <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => handleApprove(inv.id)}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors shadow-lg shadow-emerald-900/20" title="Onayla ve Resmileştir">
                            <CheckCircle className="w-4 h-4" />
                            Onayla
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
               {pendingInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Onay bekleyen fatura yok. Fatura Hazırlık sayfasından yeni fatura oluşturabilirsiniz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onaylanmış Geçmiş (Opsiyonel) */}
      {showHistory && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden opacity-75">
            <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-slate-400">Geçmiş Faturalar</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700 text-xs">
                    <th className="p-4 text-slate-500">Firma</th>
                    <th className="p-4 text-slate-500">Tarih</th>
                    <th className="p-4 text-slate-500 text-right">Tutar</th>
                    <th className="p-4 text-slate-500 text-center">Tip</th>
                    <th className="p-4 text-slate-500 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {approvedInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="p-4 text-slate-400 text-sm">{inv.firmName}</td>
                      <td className="p-4 text-slate-500 text-sm">{formatDate(inv.date)}</td>
                      <td className="p-4 text-right text-slate-400 text-sm">{formatCurrency(inv.debt)}</td>
                      <td className="p-4 text-center text-slate-500 text-sm">{inv.invoiceType || '-'}</td>
                      <td className="p-4 text-center">
                        <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full">Onaylandı</span>
                      </td>
                    </tr>
                  ))}
                  {approvedInvoices.length === 0 && (
                     <tr><td colSpan={5} className="p-4 text-center text-slate-500 text-sm">Geçmiş kayıt yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      )}

    </div>
  );
};

export default Invoices;