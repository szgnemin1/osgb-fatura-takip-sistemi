
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../services/db';
import { Firm, Transaction, TransactionType, InvoiceType } from '../types';
import { exporter } from '../services/exporter';
import { FileText, Search, PlusCircle, ArrowDownLeft, ArrowUpRight, Building2, Download, Table, ArrowLeft, Wallet, ChevronRight, MinusCircle, Pencil, Trash2, CheckCircle2, Clock, FileCheck, AlertCircle } from 'lucide-react';

const FirmDetails = () => {
  const location = useLocation();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [activeModal, setActiveModal] = useState<'PAYMENT' | 'DEBT' | 'CHEQUE' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // Düzenlenen işlem ID
  const [amount, setAmount] = useState('');
  const [transDate, setTransDate] = useState('');
  const [description, setDescription] = useState('');
  
  // Çek Alanları
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showPortfoyCheques, setShowPortfoyCheques] = useState(false);

  useEffect(() => {
    setFirms(db.getFirms());
    if (location.state?.selectedFirmId) {
        setSelectedFirmId(location.state.selectedFirmId);
    }
  }, [location.state]);

  useEffect(() => {
    if (selectedFirmId) {
      const all = db.getTransactions();
      const filtered = all
        .filter(t => t.firmId === selectedFirmId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTransactions(filtered);
    } else {
      setTransactions([]);
    }
  }, [selectedFirmId, activeModal, editingId]); // editingId değişince de yenile (silme sonrası vb)

  const filteredFirms = firms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleApproveCheque = (id: string) => {
    const t = transactions.find(item => item.id === id);
    if (!t) return;
    const confirmMsg = `${t.bankName ? t.bankName + ' - ' : ''}Çek No: ${t.chequeNumber || id} olan ${formatCurrency(t.credit)} tutarındaki çekin tahsilatını onaylıyor musunuz?\n\nBu işlem cari hesaba tahsilat (alacak) olarak işlenecektir.`;
    if (window.confirm(confirmMsg)) {
      const updated: Transaction = {
        ...t,
        chequeStatus: 'COLLECTED',
        status: 'APPROVED',
        credit: t.credit || 0
      };
      db.updateTransaction(updated);
      setTransactions(prev => prev.map(item => item.id === id ? updated : item));
    }
  };

  const openModal = (type: 'PAYMENT' | 'DEBT' | 'CHEQUE', transaction?: Transaction) => {
    setActiveModal(type);
    
    if (transaction) {
        // DÜZENLEME MODU
        setEditingId(transaction.id);
        setAmount(transaction.type === TransactionType.INVOICE ? transaction.debt.toString() : transaction.credit.toString());
        setTransDate(new Date(transaction.date).toISOString().split('T')[0]);
        setDescription(transaction.description);
        setBankName(transaction.bankName || '');
        setChequeNumber(transaction.chequeNumber || '');
        setDueDate(transaction.dueDate || '');
    } else {
        // YENİ EKLEME MODU
        setEditingId(null);
        setAmount('');
        setTransDate(new Date().toISOString().split('T')[0]); 
        setBankName('');
        setChequeNumber('');
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setDueDate(nextMonth.toISOString().split('T')[0]);
        setDescription(type === 'PAYMENT' ? 'Tahsilat' : (type === 'CHEQUE' ? 'Firma Çeki' : 'Borç Dekontu / Manuel İşlem'));
    }
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFirmId || !amount || !transDate) return;
    if (activeModal === 'CHEQUE' && !dueDate) {
      alert("Lütfen çekin vade tarihini giriniz.");
      return;
    }

    const dateObj = new Date(transDate);
    const numAmount = Number(amount);
    const todayStr = new Date().toISOString().split('T')[0];

    if (editingId) {
        // GÜNCELLEME
        const existing = transactions.find(t => t.id === editingId);
        if (existing) {
            const updated: Transaction = {
                ...existing,
                date: dateObj.toISOString(),
                description: description,
                month: dateObj.getMonth() + 1,
                year: dateObj.getFullYear(),
                debt: activeModal === 'DEBT' ? numAmount : 0,
                credit: (activeModal === 'PAYMENT' || activeModal === 'CHEQUE') ? numAmount : 0,
                bankName: activeModal === 'CHEQUE' ? bankName : existing.bankName,
                chequeNumber: activeModal === 'CHEQUE' ? chequeNumber : existing.chequeNumber,
                dueDate: activeModal === 'CHEQUE' ? dueDate : existing.dueDate
            };
            db.updateTransaction(updated);
        }
    } else {
        // YENİ KAYIT
        if (activeModal === 'CHEQUE') {
            const initialStatus = dueDate <= todayStr ? 'PENDING_APPROVAL' : 'PORTFOY';
            db.addTransaction({
              firmId: selectedFirmId,
              date: dateObj.toISOString(),
              type: TransactionType.CHEQUE,
              description: description || `Çek: ${bankName ? bankName + ' ' : ''}${chequeNumber ? '(' + chequeNumber + ') ' : ''}- Vade: ${new Date(dueDate).toLocaleDateString('tr-TR')}`,
              debt: 0,
              credit: numAmount,
              month: dateObj.getMonth() + 1,
              year: dateObj.getFullYear(),
              status: 'PENDING',
              dueDate: dueDate,
              chequeNumber: chequeNumber,
              bankName: bankName,
              chequeStatus: initialStatus
            });
        } else {
            db.addTransaction({
              firmId: selectedFirmId,
              date: dateObj.toISOString(),
              type: activeModal === 'PAYMENT' ? TransactionType.PAYMENT : TransactionType.INVOICE,
              description: description,
              debt: activeModal === 'DEBT' ? numAmount : 0,
              credit: activeModal === 'PAYMENT' ? numAmount : 0,
              month: dateObj.getMonth() + 1,
              year: dateObj.getFullYear(),
              status: 'APPROVED'
            });
        }
    }

    setActiveModal(null);
    setEditingId(null);
    setAmount('');
    setDescription('');
    setBankName('');
    setChequeNumber('');
    setDueDate('');
  };

  const handleDeleteTransaction = (id: string) => {
      if(window.confirm("Bu cari hareketi silmek istediğinize emin misiniz?")) {
          db.deleteTransaction(id);
          // State'i güncellemek için editingId trigger'ını kullanabiliriz veya transaction listesini tekrar çekebiliriz
          // Ancak useEffect dependency array'e transaction değişikliğini eklemedik, manuel filtreleme yapalım:
          setTransactions(prev => prev.filter(t => t.id !== id));
      }
  };

  const exportSingleFirm = () => {
    const firm = firms.find(f => f.id === selectedFirmId);
    if (!firm) return;

    const reportTrans = transactions.filter(t => {
      if (t.type === TransactionType.CHEQUE) return t.chequeStatus === 'COLLECTED';
      return t.status === 'APPROVED' || !t.status;
    });

    const data: any[] = reportTrans.map(t => ({
      'Ay/Yıl': `${new Date(0, t.month - 1).toLocaleString('tr-TR', { month: 'long' })} ${t.year}`,
      'Tarih': new Date(t.date).toLocaleDateString('tr-TR'),
      'Açıklama': t.description,
      'Borç': t.debt,
      'Alacak': t.credit
    }));

    const totalBilled = reportTrans.filter(t => t.type === TransactionType.INVOICE).reduce((sum, t) => sum + t.debt, 0);
    const totalPaid = reportTrans.reduce((sum, t) => sum + t.credit, 0);
    const balance = totalBilled - totalPaid;

    data.push({
      'Ay/Yıl': 'TOPLAM',
      'Tarih': '',
      'Açıklama': '',
      'Borç': totalBilled,
      'Alacak': totalPaid
    });

    data.push({
      'Ay/Yıl': 'GÜNCEL BAKİYE',
      'Tarih': '',
      'Açıklama': '',
      'Borç': '',
      'Alacak': balance
    });

    exporter.exportToExcel(`${firm.name}_Ekstre`, data);
  };

  const exportBulkBalances = () => {
    const allTrans = db.getTransactions();
    const data = firms.map(firm => {
      const firmTrans = allTrans.filter(t => {
        if (t.firmId !== firm.id) return false;
        if (t.type === TransactionType.CHEQUE) return t.chequeStatus === 'COLLECTED';
        return t.status === 'APPROVED' || !t.status;
      });
      const billed = firmTrans.filter(t => t.type === TransactionType.INVOICE).reduce((sum, t) => sum + t.debt, 0);
      const paid = firmTrans.reduce((sum, t) => sum + t.credit, 0);
      const bal = billed - paid;

      return {
        'Firma Adı': firm.name,
        'Toplam Faturalanan': billed,
        'Toplam Tahsilat': paid,
        'Kalan Bakiye': bal,
        'Durum': bal > 0 ? 'Borçlu' : 'Alacaklı/Kapalı'
      };
    });

    exporter.exportToExcel('Tum_Firmalar_Bakiye_Raporu', data);
  };

  const exportSingleFirmPDF = () => {
    const firm = firms.find(f => f.id === selectedFirmId);
    if (!firm) return;

    // Türkçe karakterleri İngilizce'ye çeviren yardımcı fonksiyon
    const replaceTR = (text: string) => {
      if (!text) return '';
      return text
        .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
        .replace(/Ü/g, 'U').replace(/ü/g, 'u')
        .replace(/Ş/g, 'S').replace(/ş/g, 's')
        .replace(/İ/g, 'I').replace(/ı/g, 'i')
        .replace(/Ö/g, 'O').replace(/ö/g, 'o')
        .replace(/Ç/g, 'C').replace(/ç/g, 'c');
    };

    const reportTrans = transactions.filter(t => {
      if (t.type === TransactionType.CHEQUE) return t.chequeStatus === 'COLLECTED';
      return t.status === 'APPROVED' || !t.status;
    });

    const data = reportTrans.map(t => [
      replaceTR(`${new Date(0, t.month - 1).toLocaleString('tr-TR', { month: 'long' })} ${t.year}`),
      new Date(t.date).toLocaleDateString('tr-TR'),
      replaceTR(t.description),
      t.debt > 0 ? t.debt.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL' : '-',
      t.credit > 0 ? t.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL' : '-'
    ]);

    const totalBilled = reportTrans.filter(t => t.type === TransactionType.INVOICE).reduce((sum, t) => sum + t.debt, 0);
    const totalPaid = reportTrans.reduce((sum, t) => sum + t.credit, 0);
    const balance = totalBilled - totalPaid;

    import('jspdf').then(({ default: jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185); // Blue color for header
        doc.text("CARI HESAP EKSTRESI", 14, 22);

        // Subheader - Firm details
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "bold");
        doc.text("Firma:", 14, 32);
        doc.setFont("helvetica", "normal");
        const firmName = doc.splitTextToSize(replaceTR(firm.name), 100);
        doc.text(firmName, 30, 32);
        
        doc.setFont("helvetica", "bold");
        doc.text("Tarih:", 14, 42 + (firmName.length - 1) * 5);
        doc.setFont("helvetica", "normal");
        doc.text(new Date().toLocaleDateString('tr-TR'), 30, 42 + (firmName.length - 1) * 5);

        // Summary Box (Right aligned)
        const summaryY = 22;
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(120, summaryY, 75, 28, 2, 2, 'FD');
        
        doc.setFontSize(10);
        doc.text("Toplam Borc:", 125, summaryY + 7);
        doc.text("Toplam Odenen:", 125, summaryY + 14);
        doc.setFont("helvetica", "bold");
        doc.text("GUNCEL BAKIYE:", 125, summaryY + 23);

        doc.setFont("helvetica", "normal");
        doc.text(`${totalBilled.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`, 190, summaryY + 7, { align: 'right' });
        doc.text(`${totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`, 190, summaryY + 14, { align: 'right' });
        
        doc.setFont("helvetica", "bold");
        if (balance > 0) {
            doc.setTextColor(220, 38, 38); // Red
            doc.text(`${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (Borclu)`, 190, summaryY + 23, { align: 'right' });
        } else if (balance < 0) {
            doc.setTextColor(5, 150, 105); // Green
            doc.text(`${Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (Alacakli)`, 190, summaryY + 23, { align: 'right' });
        } else {
            doc.setTextColor(50, 50, 50); // Gray/Black
            doc.text("0.00 TL", 190, summaryY + 23, { align: 'right' });
        }
        
        doc.setTextColor(0, 0, 0); // Reset text color

        (doc as any).autoTable({
          startY: 55 + (firmName.length - 1) * 5,
          head: [['Ay/Yil', 'Islem Tarihi', 'Aciklama', 'Borc (Fatura)', 'Alacak (Odeme)']],
          body: data,
          styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          },
          theme: 'grid',
          margin: { top: 10, left: 14, right: 14 },
          foot: [[
            'TOPLAM', 
            '', 
            '', 
            `${totalBilled.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`, 
            `${totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
          ]],
          footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' },
          didParseCell: function(data: any) {
            // Apply right alignment to footer columns 3 and 4
            if (data.section === 'foot') {
              if (data.column.index === 0) data.cell.styles.halign = 'left';
            }
          }
        });

        // Add page numbers
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Sayfa ${i} / ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }

        doc.save(`${replaceTR(firm.name).replace(/\s+/g, '_')}_Cari_Ekstre.pdf`);
      });
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Portföydeki vadeli çekler (günü henüz gelmemiş ve tahsil edilmemiş olanlar)
  const portfoyCheques = transactions.filter(t => 
    t.type === TransactionType.CHEQUE && 
    t.chequeStatus !== 'COLLECTED' && 
    t.dueDate && 
    t.dueDate > todayStr
  );

  // Vadesi gelmiş ve tahsilat onayı bekleyen çekler
  const duePendingCheques = transactions.filter(t => 
    t.type === TransactionType.CHEQUE && 
    t.chequeStatus !== 'COLLECTED' && 
    (!t.dueDate || t.dueDate <= todayStr)
  );

  // Tabloda gösterilecek hareketler:
  // - Onaylı fatura ve normal tahsilatlar
  // - Tahsil edilmiş çekler
  // - Vadesi gelmiş ve onay bekleyen çekler
  // - Kullanıcı "Vadeli Çekleri Göster" derse portföydeki vadesi gelmemiş çekler
  const visibleTransactions = transactions.filter(t => {
    if (t.type === TransactionType.CHEQUE) {
      if (t.chequeStatus === 'COLLECTED') return true;
      if (!t.dueDate || t.dueDate <= todayStr) return true;
      return showPortfoyCheques;
    }
    return t.status === 'APPROVED' || !t.status;
  });

  const totalBilled = transactions
    .filter(t => t.type === TransactionType.INVOICE)
    .reduce((sum, t) => sum + t.debt, 0);

  // Sadece tahsilatı kesinleşmiş işlemler (normal tahsilat veya tahsil edilmiş çek)
  const totalPaid = transactions
    .filter(t => (t.type === TransactionType.PAYMENT && (t.status === 'APPROVED' || !t.status)) || (t.type === TransactionType.CHEQUE && t.chequeStatus === 'COLLECTED'))
    .reduce((sum, t) => sum + t.credit, 0);

  const selectedFirm = useMemo(() => firms.find(f => f.id === selectedFirmId), [firms, selectedFirmId]);

  const allTrans = db.getTransactions();
  const firmBalances = useMemo(() => {
    const map: Record<string, number> = {};
    firms.forEach(f => {
      const fTrans = allTrans.filter(t => {
        if (t.firmId !== f.id) return false;
        if (t.type === TransactionType.CHEQUE) return t.chequeStatus === 'COLLECTED';
        return t.status === 'APPROVED' || !t.status;
      });
      const billed = fTrans.filter(t => t.type === TransactionType.INVOICE).reduce((s, t) => s + t.debt, 0);
      const paid = fTrans.reduce((s, t) => s + t.credit, 0);
      map[f.id] = billed - paid;
    });
    return map;
  }, [firms, allTrans]);

  const balance = totalBilled - totalPaid;

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('tr-TR');

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col space-y-3 animate-in fade-in duration-300">
      
      {/* HEADER (Mobilde Seçim Yapılınca Gizlenir) */}
      <header className={`flex justify-between items-center ${selectedFirmId ? 'hidden md:flex' : 'flex'}`}>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-purple-400" />
            Cari Hesap Detayı (Ekstre)
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Firmaların hesap hareketleri, faturaları, tahsilatları ve vadeli çek takibi.</p>
        </div>
        <button 
          onClick={exportBulkBalances}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg flex items-center gap-2 text-xs font-semibold transition-colors border border-slate-700 shadow-sm"
        >
          <Table className="w-4 h-4 text-blue-400" />
          <span>Tüm Bakiye Raporu</span>
        </button>
      </header>

      <div className="flex flex-col md:grid md:grid-cols-12 gap-4 flex-1 min-h-0 relative">
        
        {/* SOL LİSTE: FİRMALAR */}
        <div className={`md:col-span-4 lg:col-span-3 bg-slate-800/90 border border-slate-700/80 rounded-xl flex flex-col overflow-hidden shadow-sm ${selectedFirmId ? 'hidden md:flex' : 'flex h-full'}`}>
          <div className="p-3 border-b border-slate-700/80 bg-slate-850 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder={`Firma Ara (${filteredFirms.length})...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {filteredFirms.map(firm => {
              const bakiye = firmBalances[firm.id] || 0;
              const isSelected = selectedFirmId === firm.id;
              return (
                <button
                  key={firm.id}
                  onClick={() => setSelectedFirmId(firm.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between gap-2 border ${
                    isSelected 
                      ? 'bg-blue-600/15 border-blue-500/40 text-white shadow-sm' 
                      : 'border-transparent text-slate-300 hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs truncate ${isSelected ? 'font-bold text-blue-300' : 'font-medium'}`}>
                      {firm.name}
                    </span>
                    <span className={`text-[11px] font-mono mt-0.5 ${
                      bakiye > 0 ? 'text-rose-400 font-semibold' : bakiye < 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'
                    }`}>
                      {bakiye > 0 ? `${formatCurrency(bakiye)} Borçlu` : bakiye < 0 ? `${formatCurrency(Math.abs(bakiye))} Alacaklı` : '0 TL (Kapalı)'}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-blue-400 translate-x-0.5' : 'text-slate-600'}`} />
                </button>
              );
            })}
            {filteredFirms.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-xs">Arama kriterine uygun firma bulunamadı.</div>
            )}
          </div>
        </div>

        {/* SAĞ DETAY: CARİ HESAP EKSTRESİ */}
        <div className={`md:col-span-8 lg:col-span-9 bg-slate-800/90 border border-slate-700/80 rounded-xl flex flex-col overflow-hidden relative h-full shadow-sm ${selectedFirmId ? 'flex' : 'hidden md:flex'}`}>
          {selectedFirmId ? (
            <>
              {/* 1. ÜST PANEL: FİRMA BAŞLIĞI VE BUTONLAR */}
              <div className="p-3.5 border-b border-slate-700/80 bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedFirmId('')} className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white truncate max-w-[220px] sm:max-w-md">
                        {selectedFirm?.name}
                      </h3>
                      {balance > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                          Borçlu
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                          Bakiye Kapalı
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {selectedFirm?.taxNumber ? `Vergi/TC No: ${selectedFirm.taxNumber}` : 'Cari Hesap Hareketleri'}
                    </span>
                  </div>
                </div>

                {/* Buton Grubu */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                  {/* Export Butonları */}
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                    <button 
                      onClick={exportSingleFirmPDF}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                      title="PDF Ekstre İndir"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={exportSingleFirm}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                      title="Excel Ekstre İndir"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  <button 
                    onClick={() => openModal('PAYMENT')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Tahsilat Ekle</span>
                  </button>

                  <button 
                    onClick={() => openModal('CHEQUE')}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Çek Ekle</span>
                  </button>

                  <button 
                    onClick={() => openModal('DEBT')}
                    className="bg-rose-700/80 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>Borç Ekle</span>
                  </button>
                </div>
              </div>

              {/* 2. ÖZET KARTLARI (SAYFA BAŞINDA ŞIK VE MİNİMALİST) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-3.5 bg-slate-900/40 border-b border-slate-700/60">
                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Fatura</span>
                  <span className="text-base font-bold text-rose-400 font-mono mt-0.5 block">{formatCurrency(totalBilled)}</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Tahsilat</span>
                  <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">{formatCurrency(totalPaid)}</span>
                </div>

                <div className={`border rounded-xl p-3 ${
                  balance > 0 
                    ? 'bg-rose-950/20 border-rose-500/30' 
                    : 'bg-emerald-950/20 border-emerald-500/30'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Güncel Bakiye</span>
                  <span className={`text-base font-bold font-mono mt-0.5 block ${balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatCurrency(balance)}
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vadeli Çekler</span>
                    {portfoyCheques.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setShowPortfoyCheques(!showPortfoyCheques)}
                        className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 underline"
                      >
                        {showPortfoyCheques ? 'Gizle' : 'Göster'}
                      </button>
                    )}
                  </div>
                  <div className="text-xs font-semibold font-mono mt-1">
                    {duePendingCheques.length > 0 ? (
                      <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {duePendingCheques.length} Çek Onay Bekliyor
                      </span>
                    ) : portfoyCheques.length > 0 ? (
                      <span className="text-purple-300">
                        {portfoyCheques.length} Adet ({formatCurrency(portfoyCheques.reduce((s, c) => s + c.credit, 0))})
                      </span>
                    ) : (
                      <span className="text-slate-500 font-normal">Portföyde çek yok</span>
                    )}
                  </div>
                </div>
              </div>

              {/* UYARI BİLDİRİMİ (SADECE VADESİ GELMİŞ VE ONAY BEKLEYEN ÇEK VARSA) */}
              {duePendingCheques.length > 0 && (
                <div className="mx-3.5 mt-3 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs text-amber-300 gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                    <span>
                      Vadesi gelmiş <strong>{duePendingCheques.length} adet çek</strong> tahsilat onayı bekliyor.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                    {formatCurrency(duePendingCheques.reduce((s, c) => s + c.credit, 0))}
                  </span>
                </div>
              )}

              {/* 3. CARİ HAREKETLER TABLOSU */}
              <div className="flex-1 overflow-auto bg-slate-900/20 mt-1">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-900 z-10 shadow-sm border-b border-slate-700/80">
                    <tr>
                      <th className="py-2.5 px-3 md:px-4 text-slate-400 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap">Tarih</th>
                      <th className="py-2.5 px-3 md:px-4 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">İşlem / Açıklama</th>
                      <th className="py-2.5 px-3 md:px-4 text-slate-400 font-semibold text-[11px] uppercase tracking-wider text-right whitespace-nowrap">Borç</th>
                      <th className="py-2.5 px-3 md:px-4 text-slate-400 font-semibold text-[11px] uppercase tracking-wider text-right whitespace-nowrap">Tahsilat</th>
                      <th className="py-2.5 px-3 md:px-4 text-center w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40 text-xs">
                    {visibleTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-700/25 transition-colors group">
                        <td className="py-2.5 px-3 md:px-4 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                          {formatDate(t.date)}
                        </td>
                        <td className="py-2.5 px-3 md:px-4 text-slate-200">
                           <div className="flex items-center gap-2.5">
                               {t.type === TransactionType.INVOICE ? (
                                   <div className="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center shrink-0">
                                     <ArrowUpRight className="w-3.5 h-3.5 text-rose-400"/>
                                   </div>
                               ) : t.type === TransactionType.CHEQUE ? (
                                   <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                                     <FileCheck className="w-3.5 h-3.5 text-purple-400"/>
                                   </div>
                               ) : (
                                   <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                                     <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400"/>
                                   </div>
                               )}
                               <div className="flex flex-col min-w-0">
                                   <div className="flex items-center gap-2 flex-wrap">
                                       <span className="font-medium text-slate-200 line-clamp-1">{t.description}</span>
                                       {t.type === TransactionType.INVOICE && t.invoiceType && (
                                           <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${t.invoiceType === InvoiceType.E_FATURA ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'bg-orange-500/15 text-orange-300 border border-orange-500/20'}`}>
                                               {t.invoiceType === InvoiceType.E_FATURA ? 'E-Fatura' : 'E-Arşiv'}
                                           </span>
                                       )}
                                       {t.type === TransactionType.CHEQUE && (
                                           <>
                                               {t.chequeStatus === 'COLLECTED' ? (
                                                   <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                                                       <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Tahsil Edildi (Çek)
                                                   </span>
                                               ) : (!t.dueDate || t.dueDate <= todayStr) ? (
                                                   <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                                       <AlertCircle className="w-3 h-3 text-amber-400" /> Vadesi Geldi
                                                   </span>
                                               ) : (
                                                   <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/25 flex items-center gap-1">
                                                       <Clock className="w-3 h-3 text-purple-400" /> Portföyde (Vade: {formatDate(t.dueDate)})
                                                   </span>
                                               )}
                                           </>
                                       )}
                                   </div>
                                   {t.type === TransactionType.CHEQUE && t.chequeStatus !== 'COLLECTED' && (!t.dueDate || t.dueDate <= todayStr) && (
                                       <div className="mt-1 flex items-center gap-2">
                                           <button 
                                               type="button"
                                               onClick={() => handleApproveCheque(t.id)}
                                               className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                           >
                                               <CheckCircle2 className="w-3 h-3" />
                                               Tahsilatı Onayla
                                           </button>
                                           <span className="text-[10px] text-amber-300/70">
                                               (Onaylanana kadar bakiyeden düşülmez)
                                           </span>
                                       </div>
                                   )}
                               </div>
                           </div>
                        </td>
                        <td className="py-2.5 px-3 md:px-4 text-right font-mono font-medium whitespace-nowrap text-rose-400">
                          {t.debt > 0 ? formatCurrency(t.debt) : <span className="text-slate-600 font-normal">-</span>}
                        </td>
                        <td className="py-2.5 px-3 md:px-4 text-right font-mono font-medium whitespace-nowrap">
                          {t.type === TransactionType.CHEQUE ? (
                            t.chequeStatus === 'COLLECTED' ? (
                              <span className="text-emerald-400">{formatCurrency(t.credit)}</span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="text-slate-500 line-through text-[11px]">{formatCurrency(t.credit)}</span>
                                <span className="text-[10px] text-amber-400/90 font-sans">(Onay Bekliyor)</span>
                              </div>
                            )
                          ) : (
                            t.credit > 0 ? <span className="text-emerald-400">{formatCurrency(t.credit)}</span> : <span className="text-slate-600 font-normal">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 md:px-4 text-center">
                            <div className="flex justify-end items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {t.type === TransactionType.INVOICE && (
                                  <button 
                                      onClick={() => {
                                        setEditingId(null);
                                        setAmount(t.debt.toString());
                                        setTransDate(new Date().toISOString().split('T')[0]);
                                        setDescription('Tahsilat - ' + t.description);
                                        setActiveModal('PAYMENT');
                                      }} 
                                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded transition-colors" 
                                      title="Fatura Ödendi (Tahsilat Ekle)"
                                  >
                                      <PlusCircle className="w-3.5 h-3.5"/>
                                  </button>
                                )}
                                <button 
                                    onClick={() => openModal(t.type === TransactionType.INVOICE ? 'DEBT' : (t.type === TransactionType.CHEQUE ? 'CHEQUE' : 'PAYMENT'), t)} 
                                    className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 rounded transition-colors" 
                                    title="Düzenle"
                                >
                                    <Pencil className="w-3.5 h-3.5"/>
                                </button>
                                <button 
                                    onClick={() => handleDeleteTransaction(t.id)} 
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded transition-colors" 
                                    title="Sil"
                                >
                                    <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        </td>
                      </tr>
                    ))}
                    {visibleTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Wallet className="w-10 h-10 mb-2 opacity-20 text-slate-400" />
                            <p className="text-xs">Bu firmaya ait kayıtlı hareket bulunamadı.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 text-blue-400/60">
                  <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-300">Firma Seçimi Yapın</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1">Cari hesap hareketlerini, ekstre dökümünü ve çek durumunu görüntülemek için soldaki listeden bir firma seçiniz.</p>
            </div>
          )}
        </div>
      </div>

      {/* Generic Modal (Debt or Payment) */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 relative">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><ArrowLeft className="w-5 h-5 rotate-180" /></button>
            
            <h3 className={`text-xl font-bold mb-1 ${activeModal === 'PAYMENT' ? 'text-emerald-400' : activeModal === 'CHEQUE' ? 'text-purple-400' : 'text-rose-400'}`}>
                {editingId 
                  ? (activeModal === 'PAYMENT' ? 'Tahsilatı Düzenle' : activeModal === 'CHEQUE' ? 'Çeki Düzenle' : 'Borcu Düzenle') 
                  : (activeModal === 'PAYMENT' ? 'Tahsilat Ekle' : activeModal === 'CHEQUE' ? 'Çek Tahsilatı Ekle' : 'Borç Ekle')}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
                {activeModal === 'PAYMENT' 
                  ? 'Kasaya/Bankaya giren tutarı işleyin.' 
                  : activeModal === 'CHEQUE'
                  ? 'Alınan vadeli çeki işleyin. Vadesi gelene kadar gizlenir, günü geldiğinde tahsilat onayı bekler.'
                  : 'Manuel borç veya açılış bakiyesi ekleyin.'}
            </p>
            
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              
              {/* Çek Özel Alanları */}
              {activeModal === 'CHEQUE' && (
                <>
                  <div>
                     <label className="block text-xs font-bold text-slate-400 mb-1">Banka Adı</label>
                     <input 
                        type="text" 
                        required 
                        value={bankName} 
                        onChange={e => setBankName(e.target.value)} 
                        placeholder="Örn: Garanti BBVA, Yapı Kredi, Ziraat..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500 text-sm"
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-slate-400 mb-1">Çek Numarası</label>
                     <input 
                        type="text" 
                        required 
                        value={chequeNumber} 
                        onChange={e => setChequeNumber(e.target.value)} 
                        placeholder="Örn: 0049182"
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500 font-mono text-sm"
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Vade Tarihi (Çekin Günü)
                     </label>
                     <input 
                        type="date" 
                        required 
                        value={dueDate} 
                        onChange={e => setDueDate(e.target.value)} 
                        className="w-full bg-slate-900 border border-amber-500/60 rounded-lg px-3 py-2 text-white outline-none focus:border-amber-400 text-sm"
                     />
                     <span className="text-[10px] text-slate-400 mt-1 block">
                        Bu tarihe kadar caride gösterilmez; günü gelince onay bekler.
                     </span>
                  </div>
                </>
              )}

              {/* Tarih */}
              <div>
                 <label className="block text-xs font-bold text-slate-400 mb-1">
                    {activeModal === 'CHEQUE' ? 'Çekin Alındığı Tarih' : 'Tarih'}
                 </label>
                 <input 
                    type="date" 
                    required 
                    value={transDate} 
                    onChange={e => setTransDate(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 text-sm"
                 />
              </div>

              {/* Açıklama */}
              <div>
                 <label className="block text-xs font-bold text-slate-400 mb-1">Açıklama</label>
                 <input 
                    type="text" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder={activeModal === 'PAYMENT' ? 'EFT / Nakit Tahsilat' : activeModal === 'CHEQUE' ? 'Firma Çeki' : 'Devir Bakiyesi / Fatura Harici Borç'}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 text-sm"
                 />
              </div>

              {/* Tutar */}
              <div className="relative">
                <label className="block text-xs font-bold text-blue-400 mb-2 uppercase">Tutar (TL)</label>
                <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-lg">₺</span>
                    <input 
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-600 rounded-xl pl-10 pr-4 py-3 text-2xl font-bold text-white outline-none focus:border-blue-500 transition-colors text-right"
                    placeholder="0,00"
                    />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setActiveModal(null)}
                  className="flex-1 px-4 py-3 text-slate-300 hover:text-white bg-slate-700 rounded-lg font-medium text-sm"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  className={`flex-[2] text-white px-4 py-3 rounded-lg font-bold shadow-lg text-sm transition-all ${
                    activeModal === 'PAYMENT' 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20' 
                      : activeModal === 'CHEQUE'
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20'
                  }`}
                >
                  {editingId ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirmDetails;
