
import React, { useRef, useState, useEffect } from 'react';
import { db } from '../services/db';
import { exporter } from '../services/exporter';
import { Save, Upload, Download, Database, Trash2, AlertOctagon, RefreshCw, TrendingUp, Percent, Landmark, Receipt } from 'lucide-react';
import * as XLSX from 'xlsx';
import { GlobalSettings } from '../types';

const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const updatePriceInputRef = useRef<HTMLInputElement>(null);
    
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
      expertPercentage: 60,
      doctorPercentage: 40,
      vatRateExpert: 20,
      vatRateDoctor: 10,
      vatRateHealth: 10,
      reportEmail: '',
      bankInfo: '',
      simpleDebtMode: false
  });

  useEffect(() => {
    setGlobalSettings(db.getGlobalSettings());
  }, []);

  const handleSaveGlobalSettings = (e: React.FormEvent) => { e.preventDefault(); db.saveGlobalSettings(globalSettings); alert('Global parametreler güncellendi.'); };

  

  const handleDownloadBackup = () => {
    const data = db.getFullBackup();
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `OSGB_Yedek_${dateStr}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!window.confirm("DİKKAT! Veritabanı silinecek ve yedek yüklenecek. Devam?")) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (event) => { try { if (db.restoreBackup(JSON.parse(event.target?.result as string))) { alert("Yüklendi. Yenileniyor..."); window.location.reload(); } else { alert("Dosya bozuk."); } } catch (err) { alert("Hata."); } };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => { exporter.exportAdvancedTemplate(); };
  
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { try { const result = db.bulkImportFirms(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]] ? XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]) : []); alert(`Tamamlandı. Eklenen: ${result.newFirmsCount}`); window.location.reload(); } catch (err) { alert("Excel Hatası."); } };
    reader.readAsBinaryString(file);
  };

  // YENİ: FİYAT GÜNCELLEME EXPORT
  const handleDownloadUpdateTemplate = () => {
      const firms = db.getFirms();
      exporter.exportFirmsForEditing(firms);
  };

  // YENİ: FİYAT GÜNCELLEME IMPORT
  const handleImportUpdateExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const wb = XLSX.read(evt.target?.result, { type: 'binary' });
              const generalSheet = wb.Sheets["Genel Fiyatlar"];
              const tiersSheet = wb.Sheets["Kademeler"];
              if (!generalSheet) throw new Error("'Genel Fiyatlar' sayfası bulunamadı.");
              const generalData = XLSX.utils.sheet_to_json(generalSheet);
              const tierData = tiersSheet ? XLSX.utils.sheet_to_json(tiersSheet) : [];
              const count = db.bulkUpdatePricing(generalData, tierData);
              alert(`${count} adet firmanın fiyatları güncellendi.`);
              window.location.reload();
          } catch (err: any) { alert("Dosya okuma hatası: " + err.message); }
      };
      reader.readAsBinaryString(file);
  };

  const handleFactoryReset = () => {
      window.focus();
      if(!window.confirm("⚠️ DİKKAT: TÜM VERİLER SİLİNECEK! \n\nFabrika ayarlarına dönmek istediğinize emin misiniz?")) return;
      db.factoryReset();
      alert("Tüm veriler silindi. Uygulama yeniden başlatılıyor.");
      window.location.reload();
  };

  const handleClearTransactions = () => {
      window.focus();
      if(!window.confirm("⚠️ SADECE CARİ HAREKETLER SİLİNECEK!")) return;
      db.clearAllTransactions();
      alert("Cari hareketler temizlendi. Sayfa yenileniyor.");
      window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <header>
        <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3"><Database className="w-8 h-8 text-blue-500" /> Ayarlar ve Veri Yönetimi</h2>
        <p className="text-slate-400 mt-2">Yedekleme, bağlantı ve global parametreler.</p>
      </header>
      
            <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Percent className="w-5 h-5 text-purple-500" /> Global Parametreler</h3>
          <form onSubmit={handleSaveGlobalSettings} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-sm font-medium text-slate-300 mb-2">Uzman Hakediş (%)</label><input type="number" min="0" max="100" value={globalSettings.expertPercentage} onChange={e => setGlobalSettings(p => ({...p, expertPercentage: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"/></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-2">Doktor Hakediş (%)</label><input type="number" min="0" max="100" value={globalSettings.doctorPercentage} onChange={e => setGlobalSettings(p => ({...p, doctorPercentage: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"/></div>
              </div>
              <div className="border-t border-slate-700 pt-4 grid grid-cols-3 gap-6">
                <div><label className="block text-sm font-medium text-slate-400 mb-2">Uzman KDV (%)</label><input type="number" min="0" value={globalSettings.vatRateExpert} onChange={e => setGlobalSettings(p => ({...p, vatRateExpert: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"/></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-2">Doktor KDV (%)</label><input type="number" min="0" value={globalSettings.vatRateDoctor} onChange={e => setGlobalSettings(p => ({...p, vatRateDoctor: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"/></div>
                <div><label className="block text-sm font-medium text-slate-400 mb-2">Sağlık KDV (%)</label><input type="number" min="0" value={globalSettings.vatRateHealth} onChange={e => setGlobalSettings(p => ({...p, vatRateHealth: Number(e.target.value)}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"/></div>
              </div>
              
              {/* YENİ: Sadeleştirilmiş Kopyalama Ayarı */}
              <div className="border-t border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Receipt className="w-4 h-4 text-orange-500" /> Fatura Kopyalama Ayarları</h4>
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                      <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            id="simpleDebtMode" 
                            checked={globalSettings.simpleDebtMode || false} 
                            onChange={e => setGlobalSettings(p => ({...p, simpleDebtMode: e.target.checked}))} 
                            className="mt-1 w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                              <label htmlFor="simpleDebtMode" className="block text-sm font-bold text-white cursor-pointer select-none">Sadeleştirilmiş Borç Modu</label>
                              <p className="text-xs text-slate-400 mt-1">
                                  Aktif edildiğinde: "Kesilecek Faturalar" sayfasındaki kopyalama butonu, <b>sadece firma borçlu ise</b> görünür. 
                                  Kopyalanan metin sadece "Toplam Borç: X TL" bilgisini içerir, "Yalnız..." ibaresini içermez.
                              </p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-500" /> Banka & IBAN Bilgisi</label>
                <textarea rows={3} value={globalSettings.bankInfo} onChange={e => setGlobalSettings(p => ({...p, bankInfo: e.target.value}))} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 resize-none font-mono text-sm" placeholder="Banka bilgilerinizi buraya girin..."/>
              </div>
              <div className="flex justify-end"><button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">Ayarları Kaydet</button></div>
          </form>
      </section>

      {/* YILLIK FİYAT GÜNCELLEME (YENİ) */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" /> 
            Yıllık Toplu Fiyat Güncelleme
          </h3>
          <p className="text-slate-400 mb-6 text-sm">Mevcut firmaların fiyatlarını Excel'e dökün, topluca düzenleyin ve geri yükleyin.</p>
          <div className="flex gap-4">
            <button onClick={handleDownloadUpdateTemplate} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                <Download className="w-5 h-5" /> Mevcut Fiyatları İndir (Excel)
            </button>
            <div className="relative flex-1">
                <input type="file" ref={updatePriceInputRef} onChange={handleImportUpdateExcel} accept=".xlsx, .xls" className="hidden" />
                <button onClick={() => updatePriceInputRef.current?.click()} className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-slate-600">
                    <Upload className="w-5 h-5" /> Güncel Fiyatları Yükle
                </button>
            </div>
        </div>
      </section>

      {/* DİĞER EXCEL İŞLEMLERİ */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Save className="w-5 h-5 text-emerald-500" /> Yedekleme ve Excel</h3>
        <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4"><div className="flex gap-2"><button onClick={handleDownloadBackup} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium flex items-center justify-center gap-2 text-sm">Yedeği İndir</button><div className="relative flex-1"><input type="file" ref={fileInputRef} onChange={handleRestoreBackup} accept=".json" className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-medium flex items-center justify-center gap-2 text-sm border border-slate-600">Yedeği Yükle</button></div></div></div>
            <div className="space-y-4"><div className="flex gap-2"><button onClick={handleDownloadTemplate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium flex items-center justify-center gap-2 text-sm">Yeni Kayıt Şablonu</button><div className="relative flex-1"><input type="file" ref={excelInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" /><button onClick={() => excelInputRef.current?.click()} className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-medium flex items-center justify-center gap-2 text-sm border border-slate-600">Yeni Kayıt Yükle</button></div></div></div>
        </div>
      </section>

      <section className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2"><AlertOctagon className="w-6 h-6" /> Tehlikeli Bölge</h3>
          <div className="flex gap-4">
              <button onClick={handleClearTransactions} className="flex-1 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 px-6 py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"><RefreshCw className="w-5 h-5" /> Sadece Bakiyeleri Sil (Sıfırla)</button>
              <button onClick={handleFactoryReset} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"><Trash2 className="w-5 h-5" /> FABRİKA AYARLARINA DÖN</button>
          </div>
      </section>
    </div>
  );
};


export default function SettingsWithErrorBoundary() { 
  return <ErrorBoundary><Settings /></ErrorBoundary>; 
}
class ErrorBoundary extends React.Component<any, any> { 
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; } 
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; } 
  render() { 
    if (this.state.hasError) { 
      return <div style={{color:'red', padding:'20px'}}><h1>Error!</h1><pre>{this.state.error?.stack || this.state.error?.message}</pre></div>; 
    } 
    return this.props.children; 
  } 
}
