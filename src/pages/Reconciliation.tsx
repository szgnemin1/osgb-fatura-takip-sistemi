import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { 
  FileCheck, QrCode, Smartphone, RefreshCw, Send, CheckCircle2, AlertCircle, 
  AlertTriangle, Clock, X, Check, Copy, Download, Search, 
  Loader2, Phone, Power, Edit2, ShieldAlert
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ReconciliationItem, WhatsAppStatus } from '../types';

const PERIOD_OPTIONS = [
  { value: '2026-Q3', label: '2026 - 3. Çeyrek (30 Eylül 2026)' },
  { value: '2026-Q2', label: '2026 - 2. Çeyrek (30 Haziran 2026)' },
  { value: '2026-Q1', label: '2026 - 1. Çeyrek (31 Mart 2026)' },
  { value: '2026-Q4', label: '2026 - 4. Çeyrek (31 Aralık 2026 - Yıl Sonu)' },
  { value: '2026-10', label: '2026 Ekim Ay Sonu' },
  { value: '2026-09', label: '2026 Eylül Ay Sonu' },
  { value: 'CURRENT', label: 'Güncel Durum (Bugün İtibariyle)' }
];

export const Reconciliation: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-Q3');
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    approved: 0,
    disputed: 0,
    pending: 0,
    missingPhone: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'DISPUTED' | 'SENT' | 'PENDING_SEND' | 'MISSING_PHONE'>('all');

  // WhatsApp Durumu
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({ isConnected: false, qrCode: null });
  const [isLoadingWa, setIsLoadingWa] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Telefon Düzenleme
  const [editingPhoneFirmId, setEditingPhoneFirmId] = useState<string | null>(null);
  const [editedPhone, setEditedPhone] = useState('');

  // İtiraz / Not Görüntüleme Modalı
  const [selectedDisputeItem, setSelectedDisputeItem] = useState<ReconciliationItem | null>(null);

  // Toplu Gönderim State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; firmName?: string } | null>(null);

  // Tekli Gönderim State
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Bildirimler
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadWhatsAppStatus = async () => {
    try {
      const status = await db.getWhatsAppStatus();
      setWaStatus(status);
    } catch (_) {}
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await db.getReconciliations(selectedPeriod);
      setItems(data.items || []);
      setStats(data.stats || { total: 0, sent: 0, approved: 0, disputed: 0, pending: 0, missingPhone: 0 });
    } catch (err: any) {
      console.error('Mutabakat verileri yüklenemedi:', err);
      setErrorMsg(err.message || 'Veriler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWhatsAppStatus();
    loadData();

    // 5 saniyede bir WhatsApp durumu, 6 saniyede bir canlı mutabakat verilerini yenile
    const waInterval = setInterval(loadWhatsAppStatus, 5000);
    const dataInterval = setInterval(() => {
      db.getReconciliations(selectedPeriod).then(data => {
        if (data && data.items) {
          setItems(data.items);
          setStats(data.stats);
        }
      }).catch(() => {});
    }, 6000);

    return () => {
      clearInterval(waInterval);
      clearInterval(dataInterval);
    };
  }, [selectedPeriod]);

  // Listeyi Döneme Göre Hesapla & Veritabanına Yaz
  const handlePrepareList = async () => {
    setIsPreparing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await db.prepareReconciliations(selectedPeriod);
      setSuccessMsg(`Başarılı! Toplam ${res.count} firma mutabakat dönemine hazırlandı.`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Mutabakat listesi oluşturulamadı.');
    } finally {
      setIsPreparing(false);
    }
  };

  // WhatsApp Bağlantısını Yeniden Başlat (QR Üret)
  const handleRestartWhatsApp = async () => {
    setIsLoadingWa(true);
    try {
      await db.restartWhatsApp();
      setShowQRModal(true);
      await loadWhatsAppStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'WhatsApp başlatılamadı.');
    } finally {
      setIsLoadingWa(false);
    }
  };

  // WhatsApp Bağlantısını Kes
  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm("WhatsApp bağlantısını sonlandırmak istediğinize emin misiniz?")) return;
    try {
      await db.disconnectWhatsApp();
      await loadWhatsAppStatus();
      setSuccessMsg("WhatsApp bağlantısı kesildi.");
    } catch (err: any) {
      setErrorMsg(err.message || 'Bağlantı kesilemedi.');
    }
  };

  // Telefon Numarası Kaydet
  const handleSavePhone = async (firmId: string) => {
    try {
      await db.updateFirmPhone(firmId, editedPhone);
      setEditingPhoneFirmId(null);
      setSuccessMsg("Telefon numarası güncellendi.");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Telefon güncellenemedi.');
    }
  };

  // Tekli WhatsApp Gönderimi
  const handleSendSingle = async (item: ReconciliationItem) => {
    if (!waStatus.isConnected) {
      setErrorMsg("WhatsApp bağlı değil! Lütfen önce QR kodu okutun.");
      setShowQRModal(true);
      return;
    }
    if (!item.phone) {
      setErrorMsg(`"${item.firm_name}" için kayıtlı telefon numarası bulunamadı.`);
      return;
    }

    setSendingSingleId(item.id);
    setErrorMsg('');
    try {
      const res = await db.sendReconciliationSingle(item.id);
      setSuccessMsg(res.message || `"${item.firm_name}" firmasına mutabakat mektubu iletildi.`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Mesaj gönderilemedi.');
    } finally {
      setSendingSingleId(null);
    }
  };

  // Toplu WhatsApp Gönderimi
  const handleStartBatch = async () => {
    setShowBatchModal(false);
    if (!waStatus.isConnected) {
      setErrorMsg("WhatsApp bağlı değil! Lütfen önce QR kodu okutun.");
      setShowQRModal(true);
      return;
    }

    setIsSendingBatch(true);
    setBatchProgress({ current: 0, total: items.filter(i => i.phone).length });
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await db.sendReconciliationBatch(selectedPeriod);
      setSuccessMsg(res.message || 'Toplu gönderim başarıyla tamamlandı!');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Toplu gönderim sırasında bir hata oluştu.');
    } finally {
      setIsSendingBatch(false);
      setBatchProgress(null);
    }
  };

  // Müşteri Onay Linkini Kopyala
  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/mutabakat/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // Filtreleme
  const filteredItems = items.filter(item => {
    const matchesSearch = item.firm_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.phone && item.phone.includes(searchTerm));
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'MISSING_PHONE') return !item.phone || item.phone.trim().length < 10;
    return item.status === statusFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. ÜST BAŞLIK VE WHATSAPP ENTEGRASYON KARTI */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
            <FileCheck className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" /> 
            Cari Mutabakat & Otomatik WhatsApp
          </h2>
          <p className="text-slate-400 mt-1 text-xs sm:text-sm">
            Müşterilerinize çeyrek veya aylık dönemlerde WhatsApp üzerinden resmi mutabakat mektubu ve ekstre gönderin, yanıtları anlık takip edin.
          </p>
        </div>

        {/* WhatsApp Durum Kartı (Kompakt Rozet) */}
        <div className="flex items-center gap-3 p-2 px-3.5 rounded-2xl bg-slate-900 border border-slate-800 self-start lg:self-auto shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${waStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                {waStatus.isConnected ? (
                  <span>WhatsApp Bağlı {waStatus.phoneNumber && `(${waStatus.phoneNumber})`}</span>
                ) : (
                  <span className="text-slate-400">WhatsApp Bağlı Değil</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                {waStatus.isConnected ? 'Mesaj ve PDF gönderimine hazır' : 'Otomatik gönderim için cihazı bağlayın'}
              </div>
            </div>
          </div>

          <div className="pl-2 border-l border-slate-800">
            {waStatus.isConnected ? (
              <button
                type="button"
                onClick={handleDisconnectWhatsApp}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="WhatsApp Bağlantısını Kes"
              >
                <Power className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestartWhatsApp}
                disabled={isLoadingWa}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950"
              >
                {isLoadingWa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                <span>QR Bağla</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* BİLDİRİMLER */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400/60 hover:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400/60 hover:text-rose-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. DÖNEM SEÇİMİ VE AKSİYON BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mutabakat Dönemi</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs sm:text-sm font-semibold outline-none focus:border-emerald-500 cursor-pointer min-w-[240px]"
            >
              {PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:self-end">
            <button
              type="button"
              onClick={handlePrepareList}
              disabled={isPreparing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
              title="Seçilen döneme göre tüm firmaların güncel cari bakiyesini hesaplar ve listeyi yeniler"
            >
              {isPreparing ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
              <span>Listeyi Hesapla & Hazırla</span>
            </button>
          </div>
        </div>

        {/* Toplu Gönderim Butonu */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            disabled={isSendingBatch || items.length === 0}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
          >
            {isSendingBatch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gönderiliyor...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Otomatik WhatsApp Gönderimi Başlat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. KPI İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium">Toplam Firma</div>
          <div className="text-xl sm:text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-purple-400 font-medium">WhatsApp İletilen</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 mt-1">{stats.sent}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mutabık (Onay)
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{stats.approved}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Fark Var (İtiraz)
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 mt-1">{stats.disputed}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Yanıt Bekleyen
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-300 mt-1">{stats.pending}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-slate-500" /> Tel Eksik
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-400 mt-1">{stats.missingPhone}</div>
        </div>
      </div>

      {/* 4. ARAMA VE FİLTRELEME ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filtre Sekmeleri */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Tümü ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            ✅ Mutabık ({stats.approved})
          </button>
          <button
            onClick={() => setStatusFilter('DISPUTED')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'DISPUTED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            ⚠️ Fark Bildiren ({stats.disputed})
          </button>
          <button
            onClick={() => setStatusFilter('SENT')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'SENT' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            ⏳ Bekleyen ({stats.pending})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING_SEND')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'PENDING_SEND' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            ⚪ Gönderilmedi
          </button>
          <button
            onClick={() => setStatusFilter('MISSING_PHONE')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'MISSING_PHONE' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            📵 Telefonu Olmayanlar ({stats.missingPhone})
          </button>
        </div>

        {/* Arama Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Firma veya telefon ara..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 5. FİRMA VE MUTABAKAT TABLOSU */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Firma Adı</th>
                <th className="py-3 px-4">Yetkili Telefon (WhatsApp)</th>
                <th className="py-3 px-4 text-right">Dönem Bakiyesi</th>
                <th className="py-3 px-4 text-center">Mutabakat Durumu</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Mutabakat verileri hesaplanıyor...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Bu filtre ile eşleşen firma kaydı bulunamadı. "Listeyi Hesapla & Hazırla" butonuna basarak dönemi güncelleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isEditingPhone = editingPhoneFirmId === item.firm_id;
                  const balanceNum = Number(item.balance) || 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Firma Adı */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{item.firm_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Fatura: {item.total_billed?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL | 
                          Ödenen: {item.total_paid?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                        </div>
                      </td>

                      {/* Telefon Düzenleme */}
                      <td className="py-3 px-4">
                        {isEditingPhone ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editedPhone}
                              onChange={(e) => setEditedPhone(e.target.value)}
                              placeholder="05xx xxx xx xx"
                              className="bg-slate-950 border border-emerald-500 rounded-lg px-2 py-1 text-white text-xs w-36 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePhone(item.firm_id)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                              title="Kaydet"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhoneFirmId(null)}
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                              title="İptal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {item.phone ? (
                              <span className="font-mono text-slate-300">{item.phone}</span>
                            ) : (
                              <span className="text-rose-400 italic text-[11px] flex items-center gap-1">
                                <Phone className="w-3 h-3" /> Telefon Yok
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPhoneFirmId(item.firm_id);
                                setEditedPhone(item.phone || '');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
                              title="Telefonu Düzenle"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Bakiye */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {balanceNum > 0 ? (
                          <span className="text-rose-400">
                            {balanceNum.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (Borçlu)
                          </span>
                        ) : balanceNum < 0 ? (
                          <span className="text-emerald-400">
                            {Math.abs(balanceNum).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (Alacaklı)
                          </span>
                        ) : (
                          <span className="text-slate-400">0.00 TL (Denk)</span>
                        )}
                      </td>

                      {/* Durum Rozeti */}
                      <td className="py-3 px-4 text-center">
                        {item.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mutabık
                          </span>
                        ) : item.status === 'DISPUTED' ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDisputeItem(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold hover:bg-rose-500/20 transition-colors"
                            title="Müşteri itiraz notunu incelemek için tıklayın"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Fark Bildirildi
                          </button>
                        ) : item.status === 'SENT' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium">
                            <Clock className="w-3.5 h-3.5" /> Yanıt Bekleniyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 text-[11px]">
                            Gönderilmedi
                          </span>
                        )}
                      </td>

                      {/* İşlemler */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* PDF İncele */}
                          <a
                            href={`/mutabakat/${item.token}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Resmi Mutabakat Mektubu ve Cari Ekstreyi İndir (PDF)"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          {/* Link Kopyala */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item.token)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                            title="Müşteri Onay Bağlantısını Kopyala"
                          >
                            {copiedToken === item.token ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {/* Tekli WhatsApp Gönder */}
                          <button
                            type="button"
                            onClick={() => handleSendSingle(item)}
                            disabled={sendingSingleId === item.id || !item.phone}
                            className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                            title="Tek Tıkla WhatsApp ile Gönder"
                          >
                            {sendingSingleId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. WHATSAPP QR KOD BAĞLANTI MODALI */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" /> WhatsApp Cihaz Bağla
              </h3>
              <button onClick={() => setShowQRModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mx-auto">
              {waStatus.qrCode ? (
                <QRCodeSVG value={waStatus.qrCode} size={220} />
              ) : waStatus.isConnected ? (
                <div className="w-[220px] h-[220px] flex flex-col items-center justify-center text-emerald-600 gap-2">
                  <CheckCircle2 className="w-16 h-16" />
                  <span className="font-bold text-sm">Bağlantı Başarılı!</span>
                </div>
              ) : (
                <div className="w-[220px] h-[220px] flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <span className="text-xs">QR Kod Üretiliyor...</span>
                </div>
              )}
            </div>

            <div className="text-left bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="font-bold text-emerald-400">Nasıl Bağlanır?</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Telefonunuzda WhatsApp'ı açın.</li>
                <li><b>Bağlı Cihazlar</b> menüsüne girin.</li>
                <li><b>Cihaz Bağla</b> butonuna basıp yukarıdaki QR kodu okutun.</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={handleRestartWhatsApp}
              disabled={isLoadingWa}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>QR Kodu Yenile</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. TOPLU GÖNDERİM ONAY MODALI */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-400 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Toplu WhatsApp Gönderimi</h3>
                <p className="text-xs text-slate-400">Cari Mutabakat & PDF Ekstre Dağıtımı</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Dönem:</span>
                <span className="font-bold text-white">{selectedPeriod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Toplam Hazır Firma:</span>
                <span className="font-bold text-white">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Telefonu Tanımlı Olanlar:</span>
                <span className="font-bold text-emerald-400">{items.filter(i => i.phone).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tahmini Gönderim Süresi:</span>
                <span className="font-bold text-slate-300">~{Math.ceil(items.filter(i => i.phone).length * 5 / 60)} dakika</span>
              </div>
            </div>

            <div className="bg-sky-950/20 border border-sky-800/40 p-3 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <b>Spam Koruması:</b> WhatsApp hesabınızın güvenliği için her mesaj arasında 4 ila 7 saniye arası insan benzeri gecikme uygulanacaktır.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleStartBatch}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gönderimi Başlat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MÜŞTERİ İTİRAZ / FARK BİLDİRİMİ MODALI */}
      {selectedDisputeItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" /> Müşteri Fark / İtiraz Bildirimi
              </div>
              <button onClick={() => setSelectedDisputeItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Firma:</span>
                <div className="text-white font-bold text-sm mt-0.5">{selectedDisputeItem.firm_name}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400">Bizdeki Bakiye:</span>
                  <div className="text-rose-400 font-bold mt-0.5 font-mono">
                    {selectedDisputeItem.balance?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Müşterinin Belirttiği:</span>
                  <div className="text-emerald-400 font-bold mt-0.5 font-mono">
                    {selectedDisputeItem.response_balance != null ? `${selectedDisputeItem.response_balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL` : 'Belirtilmedi'}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold">Müşteri Notu / Açıklaması:</span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-200 mt-1 italic">
                  "{selectedDisputeItem.response_note || 'Açıklama girilmedi.'}"
                </div>
              </div>

              <div className="text-[10px] text-slate-500 flex justify-between pt-2 border-t border-slate-800">
                <span>Yanıt Tarihi: {selectedDisputeItem.response_at ? new Date(selectedDisputeItem.response_at).toLocaleString('tr-TR') : '-'}</span>
                <span>IP: {selectedDisputeItem.client_ip || '-'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDisputeItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
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

export default Reconciliation;
