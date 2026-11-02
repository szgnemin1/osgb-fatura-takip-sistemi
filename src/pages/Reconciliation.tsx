import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { 
  FileCheck, QrCode, Smartphone, RefreshCw, Send, CheckCircle2, AlertCircle, 
  AlertTriangle, Clock, X, Check, Copy, Download, Search, 
  Loader2, Phone, Power, Edit2, ShieldAlert, Mail, Settings, AtSign
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ReconciliationItem, WhatsAppStatus, SmtpConfig, ReconciliationStats } from '../types';

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
  const [stats, setStats] = useState<ReconciliationStats>({
    total: 0,
    sent: 0,
    approved: 0,
    disputed: 0,
    pending: 0,
    hasPhone: 0,
    hasEmail: 0,
    hasBoth: 0,
    missingContact: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'DISPUTED' | 'SENT' | 'PENDING_SEND' | 'HAS_BOTH' | 'PHONE_ONLY' | 'EMAIL_ONLY' | 'MISSING_CONTACT'>('all');

  // WhatsApp Durumu
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({ isConnected: false, qrCode: null });
  const [isLoadingWa, setIsLoadingWa] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // SMTP Durumu ve Ayarları
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_address: ''
  });
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);

  // İletişim Bilgisi Düzenleme (Telefon & E-Posta)
  const [editingContactFirmId, setEditingContactFirmId] = useState<string | null>(null);
  const [editedPhone, setEditedPhone] = useState('');
  const [editedEmail, setEditedEmail] = useState('');

  // İtiraz / Not Görüntüleme Modalı
  const [selectedDisputeItem, setSelectedDisputeItem] = useState<ReconciliationItem | null>(null);

  // Toplu Gönderim State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; firmName?: string; channel?: string } | null>(null);

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

  const loadSmtpConfig = async () => {
    try {
      const cfg = await db.getSmtpConfig();
      setSmtpConfig(cfg);
    } catch (_) {}
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await db.getReconciliations(selectedPeriod);
      setItems(data.items || []);
      setStats(data.stats || {
        total: 0,
        sent: 0,
        approved: 0,
        disputed: 0,
        pending: 0,
        hasPhone: 0,
        hasEmail: 0,
        hasBoth: 0,
        missingContact: 0
      });
    } catch (err: any) {
      console.error('Mutabakat verileri yüklenemedi:', err);
      setErrorMsg(err.message || 'Veriler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWhatsAppStatus();
    loadSmtpConfig();
    loadData();

    // Periyodik kontrol: WhatsApp 5s, Mutabakat 7s
    const waInterval = setInterval(loadWhatsAppStatus, 5000);
    const dataInterval = setInterval(() => {
      db.getReconciliations(selectedPeriod).then(data => {
        if (data && data.items) {
          setItems(data.items);
          if (data.stats) setStats(data.stats);
        }
      }).catch(() => {});
    }, 7000);

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

  // SMTP Ayarlarını Kaydet
  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    setErrorMsg('');
    try {
      await db.saveSmtpConfig(smtpConfig);
      setSuccessMsg('SMTP e-posta ayarları başarıyla kaydedildi.');
      setShowSmtpModal(false);
      await loadSmtpConfig();
    } catch (err: any) {
      setErrorMsg(err.message || 'SMTP ayarları kaydedilemedi.');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // SMTP Test E-Postası Gönder
  const handleSendTestEmail = async () => {
    if (!testEmailTarget || !testEmailTarget.includes('@')) {
      setErrorMsg('Lütfen geçerli bir test e-posta adresi girin.');
      return;
    }
    setIsSendingTestMail(true);
    setErrorMsg('');
    try {
      const res = await db.sendTestEmail(testEmailTarget);
      setSuccessMsg(res.message || 'Test e-postası başarıyla iletildi.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Test e-postası gönderilemedi.');
    } finally {
      setIsSendingTestMail(false);
    }
  };

  // İletişim Bilgilerini Kaydet (Telefon & E-Posta)
  const handleSaveContact = async (firmId: string) => {
    try {
      await db.updateReconciliationContact(firmId, editedPhone, editedEmail);
      setEditingContactFirmId(null);
      setSuccessMsg("İletişim bilgileri başarıyla güncellendi.");
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'İletişim bilgileri güncellenemedi.');
    }
  };

  // Tekli Gönderim (Otomatik Kanal Seçimi: Maili olana mail, nosu olana no, ikisi olana ikisi)
  const handleSendSingle = async (item: ReconciliationItem) => {
    const hasPhone = Boolean(item.phone && item.phone.trim().length >= 10);
    const hasEmail = Boolean(item.email && item.email.includes('@'));

    if (!hasPhone && !hasEmail) {
      setErrorMsg(`"${item.firm_name}" için ne telefon ne de e-posta adresi kayıtlı. Lütfen düzenleyip bilgi ekleyiniz.`);
      return;
    }

    if (hasPhone && !hasEmail && !waStatus.isConnected) {
      setErrorMsg("WhatsApp bağlı değil! Lütfen önce QR kodu okutun.");
      setShowQRModal(true);
      return;
    }

    setSendingSingleId(item.id);
    setErrorMsg('');
    try {
      const res = await db.sendReconciliationSingle(item.id);
      setSuccessMsg(res.message || `"${item.firm_name}" firmasına mutabakat mektubu başarıyla iletildi.`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gönderim başarısız.');
    } finally {
      setSendingSingleId(null);
    }
  };

  // Toplu Çoklu Kanal Gönderimi
  const handleStartBatch = async () => {
    setShowBatchModal(false);
    setIsSendingBatch(true);
    const eligibleCount = items.filter(i => (i.phone && i.phone.trim().length >= 10) || (i.email && i.email.includes('@'))).length;
    setBatchProgress({ current: 0, total: eligibleCount });
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await db.sendReconciliationBatch(selectedPeriod);
      setSuccessMsg(res.message || 'Toplu gönderim başarıyla başlatıldı!');
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
                          (item.phone && item.phone.includes(searchTerm)) ||
                          (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    const hasPhone = Boolean(item.phone && item.phone.trim().length >= 10);
    const hasEmail = Boolean(item.email && item.email.includes('@'));

    if (statusFilter === 'all') return true;
    if (statusFilter === 'HAS_BOTH') return hasPhone && hasEmail;
    if (statusFilter === 'PHONE_ONLY') return hasPhone && !hasEmail;
    if (statusFilter === 'EMAIL_ONLY') return !hasPhone && hasEmail;
    if (statusFilter === 'MISSING_CONTACT') return !hasPhone && !hasEmail;
    return item.status === statusFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. ÜST BAŞLIK VE KANAL ENTEGRASYON KARTLARI (WHATSAPP + SMTP) */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
            <FileCheck className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" /> 
            Cari Mutabakat & Çoklu Kanal Dağıtım
          </h2>
          <p className="text-slate-400 mt-1 text-xs sm:text-sm">
            E-postası olana mail, telefonu olana WhatsApp, ikisi de olana iki kanaldan birden resmi PDF mutabakat mektubu iletin.
          </p>
        </div>

        {/* Entegrasyon Rozetleri (WhatsApp + E-Posta / SMTP) */}
        <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
          
          {/* WhatsApp Durum Rozeti */}
          <div className="flex items-center gap-2.5 p-2 px-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            <div className={`w-2.5 h-2.5 rounded-full ${waStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{waStatus.isConnected ? (waStatus.phoneNumber || 'WhatsApp Bağlı') : 'WhatsApp Bağlı Değil'}</span>
              </div>
            </div>
            <div className="pl-2 border-l border-slate-800">
              {waStatus.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectWhatsApp}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="WhatsApp Bağlantısını Kes"
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestartWhatsApp}
                  disabled={isLoadingWa}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  {isLoadingWa ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                  <span>QR Bağla</span>
                </button>
              )}
            </div>
          </div>

          {/* E-Posta / SMTP Durum Rozeti */}
          <div className="flex items-center gap-2.5 p-2 px-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
            <div className={`w-2.5 h-2.5 rounded-full ${smtpConfig.configured ? 'bg-sky-400' : 'bg-amber-500'}`} />
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>{smtpConfig.configured ? (smtpConfig.from_address || smtpConfig.user) : 'SMTP Yapılandırılmadı'}</span>
              </div>
            </div>
            <div className="pl-2 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setShowSmtpModal(true)}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-bold flex items-center gap-1 transition-colors border border-slate-700"
                title="E-Posta (SMTP) Sunucu Ayarlarını Yapılandır"
              >
                <Settings className="w-3 h-3" />
                <span>SMTP Ayarları</span>
              </button>
            </div>
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
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:opacity-90 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
          >
            {isSendingBatch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gönderiliyor...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Çoklu Kanal Toplu Gönderim Başlat</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. KPI İSTATİSTİK KARTLARI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium">Toplam Firma</div>
          <div className="text-xl sm:text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-sky-400 font-medium flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> + <Smartphone className="w-3.5 h-3.5" /> İkisi De
          </div>
          <div className="text-xl sm:text-2xl font-bold text-sky-300 mt-1">{stats.hasBoth || 0}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-purple-400 font-medium">İletilenler</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 mt-1">{stats.sent}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Mutabık
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{stats.approved}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Fark Var
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 mt-1">{stats.disputed}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Bekleyen
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-300 mt-1">{stats.pending}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> İletişim Yok
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 mt-1">{stats.missingContact || 0}</div>
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
            onClick={() => setStatusFilter('HAS_BOTH')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'HAS_BOTH' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            📱+✉️ İki Kanalı Olan ({stats.hasBoth || 0})
          </button>
          <button
            onClick={() => setStatusFilter('PHONE_ONLY')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'PHONE_ONLY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            📱 Sadece WhatsApp ({stats.hasPhone ? Math.max(0, stats.hasPhone - (stats.hasBoth || 0)) : 0})
          </button>
          <button
            onClick={() => setStatusFilter('EMAIL_ONLY')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'EMAIL_ONLY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            ✉️ Sadece E-Posta ({stats.hasEmail ? Math.max(0, stats.hasEmail - (stats.hasBoth || 0)) : 0})
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
            onClick={() => setStatusFilter('MISSING_CONTACT')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${statusFilter === 'MISSING_CONTACT' ? 'bg-rose-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            ⚠️ İletişim Bilgisi Eksik ({stats.missingContact || 0})
          </button>
        </div>

        {/* Arama Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Firma, telefon veya e-posta ara..."
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
                <th className="py-3 px-4">İletişim Bilgileri (WhatsApp & E-Posta)</th>
                <th className="py-3 px-4 text-center">Hedef Kanal</th>
                <th className="py-3 px-4 text-right">Dönem Bakiyesi</th>
                <th className="py-3 px-4 text-center">Mutabakat Durumu</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    <span>Mutabakat verileri hesaplanıyor...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Bu filtre ile eşleşen firma kaydı bulunamadı. "Listeyi Hesapla & Hazırla" butonuna basarak dönemi güncelleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isEditingContact = editingContactFirmId === item.firm_id;
                  const balanceNum = Number(item.balance) || 0;
                  const hasPhone = Boolean(item.phone && item.phone.trim().length >= 10);
                  const hasEmail = Boolean(item.email && item.email.includes('@'));

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

                      {/* İletişim Bilgileri (Telefon & E-Posta) */}
                      <td className="py-3 px-4">
                        {isEditingContact ? (
                          <div className="flex flex-col gap-1.5 bg-slate-950 p-2 rounded-xl border border-emerald-500/50">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <input
                                type="text"
                                value={editedPhone}
                                onChange={(e) => setEditedPhone(e.target.value)}
                                placeholder="05xx xxx xx xx"
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-36 outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <input
                                type="email"
                                value={editedEmail}
                                onChange={(e) => setEditedEmail(e.target.value)}
                                placeholder="muhasebe@firma.com"
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs w-48 outline-none focus:border-sky-500"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingContactFirmId(null)}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px]"
                              >
                                İptal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveContact(item.firm_id)}
                                className="px-2.5 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-[10px] font-bold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Kaydet
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1 group">
                            {/* Telefon */}
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                              {hasPhone ? (
                                <span className="font-mono text-slate-300">{item.phone}</span>
                              ) : (
                                <span className="text-slate-500 italic text-[10px]">Telefon Yok</span>
                              )}
                            </div>
                            {/* E-Posta */}
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                              {hasEmail ? (
                                <span className="text-slate-300 truncate max-w-[180px]" title={item.email}>{item.email}</span>
                              ) : (
                                <span className="text-slate-500 italic text-[10px]">E-Posta Yok</span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingContactFirmId(item.firm_id);
                                  setEditedPhone(item.phone || '');
                                  setEditedEmail(item.email || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition-opacity ml-auto"
                                title="İletişim Bilgilerini Düzenle"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Hedef Kanal Rozeti */}
                      <td className="py-3 px-4 text-center">
                        {hasPhone && hasEmail ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500/20 to-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-bold">
                            <span>📱 + ✉️ İkisi Birden</span>
                          </span>
                        ) : hasPhone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10.5px] font-medium">
                            <Smartphone className="w-3 h-3" /> Sadece WhatsApp
                          </span>
                        ) : hasEmail ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10.5px] font-medium">
                            <Mail className="w-3 h-3" /> Sadece E-Posta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                            ⚠️ İletişim Yok
                          </span>
                        )}

                        {item.sent_channels && (
                          <div className="text-[9.5px] text-slate-400 mt-1">
                            İletilen: <strong className="text-emerald-400">{item.sent_channels === 'BOTH' ? 'WhatsApp + E-Posta' : item.sent_channels}</strong>
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
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mutabık
                            </span>
                            {item.responder_name && (
                              <div className="text-[10px] text-slate-300 font-semibold mt-1 truncate max-w-[160px]" title={`${item.responder_name} (${item.responder_title || 'Yetkili'})`}>
                                👤 {item.responder_name} {item.responder_title ? `(${item.responder_title})` : ''}
                              </div>
                            )}
                          </div>
                        ) : item.status === 'DISPUTED' ? (
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => setSelectedDisputeItem(item)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold hover:bg-rose-500/20 transition-colors"
                              title="Müşteri itiraz notunu incelemek için tıklayın"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> Fark Bildirildi
                            </button>
                            {item.responder_name && (
                              <div className="text-[10px] text-rose-300/80 mt-1 truncate max-w-[160px]" title={`${item.responder_name} (${item.responder_title || 'Yetkili'})`}>
                                👤 {item.responder_name} {item.responder_title ? `(${item.responder_title})` : ''}
                              </div>
                            )}
                          </div>
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

                          {/* Tekli Çoklu Kanal Gönder */}
                          <button
                            type="button"
                            onClick={() => handleSendSingle(item)}
                            disabled={sendingSingleId === item.id || (!hasPhone && !hasEmail)}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                              hasPhone && hasEmail
                                ? 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'
                                : hasPhone
                                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                                : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                            }`}
                            title={
                              hasPhone && hasEmail
                                ? "Hem WhatsApp hem E-Posta ile Gönder"
                                : hasPhone
                                ? "WhatsApp ile Gönder"
                                : hasEmail
                                ? "E-Posta ile Gönder"
                                : "İletişim bilgisi eksik"
                            }
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

      {/* 7. SMTP / E-POSTA AYARLARI MODALI */}
      {showSmtpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-400" /> E-Posta (SMTP) Sunucu Ayarları
              </h3>
              <button onClick={() => setShowSmtpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSmtp} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1">SMTP Sunucu Host (Örn: smtp.gmail.com)</label>
                  <input
                    type="text"
                    required
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                    placeholder="587"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="secureToggle"
                  checked={smtpConfig.secure}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0"
                />
                <label htmlFor="secureToggle" className="text-slate-300 text-[11px] cursor-pointer">
                  SSL / TLS Kullan (Port 465 için zorunludur, Port 587 için kapalı tutunuz)
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kullanıcı Adı / E-Posta</label>
                <input
                  type="text"
                  required
                  value={smtpConfig.user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                  placeholder="muhasebe@sirketiniz.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Şifre / Uygulama Şifresi</label>
                <input
                  type="password"
                  value={smtpConfig.pass}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                  placeholder={smtpConfig.configured ? "Değiştirmek istemiyorsanız boş bırakın" : "SMTP şifreniz veya 16 haneli uygulama şifresi"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500"
                />
                
                {/* Gmail Uygulama Şifresi Rehberi */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-300 space-y-1.5 mt-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>💡 Gmail Kullanıcıları İçin Zorunlu Adım:</span>
                  </div>
                  <div className="text-slate-300 leading-relaxed">
                    Google güvenlik kuralları gereği standart Gmail şifrenizi kabul etmez. Google Hesabınızda 2 Adımlı Doğrulama etkinken <b>16 haneli bir Uygulama Şifresi</b> üretip buraya yapıştırmalısınız.
                  </div>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold underline pt-0.5"
                  >
                    👉 Buraya tıklayarak Google Uygulama Şifresi oluşturun (myaccount.google.com/apppasswords)
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Gönderici Başlığı & Adresi (Opsiyonel)</label>
                <input
                  type="text"
                  value={smtpConfig.from_address}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_address: e.target.value })}
                  placeholder='"OSGB ProFinans" <muhasebe@sirketiniz.com>'
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSmtpModal(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSmtp}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md shadow-sky-950"
                >
                  {isSavingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Ayarları Kaydet</span>
                </button>
              </div>
            </form>

            {/* Test E-Postası Alanı */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 mt-2 text-xs">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-sky-400" />
                <span>SMTP Bağlantı Testi</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  placeholder="Test alıcı e-postası (örn: adiniz@domain.com)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white outline-none text-xs focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTestMail}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg font-semibold flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
                >
                  {isSendingTestMail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  <span>Test Gönder</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 8. TOPLU GÖNDERİM ONAY MODALI */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-400 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                <Send className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Çoklu Kanal Toplu Mutabakat</h3>
                <p className="text-xs text-slate-400">WhatsApp & E-Posta Akıllı Dağıtım</p>
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
              <div className="flex justify-between pt-1 border-t border-slate-900">
                <span className="text-sky-300">📱 + ✉️ İkisi de Olanlar (Her iki kanaldan):</span>
                <span className="font-bold text-sky-400">{stats.hasBoth || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-300">📱 Sadece WhatsApp Olanlar:</span>
                <span className="font-bold text-emerald-400">{stats.hasPhone ? Math.max(0, stats.hasPhone - (stats.hasBoth || 0)) : 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-300">✉️ Sadece E-Postası Olanlar:</span>
                <span className="font-bold text-blue-400">{stats.hasEmail ? Math.max(0, stats.hasEmail - (stats.hasBoth || 0)) : 0}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>⚠️ İletişim Bilgisi Olmayan (Atlanacak):</span>
                <span className="font-bold">{stats.missingContact || 0}</span>
              </div>
            </div>

            <div className="bg-sky-950/20 border border-sky-800/40 p-3 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <b>Akıllı Dağıtım & Spam Güvenliği:</b> E-postası olana PDF ekli resmi e-posta, telefonu olana WhatsApp gönderilecek; ikisi olan firmalara ise her iki kanaldan birden iletilecektir. WhatsApp için insan benzeri 3-5 saniyelik anti-spam gecikmesi uygulanır.
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
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gönderimi Başlat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MÜŞTERİ İTİRAZ / FARK BİLDİRİMİ MODALI */}
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

              {selectedDisputeItem.responder_name && (
                <div>
                  <span className="text-slate-400">İtiraz Bildiren Yetkili:</span>
                  <div className="text-rose-300 font-semibold mt-0.5 flex items-center gap-1.5">
                    <span>👤 {selectedDisputeItem.responder_name} {selectedDisputeItem.responder_title ? `(${selectedDisputeItem.responder_title})` : ''}</span>
                  </div>
                </div>
              )}

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
