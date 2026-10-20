
import React, { useRef, useState, useEffect } from 'react';
import { db } from '../services/db';
import { exporter } from '../services/exporter';
import { cloudService } from '../services/cloud';
import { Save, Upload, Download, Database, AlertTriangle, FileSpreadsheet, Cloud, CloudRain, CloudLightning } from 'lucide-react';
import * as XLSX from 'xlsx';

const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [cloudUrl, setCloudUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCloudUrl(db.getCloudUrl());
  }, []);

  const handleSaveUrl = () => {
    db.saveCloudUrl(cloudUrl);
    alert('Bulut adresi kaydedildi.');
  };

  const handleCloudUpload = async () => {
    if(!cloudUrl) return alert('Lütfen önce Firebase URL giriniz.');
    if(!window.confirm('Yerel verileriniz Bulut üzerine yazılacak. Devam edilsin mi?')) return;
    
    setLoading(true);
    try {
        const data = db.getFullBackup();
        await cloudService.uploadData(cloudUrl, data);
        alert('Yükleme Başarılı! Verileriniz buluta yedeklendi.');
    } catch (e) {
        alert('Yükleme Başarısız. URL adresinizi ve internet bağlantınızı kontrol edin.');
    } finally {
        setLoading(false);
    }
  };

  const handleCloudDownload = async () => {
    if(!cloudUrl) return alert('Lütfen önce Firebase URL giriniz.');
    if(!window.confirm('DİKKAT! Yerel verileriniz silinecek ve Buluttaki veriler yüklenecek. Devam edilsin mi?')) return;

    setLoading(true);
    try {
        const data = await cloudService.downloadData(cloudUrl);
        if(data && db.restoreBackup(data)) {
            alert('İndirme Başarılı! Sayfa yenileniyor...');
            window.location.reload();
        } else {
            alert('Veri formatı hatalı veya veri yok.');
        }
    } catch (e) {
        alert('İndirme Başarısız. URL adresinizi kontrol edin.');
    } finally {
        setLoading(false);
    }
  };

  // --- YEDEKLEME & GERİ YÜKLEME ---
  const handleDownloadBackup = () => {
    const data = db.getFullBackup();
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
    const fileName = `OSGB_Yedek_${dateStr}.json`;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("DİKKAT! Bu işlem mevcut veritabanını tamamen silecek ve yedekteki verileri yükleyecektir. Devam etmek istiyor musunuz?")) {
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const success = db.restoreBackup(json);
        if (success) {
          alert("Yedek başarıyla geri yüklendi. Sayfa yenileniyor...");
          window.location.reload();
        } else {
          alert("Yedek dosyası bozuk veya uyumsuz.");
        }
      } catch (err) {
        alert("Dosya okuma hatası.");
      }
    };
    reader.readAsText(file);
  };

  // --- EXCEL TOPLU AKTARIM ---
  const handleDownloadTemplate = () => {
    const template = [
        {
            "Firma Adı": "Örnek İnşaat Ltd.",
            "Başlangıç Borcu": 5000,
            "Taban Kişi": 10,
            "Taban Ücret": 1500,
            "Ekstra Kişi Ücreti": 100,
            "Uzman %": 60,
            "Doktor %": 40,
            "Fatura Tipi": "E-Fatura"
        },
        {
            "Firma Adı": "Örnek Tekstil A.Ş.",
            "Başlangıç Borcu": 0,
            "Taban Kişi": 50,
            "Taban Ücret": 8000,
            "Ekstra Kişi Ücreti": 50,
            "Uzman %": 50,
            "Doktor %": 50,
            "Fatura Tipi": "E-Arşiv"
        }
    ];
    exporter.exportToExcel("Firma_Aktarim_Sablonu", template);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            
            const result = db.bulkImportFirms(data);
            alert(`İşlem Tamamlandı!\n\nEklenen Firma: ${result.newFirmsCount}\nOluşturulan Borç Kaydı: ${result.newTransCount}`);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Excel dosyası okunamadı. Lütfen şablona uygun olduğundan emin olun.");
        }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <header>
        <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-500" />
          Ayarlar ve Veri Yönetimi
        </h2>
        <p className="text-slate-400 mt-2">Yedekleme işlemleri, bulut senkronizasyonu ve toplu veri aktarımı.</p>
      </header>

      {/* BULUT SENKRONİZASYON (FIREBASE) */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 border border-blue-500/30 rounded-xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Cloud className="w-48 h-48 text-blue-400" />
        </div>
        
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 relative z-10">
            <Cloud className="w-6 h-6 text-blue-400" />
            Google Firebase Bulut Senkronizasyon (Ücretsiz)
        </h3>
        
        <div className="space-y-4 relative z-10">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-sm text-slate-300">
                <p>Verilerinizi farklı cihazlar (Ev, Ofis) arasında taşımak için Google Firebase Realtime Database kullanabilirsiniz.</p>
                <ol className="list-decimal pl-4 mt-2 space-y-1 text-slate-400">
                    <li>Google Firebase Console'da bir Realtime Database oluşturun.</li>
                    <li>Verilen URL'i (https://...firebaseio.com/) aşağıya yapıştırın.</li>
                    <li>Verileri göndermek için <b>Buluta Yükle</b>, çekmek için <b>Buluttan İndir</b> butonunu kullanın.</li>
                </ol>
            </div>

            <div className="flex gap-4 items-center">
                <input 
                    type="text" 
                    value={cloudUrl}
                    onChange={(e) => setCloudUrl(e.target.value)}
                    placeholder="https://projeniz-default-rtdb.europe-west1.firebasedatabase.app/"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 font-mono text-sm"
                />
                <button 
                    onClick={handleSaveUrl}
                    className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-lg text-white font-medium"
                >
                    Kaydet
                </button>
            </div>

            <div className="flex gap-4 mt-4">
                <button 
                    onClick={handleCloudUpload}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-500/20"
                >
                    {loading ? 'İşleniyor...' : <><Upload className="w-5 h-5" /> Buluta Yükle (Gönder)</>}
                </button>
                <button 
                    onClick={handleCloudDownload}
                    disabled={loading}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-purple-500/20"
                >
                    {loading ? 'İşleniyor...' : <><Download className="w-5 h-5" /> Buluttan İndir (Çek)</>}
                </button>
            </div>
        </div>
      </section>

      {/* YEDEKLEME BÖLÜMÜ */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Save className="w-5 h-5 text-emerald-500" />
            Yerel Sistem Yedekleme (Dosya)
        </h3>
        <p className="text-slate-400 mb-6 text-sm">
            Verilerinizi dosya olarak bilgisayarınıza indirin.
        </p>

        <div className="flex gap-4">
            <button 
                onClick={handleDownloadBackup}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
                <Download className="w-5 h-5" />
                Yedeği İndir (.json)
            </button>
            
            <div className="relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleRestoreBackup}
                    accept=".json"
                    className="hidden"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors border border-slate-600"
                >
                    <Upload className="w-5 h-5" />
                    Yedeği Geri Yükle
                </button>
            </div>
        </div>
      </section>

      {/* EXCEL IMPORT BÖLÜMÜ */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
            Toplu Firma ve Bakiye Aktarımı (Excel)
        </h3>
        
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <div className="flex gap-3 text-blue-400">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <div className="text-sm">
                    <p className="font-bold mb-1">Nasıl Kullanılır?</p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                        <li>Önce aşağıdaki butondan <b>Örnek Şablonu İndirin</b>.</li>
                        <li>İndirdiğiniz Excel dosyasına firmalarınızı ve varsa <b>Başlangıç Borcunu</b> girin.</li>
                        <li><b>Excel Yükle</b> butonu ile dosyayı sisteme geri yükleyin.</li>
                    </ol>
                </div>
            </div>
        </div>

        <div className="flex gap-4">
             <button 
                onClick={handleDownloadTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
                <Download className="w-5 h-5" />
                Örnek Şablonu İndir
            </button>

            <div className="relative">
                <input 
                    type="file" 
                    ref={excelInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                 <button 
                    onClick={() => excelInputRef.current?.click()}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors border border-slate-600"
                >
                    <Upload className="w-5 h-5" />
                    Doldurulmuş Excel Yükle
                </button>
            </div>
        </div>
      </section>

      <div className="text-center text-xs text-slate-600 mt-12">
        Bu sistemdeki tüm veriler tarayıcınızın yerel hafızasında (localStorage) saklanmaktadır.
      </div>
    </div>
  );
};

export default Settings;
