
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { DollarSign, FileCheck, Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, Scale, RefreshCw, CreditCard, Banknote, Briefcase, Activity, Calendar, CalendarDays, Landmark, Download } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0, balance: 0, totalExpenses: 0, netProfit: 0, thisMonthBilled: 0, thisMonthCollected: 0, thisMonthExpenses: 0, thisMonthNetProfit: 0, thisYearBilled: 0, thisYearCollected: 0, thisYearExpenses: 0, thisYearNetProfit: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = () => {
    const s = db.getStats();
    
    const transactions = db.getTransactions();
    const expenses = db.getExpenses();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const approved = transactions.filter(t => (t.status || 'APPROVED') === 'APPROVED');

    const thisMonthTrans = approved.filter(t => t.month === currentMonth && t.year === currentYear);
    const thisMonthExp = expenses.filter(e => e.month === currentMonth && e.year === currentYear);
    const thisMonthBilled = thisMonthTrans.filter(t => t.type === 'FATURA').reduce((sum, t) => sum + t.debt, 0);
    const thisMonthCollected = thisMonthTrans.filter(t => t.type === 'TAHSİLAT').reduce((sum, t) => sum + t.credit, 0);
    const thisMonthExpenses = thisMonthExp.reduce((sum, e) => sum + e.amount, 0);
    const thisMonthNetProfit = thisMonthCollected - thisMonthExpenses;

    const thisYearTrans = approved.filter(t => t.year === currentYear);
    const thisYearExp = expenses.filter(e => e.year === currentYear);
    const thisYearBilled = thisYearTrans.filter(t => t.type === 'FATURA').reduce((sum, t) => sum + t.debt, 0);
    const thisYearCollected = thisYearTrans.filter(t => t.type === 'TAHSİLAT').reduce((sum, t) => sum + t.credit, 0);
    const thisYearExpenses = thisYearExp.reduce((sum, e) => sum + e.amount, 0);
    const thisYearNetProfit = thisYearCollected - thisYearExpenses;

    setStats({ 
        ...s, 
        thisMonthBilled, thisMonthCollected, thisMonthExpenses, thisMonthNetProfit,
        thisYearBilled, thisYearCollected, thisYearExpenses, thisYearNetProfit
    });

    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { month: d.getMonth() + 1, year: d.getFullYear(), name: d.toLocaleString('tr-TR', { month: 'short' }) };
    }).reverse();

    const data = last6Months.map(m => {
      const monthTrans = approved.filter(t => t.month === m.month && t.year === m.year);
      const monthExp = expenses.filter(e => e.month === m.month && e.year === m.year);
      
      const faturalanan = monthTrans.reduce((sum, t) => sum + t.debt, 0);
      const tahsilat = monthTrans.reduce((sum, t) => sum + t.credit, 0);
      const gider = monthExp.reduce((sum, e) => sum + e.amount, 0);
      const net = tahsilat - gider;

      return {
        name: m.name,
        Tahsilat: tahsilat,
        Gider: gider,
        NetKar: net,
        Faturalanan: faturalanan
      };
    });
    setChartData(data);
  };

  useEffect(() => {
    loadData(); 
    const unsubscribe = db.subscribe(() => {
        loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleManualRefresh = async () => {
      setRefreshing(true);
      await db.initData(true);
      loadData();
      setTimeout(() => setRefreshing(false), 500);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);

  const generateBoardReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    const unTurkify = (text: string) => {
        if(!text) return '';
        return text.toString()
          .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
          .replace(/ü/g, 'u').replace(/Ü/g, 'U')
          .replace(/ş/g, 's').replace(/Ş/g, 'S')
          .replace(/ı/g, 'i').replace(/İ/g, 'I')
          .replace(/ö/g, 'o').replace(/Ö/g, 'O')
          .replace(/ç/g, 'c').replace(/Ç/g, 'C');
    };

    const cFormat = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val).replace('₺', 'TL');

    const checkPage = (heightNeeded: number) => {
        if (yPos + heightNeeded > doc.internal.pageSize.height - 20) {
            doc.addPage();
            yPos = 20;
        }
    };

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); 
    doc.text("YONETIM KURULU FINANSAL RAPORU", pageWidth / 2, yPos, { align: "center" });
    
    yPos += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Sirket Kapsamli Bilancosu`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // 1. GENEL DURUM
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("1. GENEL DURUM VE BILANCO (TUM ZAMANLAR)", 14, yPos);
    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        head: [['Kasa & Banka (Net Kar)', 'Toplam Kesilen', 'Toplam Tahsilat', 'Piyasadaki Alacak', 'Toplam Gider']],
        body: [[
            cFormat(stats.netProfit), cFormat(stats.totalBilled), cFormat(stats.totalCollected), cFormat(stats.balance), cFormat(stats.totalExpenses)
        ]],
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // 2. DONEMSEL ANALİZ
    checkPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`2. DONEMSEL ANALIZ (${new Date().getFullYear()} YILI & BU AY)`, 14, yPos);
    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], textColor: 255 }, 
        head: [['Donem', 'Kesilen Fatura', 'Tahsil Edilen', 'Sirket Gideri', 'Net Kar']],
        body: [
            ['Bu Ay', cFormat(stats.thisMonthBilled), cFormat(stats.thisMonthCollected), cFormat(stats.thisMonthExpenses), cFormat(stats.thisMonthNetProfit)],
            ['Bu Yil', cFormat(stats.thisYearBilled), cFormat(stats.thisYearCollected), cFormat(stats.thisYearExpenses), cFormat(stats.thisYearNetProfit)]
        ],
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Fetch Extra Data
    const firms = db.getFirms();
    const transactions = db.getTransactions().filter(t => (t.status || 'APPROVED') === 'APPROVED');
    const expenses = db.getExpenses();
    const categories = db.getExpenseCategories();
    const currentYear = new Date().getFullYear();
    const thisYearTrans = transactions.filter(t => t.year === currentYear);

    // 3. MÜŞTERİ PROFİLİ
    const activeFirms = firms.length;
    const branchCount = firms.filter(f => f.parentFirmId).length;
    let azTeh = 0, teh = 0, cokTeh = 0;
    firms.forEach(f => {
        if (f.dangerClass?.includes('Az')) azTeh++;
        else if (f.dangerClass?.includes('Çok')) cokTeh++;
        else if (f.dangerClass?.includes('Tehlikeli')) teh++;
    });

    checkPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("3. MUSTERI (FIRMA) PROFILI VE PORTFOY", 14, yPos);
    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [88, 28, 135], textColor: 255 }, // purple
        head: [['Toplam Firma', 'Sube Sayisi', 'Az Tehlikeli', 'Tehlikeli', 'Cok Tehlikeli']],
        body: [[activeFirms.toString(), branchCount.toString(), azTeh.toString(), teh.toString(), cokTeh.toString()]],
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // 4. GELİR DAĞILIMI (UZMAN / HEKİM) - BU YIL
    let totalExpert = 0, totalDoctor = 0, totalBase = 0;
    thisYearTrans.filter(t => t.type === 'FATURA').forEach(t => {
        if(t.calculatedDetails) {
            totalExpert += t.calculatedDetails.expertShare || 0;
            totalDoctor += t.calculatedDetails.doctorShare || 0;
            totalBase += (t.debt - (t.calculatedDetails.expertShare || 0) - (t.calculatedDetails.doctorShare || 0));
        }
    });

    checkPage(40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`4. HIZMET GELIR DAGILIMI (${currentYear} YILI KESILEN)`, 14, yPos);
    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [3, 105, 161], textColor: 255 }, // sky
        head: [['OSGB Isletme Karni', 'Uzman (IGU) Payi', 'Hekim (IYH) Payi', 'Toplam Kesilen']],
        body: [[cFormat(totalBase), cFormat(totalExpert), cFormat(totalDoctor), cFormat(stats.thisYearBilled)]],
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // 5. GİDER KALEMLERİ - BU YIL
    const thisYearExp = expenses.filter(e => e.year === currentYear);
    const expMap: Record<string, number> = {};
    thisYearExp.forEach(e => {
        const cat = categories.find(c => c.id === e.categoryId)?.name || 'Diger';
        expMap[cat] = (expMap[cat] || 0) + e.amount;
    });
    const expRows = Object.entries(expMap).sort((a,b) => b[1] - a[1]).map(([name, amt]) => [unTurkify(name), cFormat(amt)]);

    if (expRows.length > 0) {
        checkPage(40 + (expRows.length * 10));
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`5. GIDER DAGILIMI (${currentYear} YILI)`, 14, yPos);
        yPos += 5;
        autoTable(doc, {
            startY: yPos,
            theme: 'striped',
            headStyles: { fillColor: [190, 18, 60], textColor: 255 }, // rose
            head: [['Gider Kalemi', 'Toplam Harcama']],
            body: expRows,
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // 6. EN BÜYÜK MÜŞTERİLER (CİRO BAZINDA - TOP 10)
    const firmCiro: Record<string, number> = {};
    transactions.filter(t => t.type === 'FATURA').forEach(t => {
        firmCiro[t.firmId] = (firmCiro[t.firmId] || 0) + t.debt;
    });
    const topBillers = firms.map(f => ({ ...f, ciro: firmCiro[f.id] || 0 })).sort((a,b) => b.ciro - a.ciro).slice(0, 10);

    if (topBillers.length > 0) {
        checkPage(60);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("6. EN YUKSEK CIRO GETIREN MUSTERILER (TUM ZAMANLAR TOP 10)", 14, yPos);
        yPos += 5;
        autoTable(doc, {
            startY: yPos,
            theme: 'striped',
            headStyles: { fillColor: [21, 128, 61], textColor: 255 }, // green
            head: [['Sira', 'Musteri Unvani', 'Tehlike Sinifi', 'Toplam Fatura Cirosu']],
            body: topBillers.map((f, i) => [
                (i + 1).toString(), unTurkify(f.name), unTurkify(f.dangerClass || '-'), cFormat(f.ciro)
            ]),
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // 7. AÇIK HESAPLAR
    const topDebtors = firms.filter(f => f.balance > 0).sort((a,b) => b.balance - a.balance).slice(0, 10);
    if (topDebtors.length > 0) {
        checkPage(60);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("7. EN YUKSEK PIYASA ALACAKLARI (TOP 10 ACIK HESAP)", 14, yPos);
        yPos += 5;
        autoTable(doc, {
            startY: yPos,
            theme: 'striped',
            headStyles: { fillColor: [194, 65, 12], textColor: 255 }, // orange
            head: [['Sira', 'Musteri Unvani', 'Tehlike Sinifi', 'Bekleyen Bakiye']],
            body: topDebtors.map((f, i) => [
                (i + 1).toString(), unTurkify(f.name), unTurkify(f.dangerClass || '-'), cFormat(f.balance)
            ]),
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // FOOTER (İMZALAR)
    checkPage(60);
    yPos += 10;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    doc.text("Bu belge sistem tarafindan otomatik uretilmistir. Yonetim kurulu referans belgesidir.", 14, yPos);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    yPos += 20;
    doc.text("Yonetim Kurulu Onayi", 40, yPos);
    doc.text("Muhasebe & Finans", pageWidth - 50, yPos, { align: 'center' });
    yPos += 15;
    doc.line(20, yPos, 80, yPos);
    doc.line(pageWidth - 75, yPos, pageWidth - 25, yPos);

    doc.save(`Kapsamli_Finans_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 md:pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700/50 pb-6">
        <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100 flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-blue-500" />
                Finansal Özet
            </h2>
            <p className="text-slate-400 mt-2 text-sm md:text-base">Gerçek zamanlı nakit akışı, kârlılık ve bakiye raporları.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
                onClick={generateBoardReport}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl border border-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Rapor İndir (PDF)</span>
            </button>

            <button 
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl border border-slate-700 shadow-sm transition-all active:scale-95"
            >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium hidden md:inline">Yenile</span>
            </button>
        </div>
      </header>

      {/* BU AYIN ÖZETİ */}
      <h3 className="text-xl font-bold text-slate-200 mt-2 mb-4 flex items-center gap-2">
        <Calendar className="w-6 h-6 text-blue-400" />
        Bu Ayın Özeti ({new Date().toLocaleString('tr-TR', { month: 'long' })})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/80 border-l-4 border-indigo-500 p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Kesilen Fatura</div>
             <div className="text-xl font-black text-indigo-400">{formatCurrency(stats.thisMonthBilled)}</div>
          </div>
          <div className="bg-slate-800/80 border-l-4 border-emerald-500 p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Tahsilat</div>
             <div className="text-xl font-black text-emerald-400">{formatCurrency(stats.thisMonthCollected)}</div>
          </div>
          <div className="bg-slate-800/80 border-l-4 border-rose-500 p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Gider</div>
             <div className="text-xl font-black text-rose-400">{formatCurrency(stats.thisMonthExpenses)}</div>
          </div>
          <div className={`bg-slate-800/80 border-l-4 ${stats.thisMonthNetProfit >= 0 ? 'border-emerald-500' : 'border-rose-500'} p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]`}>
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Net Kâr</div>
             <div className={`text-xl font-black ${stats.thisMonthNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(stats.thisMonthNetProfit)}</div>
          </div>
      </div>

      {/* YILLIK ÖZET */}
      <h3 className="text-xl font-bold text-slate-200 mt-2 mb-4 flex items-center gap-2">
        <CalendarDays className="w-6 h-6 text-purple-400" />
        Yıllık Özet ({new Date().getFullYear()})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-slate-800/80 border-l-4 border-indigo-500 p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Kesilen Fatura</div>
             <div className="text-xl font-black text-indigo-400">{formatCurrency(stats.thisYearBilled)}</div>
          </div>
          <div className="bg-slate-800/80 border-l-4 border-emerald-500 p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Tahsilat</div>
             <div className="text-xl font-black text-emerald-400">{formatCurrency(stats.thisYearCollected)}</div>
          </div>
          <div className="bg-slate-800/80 border-l-4 border-rose-500 p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]">
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Gider</div>
             <div className="text-xl font-black text-rose-400">{formatCurrency(stats.thisYearExpenses)}</div>
          </div>
          <div className={`bg-slate-800/80 border-l-4 ${stats.thisYearNetProfit >= 0 ? 'border-emerald-500' : 'border-rose-500'} p-4 rounded-xl shadow-md transition-transform hover:scale-[1.02]`}>
             <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Net Kâr</div>
             <div className={`text-xl font-black ${stats.thisYearNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(stats.thisYearNetProfit)}</div>
          </div>
      </div>

      {/* GENEL DURUM & BİLANÇO */}
      <h3 className="text-xl font-bold text-slate-200 mt-2 mb-4 flex items-center gap-2">
        <Landmark className="w-6 h-6 text-orange-400" />
        Genel Durum & Bilanço
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-12">
        
        {/* KASA / BANKA (NET NAKİT) */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-slate-800 border border-emerald-500/30 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-all transform group-hover:scale-110 group-hover:rotate-12">
                <Banknote className="w-32 h-32 text-emerald-400" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-emerald-400/80 uppercase tracking-wider">Kasa & Banka (Nakit Kâr)</h3>
                    <span className="p-2 bg-emerald-500/20 rounded-lg"><Wallet className="w-5 h-5 text-emerald-400" /></span>
                </div>
                <p className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(stats.netProfit)}
                </p>
                <div className="flex flex-col gap-1 mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                    <span className="text-xs text-slate-400 leading-snug">
                        Tüm tahsilatlardan şirket giderleri çıkarıldıktan sonra kasanızda kalan reel para (Net Kâr).
                    </span>
                    <span className="text-[10px] font-medium text-emerald-500/70 mt-1">Toplam Tahsilat: {formatCurrency(stats.totalCollected)}</span>
                </div>
            </div>
        </div>

        {/* PİYASADAKİ ALACAKLAR (AÇIK FATURALAR) */}
        <div className="bg-gradient-to-br from-orange-900/40 to-slate-800 border border-orange-500/30 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-all transform group-hover:scale-110 group-hover:rotate-12">
                <Scale className="w-32 h-32 text-orange-400" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-orange-400/80 uppercase tracking-wider">Piyasadaki Alacaklar</h3>
                    <span className="p-2 bg-orange-500/20 rounded-lg"><FileCheck className="w-5 h-5 text-orange-400" /></span>
                </div>
                <p className="text-3xl font-bold text-orange-400">
                    {formatCurrency(stats.balance)}
                </p>
                <div className="flex flex-col gap-1 mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                    <span className="text-xs text-slate-400 leading-snug">
                        Müşterilere kesilmiş ancak henüz ödemesi alınmamış toplam açık fatura alacağı.
                    </span>
                </div>
            </div>
        </div>

        {/* TOPLAM KESİLEN FATURA */}
        <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 border border-blue-500/30 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-all transform group-hover:scale-110 group-hover:rotate-12">
                <TrendingUp className="w-32 h-32 text-blue-400" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-blue-400/80 uppercase tracking-wider">Toplam Kesilen Fatura</h3>
                    <span className="p-2 bg-blue-500/20 rounded-lg"><ArrowUpRight className="w-5 h-5 text-blue-400" /></span>
                </div>
                <p className="text-3xl font-bold text-blue-400">
                    {formatCurrency(stats.totalBilled)}
                </p>
                <div className="flex flex-col gap-1 mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                    <span className="text-xs text-slate-400 leading-snug">
                        Kuruluşunuzdan bugüne kadar kesilen toplam fatura ciro tutarı.
                    </span>
                </div>
            </div>
        </div>

        {/* TOPLAM GİDERLER */}
        <div className="bg-gradient-to-br from-rose-900/40 to-slate-800 border border-rose-500/30 p-6 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-all transform group-hover:scale-110 group-hover:rotate-12">
                <CreditCard className="w-32 h-32 text-rose-400" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-rose-400/80 uppercase tracking-wider">Toplam Şirket Gideri</h3>
                    <span className="p-2 bg-rose-500/20 rounded-lg"><ArrowDownLeft className="w-5 h-5 text-rose-400" /></span>
                </div>
                <p className="text-3xl font-bold text-rose-400">
                    {formatCurrency(stats.totalExpenses)}
                </p>
                <div className="flex flex-col gap-1 mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                    <span className="text-xs text-slate-400 leading-snug">
                        Şirket içi harcamalar, maaşlar ve bugüne kadar yapılan tüm operasyonel masraflar.
                    </span>
                </div>
            </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* AYLIK GELİR/GİDER VE NET KÂR GRAFİĞİ */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-200">6 Aylık Gelir & Gider Analizi</h3>
            </div>
            <div className="w-full h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} />
                  <YAxis stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#f8fafc', padding: '2px 0' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  <Bar dataKey="Tahsilat" name="Nakit Girişi (Tahsilat)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Gider" name="Nakit Çıkışı (Gider)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line type="monotone" dataKey="NetKar" name="Net Kâr/Zarar" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FİNANSAL SAĞLIK ÖZETİ */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                  <div className="flex items-center gap-3 mb-6">
                      <DollarSign className="w-6 h-6 text-yellow-400" />
                      <h3 className="text-lg font-bold text-slate-200">Finansal Performans</h3>
                  </div>
                  
                  <div className="space-y-6">
                      {/* Ciro Tahsilat Oranı */}
                      <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                              <span className="text-xs font-bold inline-block text-slate-400 uppercase tracking-wider">Tahsilat Başarısı</span>
                              <span className="text-xs font-bold inline-block text-emerald-400">
                                  {stats.totalBilled > 0 ? ((stats.totalCollected / stats.totalBilled) * 100).toFixed(1) : '0'}%
                              </span>
                          </div>
                          <div className="overflow-hidden h-2 mb-2 text-xs flex rounded-full bg-slate-900 border border-slate-700">
                              <div style={{ width: `${stats.totalBilled > 0 ? (stats.totalCollected / stats.totalBilled) * 100 : 0}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"></div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 leading-snug">Bugüne kadar kesilen faturaların yüzde kaçının tahsil edildiğini (kapanma oranını) gösterir.</div>
                          <div className="text-[10px] font-medium text-slate-500 text-right mt-1">Kesilen: {formatCurrency(stats.totalBilled)} / Alınan: {formatCurrency(stats.totalCollected)}</div>
                      </div>

                      {/* Kârlılık Oranı */}
                      <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                              <span className="text-xs font-bold inline-block text-slate-400 uppercase tracking-wider">Kâr Marjı (Reel Kârlılık)</span>
                              <span className={`text-xs font-bold inline-block ${stats.netProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                  {stats.totalCollected > 0 ? ((stats.netProfit / stats.totalCollected) * 100).toFixed(1) : '0'}%
                              </span>
                          </div>
                          <div className="overflow-hidden h-2 mb-2 text-xs flex rounded-full bg-slate-900 border border-slate-700">
                              <div style={{ width: `${stats.totalCollected > 0 ? Math.max(0, (stats.netProfit / stats.totalCollected) * 100) : 0}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 leading-snug">Kasaya giren her 100 TL'nin kaç TL'sinin size kâr olarak kaldığını gösterir (Giderler düşüldükten sonra).</div>
                          <div className="text-[10px] font-medium text-slate-500 text-right mt-1">Net Kâr: {formatCurrency(stats.netProfit)}</div>
                      </div>
                  </div>
              </div>

              <div className="mt-8 p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-inner text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-orange-500"></div>
                  <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-widest">Açık Hesap (Piyasa Borcu)</div>
                  <div className="text-2xl md:text-3xl font-black text-white group-hover:scale-105 transition-transform">
                      {formatCurrency(stats.balance)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 leading-snug">Müşterilerin size ödemesi gereken, piyasada bekleyen toplam paranız.</div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
