import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { 
  QrCode, Smartphone, RefreshCw, Send, CheckCircle2, AlertCircle, 
  AlertTriangle, Clock, X, Check, Copy, Download, Search, 
  Loader2, Phone, Power, Edit2, ShieldAlert, Mail, Settings, AtSign, Calendar, Bell, FileSpreadsheet, Archive, Paperclip,
  Bot, Zap, ChevronDown, ChevronUp, FileText, ArrowRight, MessageSquare
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { ReconciliationItem, WhatsAppStatus, SmtpConfig, ReconciliationStats, ReconciliationStage, QuarterScheduleInfo, AutopilotStatus } from '../types';

export const Reconciliation: React.FC = () => {
  const getInitialCutoffDate = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  const [selectedPeriod, setSelectedPeriod] = useState(getInitialCutoffDate);
  const [quarterSchedules, setQuarterSchedules] = useState<QuarterScheduleInfo[]>([]);
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | null>(null);

  // Otopilot State
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);
  const [isRunningAutopilotCheck, setIsRunningAutopilotCheck] = useState(false);
  const [showManualTools, setShowManualTools] = useState(false);
  const [showAutopilotLogsModal, setShowAutopilotLogsModal] = useState(false);
  
  // Şablon Önizleme Modalı
  const [previewStage, setPreviewStage] = useState<ReconciliationStage | null>(null);
  const [previewData, setPreviewData] = useState<{ emailSubject: string; whatsappCaption: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // İlk Gönderim Kuralı (7 Günlük e-Fatura / Ayın 8'i) Uyarı Modalı
  const [earlySendWarning, setEarlySendWarning] = useState<{
    isTooEarly: boolean;
    warning: string;
    recommendedDate: string;
    action: 'single' | 'batch';
    targetId?: string;
    stage?: ReconciliationStage;
  } | null>(null);

  // Veri Listeleri
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [pendingItems, setPendingItems] = useState<ReconciliationItem[]>([]);
  const [approvedItems, setApprovedItems] = useState<ReconciliationItem[]>([]);
  const [disputedItems, setDisputedItems] = useState<ReconciliationItem[]>([]);

  // Kolay Anlaşılır Eylemsel Sekmeler: DISPUTED | PENDING | APPROVED | ALL
  const [activeTab, setActiveTab] = useState<'DISPUTED' | 'PENDING' | 'APPROVED' | 'ALL'>('PENDING');

  // Mutabıklar Sekmesi State'leri
  const [approvedSearchTerm, setApprovedSearchTerm] = useState('');
  const [showOnlyLatestApproved, setShowOnlyLatestApproved] = useState(true);

  // İstatistikler
  const [stats, setStats] = useState<ReconciliationStats>({
    total: 0,
    sent: 0,
    approved: 0,
    disputed: 0,
    pending: 0,
    allPendingCount: 0,
    allApprovedCount: 0,
    allDisputedCount: 0,
    hasPhone: 0,
    hasEmail: 0,
    hasBoth: 0,
    missingContact: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'DISPUTED' | 'SENT' | 'PENDING_SEND' | 'HAS_BOTH' | 'PHONE_ONLY' | 'EMAIL_ONLY' | 'MISSING_CONTACT'>('all');

  const formatDateTR = (dateStr: string) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    }
    return dateStr;
  };

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

  // Yönetici Bildirim Numarası State (Durum Işığına Entegre)
  const [managerPhone, setManagerPhone] = useState('');
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [tempManagerPhone, setTempManagerPhone] = useState('');
  const [isSavingManagerPhone, setIsSavingManagerPhone] = useState(false);
  const [isTestingManagerPhone, setIsTestingManagerPhone] = useState(false);
  const [managerModalSuccess, setManagerModalSuccess] = useState('');
  const [managerModalError, setManagerModalError] = useState('');

  // İletişim Bilgisi Düzenleme (Telefon & E-Posta)
  const [editingContactFirmId, setEditingContactFirmId] = useState<string | null>(null);
  const [editedPhone, setEditedPhone] = useState('');
  const [editedEmail, setEditedEmail] = useState('');

  // İtiraz / Not Görüntüleme Modalı (Tablodan açılabilmesi için)
  const [selectedDisputeItem, setSelectedDisputeItem] = useState<ReconciliationItem | null>(null);

  // Toplu Gönderim State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<'ALL' | 'OVERDUE'>('ALL');
  const [isRemindingBulk, setIsRemindingBulk] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);

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

  const loadManagerSettings = async () => {
    try {
      const res = await db.getReconciliationSettings();
      setManagerPhone(res.managerPhone || '');
    } catch (_) {}
  };

  const loadAutopilotStatus = async () => {
    try {
      const res = await db.getAutopilotStatus();
      setAutopilotStatus(res);
    } catch (_) {}
  };

  const handleRunAutopilotCheck = async () => {
    try {
      setIsRunningAutopilotCheck(true);
      const res = await db.runAutopilotCheckNow(true);
      await loadAutopilotStatus();
      await loadData();
      setSuccessMsg('Otopilot kontrolü başarıyla tamamlandı: ' + (res.message || 'İşlemler güncellendi.'));
    } catch (e: any) {
      setErrorMsg('Otopilot kontrol hatası: ' + e.message);
    } finally {
      setIsRunningAutopilotCheck(false);
    }
  };

  const handleSaveManagerPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingManagerPhone(true);
    setManagerModalError('');
    setManagerModalSuccess('');
    try {
      const res = await db.saveReconciliationSettings(tempManagerPhone);
      setManagerPhone(res.managerPhone);
      setManagerModalSuccess('Yönetici bildirim numarası başarıyla kaydedildi.');
      setTimeout(() => setShowManagerModal(false), 1200);
      await loadData();
    } catch (err: any) {
      setManagerModalError(err.message || 'Numara kaydedilemedi.');
    } finally {
      setIsSavingManagerPhone(false);
    }
  };

  const handleTestManagerPhone = async () => {
    setIsTestingManagerPhone(true);
    setManagerModalError('');
    setManagerModalSuccess('');
    try {
      const res = await db.testManagerNotification(tempManagerPhone);
      setManagerModalSuccess(res.message || 'Test bildirimi WhatsApp üzerinden başarıyla iletildi.');
    } catch (err: any) {
      setManagerModalError(err.message || 'Test bildirimi gönderilemedi.');
    } finally {
      setIsTestingManagerPhone(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await db.getReconciliations(selectedPeriod);
      setItems(data.items || []);
      setPendingItems(data.pendingItems || []);
      setApprovedItems(data.approvedItems || []);
      if (data.disputedItems) setDisputedItems(data.disputedItems);
      setStats(data.stats || {
        total: 0,
        sent: 0,
        approved: 0,
        disputed: 0,
        pending: 0,
        allPendingCount: 0,
        hasPhone: 0,
        hasEmail: 0,
        hasBoth: 0,
        missingContact: 0
      });
      // Eğer itiraz / fark varsa ve kullanıcı pending sekmesindeyse itiraza odakla
      if (data.disputedItems && data.disputedItems.length > 0 && activeTab === 'PENDING') {
        setActiveTab('DISPUTED');
      }
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
    loadManagerSettings();
    loadQuarterSchedules();
    loadAutopilotStatus();
    loadData();

    // Periyodik kontrol: WhatsApp 5s, Mutabakat 7s, Otopilot 10s
    const waInterval = setInterval(loadWhatsAppStatus, 5000);
    const apInterval = setInterval(loadAutopilotStatus, 10000);
    const dataInterval = setInterval(() => {
      db.getReconciliations(selectedPeriod).then(data => {
        if (data) {
          if (data.items) setItems(data.items);
          if (data.pendingItems) setPendingItems(data.pendingItems);
          if (data.approvedItems) setApprovedItems(data.approvedItems);
          if (data.disputedItems) setDisputedItems(data.disputedItems);
          if (data.stats) setStats(data.stats);
        }
      }).catch(() => {});
    }, 7000);

    return () => {
      clearInterval(waInterval);
      clearInterval(apInterval);
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

  // Tekli Gönderim
  const handleSendSingle = async (item: ReconciliationItem, stage: ReconciliationStage = 'INITIAL', force = false) => {
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
      const res = await db.sendReconciliationSingle(item.id, stage, force);
      if (res.isTooEarly && !force) {
        setEarlySendWarning({
          isTooEarly: true,
          warning: res.warning || '',
          recommendedDate: res.recommendedDate || '',
          action: 'single',
          targetId: item.id,
          stage
        });
        return;
      }
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

  // Durumu Sıfırla (Gönderilmedi Durumuna Al)
  const handleResetStatus = async (id: string) => {
    if (!window.confirm("Bu mutabakat durumunu sıfırlayıp 'Gönderilmedi' durumuna almak istediğinize emin misiniz?")) return;
    try {
      await db.resetReconciliationStatus(id);
      setSuccessMsg("Mutabakat durumu başarıyla sıfırlandı.");
      await loadData();
    } catch (e: any) {
      setErrorMsg("Durum sıfırlanamadı: " + e.message);
    }
  };

  // Filtreleme (Genel Tablo İçin)
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

  // Mutabıklar Listesi İçin Filtreleme
  const filteredApproved = approvedItems.filter(item => {
    if (showOnlyLatestApproved && !item.is_latest) return false;
    if (!approvedSearchTerm.trim()) return true;
    const term = approvedSearchTerm.toLowerCase();
    return (
      (item.firm_name && item.firm_name.toLowerCase().includes(term)) ||
      (item.phone && item.phone.includes(term)) ||
      (item.email && item.email.toLowerCase().includes(term)) ||
      (item.responder_name && item.responder_name.toLowerCase().includes(term))
    );
  });

  // Onay Bekleyenler Listesi İçin Filtreleme
  const filteredPending = pendingItems.filter(item => {
    if (pendingFilter === 'OVERDUE') {
      const days = item.sent_at ? Math.floor((Date.now() - new Date(item.sent_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return days >= 3;
    }
    return true;
  });

  const overduePendingCount = pendingItems.filter(item => {
    const days = item.sent_at ? Math.floor((Date.now() - new Date(item.sent_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    return days >= 3;
  }).length;

  // İtiraz / Fark Listesi (Tarihten bağımsız disputedItems öncelikli)
  const effectiveDisputed = disputedItems.length > 0 ? disputedItems : items.filter(i => i.status === 'DISPUTED');

  const handleBulkRemind = async (stage: ReconciliationStage = 'REMINDER_1', minDays = 0) => {
    if (isRemindingBulk) return;
    const confirmMsg = minDays > 0 
      ? `3 günden uzun süredir yanıt vermeyen tüm firmalara (${overduePendingCount} firma) tekrar mutabakat mektubu ve hatırlatma iletilecektir. Devam edilsin mi?`
      : `Onay bekleyen tüm firmalara (${pendingItems.length} firma) tekrar mutabakat hatırlatması iletilecektir. Devam edilsin mi?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsRemindingBulk(true);
      const res = await db.remindPendingReconciliations(undefined, minDays, stage);
      setSuccessMsg(res.message || 'Hatırlatma gönderim kuyruğu başlatıldı.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Hatırlatma başlatılamadı.');
    } finally {
      setIsRemindingBulk(false);
    }
  };

  const handleExportZip = async (period?: string) => {
    if (isExportingZip) return;
    try {
      setIsExportingZip(true);
      await db.downloadReconciliationZip(period, 'APPROVED');
      setSuccessMsg('Onaylı mutabakat PDF arşivi (ZIP) başarıyla indirildi.');
    } catch (err: any) {
      setErrorMsg(err.message || 'ZIP arşivi indirilemedi: ' + err.message);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportApprovedToExcel = () => {
    if (filteredApproved.length === 0) return;
    const exportData = filteredApproved.map((item, idx) => {
      const recBal = Number(item.balance) || 0;
      const currBal = Number(item.current_balance !== undefined ? item.current_balance : item.balance) || 0;
      const diff = currBal - recBal;
      return {
        'Sıra': idx + 1,
        'Firma Adı': item.firm_name,
        'Telefon': item.phone || '',
        'E-Posta': item.email || '',
        'Son Mutabakat Dönemi': item.period,
        'Müşteri Onay Zamanı': item.response_at ? new Date(item.response_at).toLocaleString('tr-TR') : '',
        'O Sıra Olan Bakiye (TL)': recBal,
        'Anlık Güncel Bakiye (TL)': currBal,
        'Bakiye Değişimi (TL)': diff,
        'Durum': Math.abs(diff) < 0.01 ? 'Bakiye Denk (Değişmedi)' : diff > 0 ? 'Borç Arttı (+)' : 'Ödeme/Alacak Arttı (-)',
        'Onaylayan Yetkili': item.responder_name ? `${item.responder_name} (${item.responder_title || 'Yetkili'})` : '',
        'Onay IP': item.client_ip || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mutabık Firmalar");
    XLSX.writeFile(wb, `Mutabik_Firmalar_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const loadQuarterSchedules = async () => {
    try {
      const year = new Date(selectedPeriod || new Date()).getFullYear();
      const res = await db.getReconciliationSchedules(year);
      setQuarterSchedules(res.schedules || []);
      detectActiveQuarter(selectedPeriod, res.schedules || []);
    } catch (_) {}
  };

  const detectActiveQuarter = (period: string, schedules: QuarterScheduleInfo[]) => {
    if (!period) return;
    const match = schedules.find(s => s.cutoffDate === period);
    if (match) setSelectedQuarterKey(match.quarterKey);
    else {
      const m = parseInt(period.split('-')[1], 10);
      if (m === 3) setSelectedQuarterKey('Q1');
      else if (m === 6) setSelectedQuarterKey('Q2');
      else if (m === 9) setSelectedQuarterKey('Q3');
      else if (m === 12) setSelectedQuarterKey('Q4');
      else setSelectedQuarterKey(null);
    }
  };

  const handleSelectQuarter = (qKey: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    setSelectedQuarterKey(qKey);
    const targetSched = quarterSchedules.find(s => s.quarterKey === qKey);
    if (targetSched) {
      setSelectedPeriod(targetSched.cutoffDate);
    } else {
      const year = new Date().getFullYear();
      if (qKey === 'Q1') setSelectedPeriod(`${year}-03-31`);
      else if (qKey === 'Q2') setSelectedPeriod(`${year}-06-30`);
      else if (qKey === 'Q3') setSelectedPeriod(`${year}-09-30`);
      else if (qKey === 'Q4') setSelectedPeriod(`${year}-12-31`);
    }
  };

  const openPreviewModal = async (stage: ReconciliationStage) => {
    try {
      setIsLoadingPreview(true);
      setPreviewStage(stage);
      const data = await db.getTemplatePreview(stage, selectedPeriod);
      setPreviewData(data);
    } catch (e: any) {
      setErrorMsg('Şablon önizleme yüklenemedi: ' + e.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmEarlySend = async () => {
    if (!earlySendWarning) return;
    const { action, targetId, stage } = earlySendWarning;
    setEarlySendWarning(null);

    if (action === 'single' && targetId) {
      const targetItem = items.find(i => i.id === targetId) || pendingItems.find(i => i.id === targetId);
      if (targetItem) {
        await handleSendSingle(targetItem, stage || 'INITIAL', true);
      }
    } else if (action === 'batch') {
      await handleSendBatch(stage || 'INITIAL', true);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. ÜST BAŞLIK & DURUM IŞIKLARI (DURUM IŞIĞINDAN YÖNETİCİ NO DÜZENLEME) */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-emerald-400" /> 
            Cari Mutabakat & Otomatik Otopilot
          </h2>
          <p className="text-slate-400 mt-0.5 text-xs">
            4 çeyrek dönem yasal takvimine göre otopilot devrededir; müşteri yanıtları anında yöneticiye bildirilir.
          </p>
        </div>

        {/* Durum Işıkları & Entegrasyon Rozetleri */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          
          {/* WhatsApp Durum Işığı */}
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${waStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{waStatus.isConnected ? (waStatus.phoneNumber || 'WhatsApp Bağlı') : 'WhatsApp Bağlı Değil'}</span>
            </div>
            <div className="pl-1.5 border-l border-slate-800">
              {waStatus.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectWhatsApp}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="WhatsApp Bağlantısını Kes"
                >
                  <Power className="w-3 h-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRestartWhatsApp}
                  disabled={isLoadingWa}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10.5px] font-bold flex items-center gap-1 transition-colors"
                >
                  {isLoadingWa ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                  <span>QR Bağla</span>
                </button>
              )}
            </div>
          </div>

          {/* E-Posta / SMTP Durum Işığı */}
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${smtpConfig.configured ? 'bg-sky-400' : 'bg-amber-500'}`} />
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span>{smtpConfig.configured ? (smtpConfig.from_address || smtpConfig.user) : 'SMTP Yapılandırılmadı'}</span>
            </div>
            <div className="pl-1.5 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setShowSmtpModal(true)}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-[10.5px] font-bold flex items-center gap-1 transition-colors border border-slate-700"
                title="E-Posta (SMTP) Sunucu Ayarlarını Yapılandır"
              >
                <Settings className="w-3 h-3" />
                <span>SMTP</span>
              </button>
            </div>
          </div>

          {/* 🔔 YÖNETİCİ NUMARASI DURUM IŞIĞI (TIKLAYARAK ANINDA NUMARA YAZMA & DÜZENLEME) */}
          <button
            type="button"
            onClick={() => {
              setTempManagerPhone(managerPhone);
              setManagerModalError('');
              setManagerModalSuccess('');
              setShowManagerModal(true);
            }}
            className={`flex items-center gap-2 py-1 px-3 rounded-xl border shadow-sm transition-all group cursor-pointer text-left ${
              managerPhone 
                ? 'bg-slate-900 hover:bg-slate-800/80 border-amber-500/40 hover:border-amber-400' 
                : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/60 hover:border-rose-400 animate-pulse'
            }`}
            title="Müşteri yanıtlarının (Onay / İtiraz) anında geleceği yönetici WhatsApp numarasını belirlemek veya değiştirmek için tıklayın"
          >
            <div className="relative">
              <div className={`w-2.5 h-2.5 rounded-full ${managerPhone ? 'bg-amber-400 animate-pulse' : 'bg-rose-500 animate-ping'}`} />
              {managerPhone && <div className="w-2.5 h-2.5 rounded-full bg-amber-400/40 absolute inset-0 animate-ping" />}
            </div>
            <div>
              <div className={`text-[9.5px] font-bold leading-none ${managerPhone ? 'text-slate-400' : 'text-rose-300'}`}>
                {managerPhone ? 'Yönetici Bildirim Hattı' : '⚠️ Yönetici Numarası Yok'}
              </div>
              <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5 font-mono">
                {managerPhone ? (
                  <>
                    <span className="text-amber-300">{managerPhone}</span>
                    <Edit2 className="w-2.5 h-2.5 text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </>
                ) : (
                  <>
                    <span className="text-rose-200">Numara Yaz / Belirle</span>
                    <span className="text-[10px] text-rose-300 underline">Tıkla ↗</span>
                  </>
                )}
              </div>
            </div>
          </button>

        </div>
      </header>

      {/* BİLDİRİMLER */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400/60 hover:text-emerald-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400/60 hover:text-rose-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. OTOPİLOT TAKİP ŞERİDİ (KOMPAKT & BİLGİLENDİRİCİ) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/25 border border-emerald-500/30 rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-white">7/24 Otopilot Devrede:</span>
              {autopilotStatus?.nextScheduledEvent ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🗓️ {autopilotStatus.nextScheduledEvent.quarterName} • {autopilotStatus.nextScheduledEvent.stageName} ({formatDateTR(autopilotStatus.nextScheduledEvent.targetDate)})</span>
                  {autopilotStatus.nextScheduledEvent.isToday ? (
                    <b className="text-amber-300 ml-1">⚡ BUGÜN</b>
                  ) : (
                    <span className="text-slate-400 ml-1">({autopilotStatus.nextScheduledEvent.daysRemaining} gün kaldı)</span>
                  )}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Takvim takip ediliyor...</span>
              )}
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Tarih seçimi ve gönderim otopilot tarafından yönetilir. Müşteri yanıtları doğrudan yönetici WhatsApp hattına iletilir.
            </p>
          </div>
        </div>

        {/* Otopilot Kontrol & Günlük Butonları */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={handleRunAutopilotCheck}
            disabled={isRunningAutopilotCheck}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Otopilot kontrolünü şimdi çalıştırarak bugüne denk gelen görevleri kontrol et"
          >
            {isRunningAutopilotCheck ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />}
            <span>Kontrolü Çalıştır</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAutopilotLogsModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1"
            title="Otopilotun yaptığı tüm otomatik işlem günlüklerini gör"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Günlükler</span>
          </button>
        </div>
      </div>

      {/* 3. BÜYÜK 3 ODAK KARTI (KOLAY ANLAŞILIR KOKPİT) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* KART 1: ⚠️ İNCELEME GEREKENLER (FARK / İTİRAZ BİLDİRENLER) */}
        <div
          onClick={() => setActiveTab('DISPUTED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            activeTab === 'DISPUTED'
              ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/40 shadow-lg shadow-rose-950/40'
              : 'bg-slate-900 border-rose-500/30 hover:border-rose-500/70 hover:bg-rose-950/20'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Fark / İtiraz Bildirimi
              </span>
              {effectiveDisputed.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-extrabold border border-rose-500/40 animate-pulse">
                  🚨 {effectiveDisputed.length} İnceleme Gerekiyor
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                  ✅ İtiraz Yok
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white font-mono">{effectiveDisputed.length}</span>
              <span className="text-xs text-rose-300 font-semibold">Firma</span>
            </div>

            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Müşterinin belirttiği bakiye farkları, itiraz açıklamaları ve yüklenen ekstre belgeleri.
            </p>
          </div>

          <div className="pt-3 mt-2 border-t border-rose-500/20 flex items-center justify-between text-xs">
            <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1 group-hover:underline">
              <span>İtirazları İncele</span>
              <ArrowRight className="w-3 h-3 text-rose-400" />
            </span>
            <span className="text-[10px] text-slate-400">Yöneticiye İletildi</span>
          </div>
        </div>

        {/* KART 2: ⏳ MÜŞTERİ ONAYI BEKLEYENLER */}
        <div
          onClick={() => setActiveTab('PENDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            activeTab === 'PENDING'
              ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/40'
              : 'bg-slate-900 border-amber-500/30 hover:border-amber-500/70 hover:bg-amber-950/20'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" /> Onay Bekleyenler
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-500/40">
                Otopilot Takip Döngüsü
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white font-mono">{pendingItems.length}</span>
              <span className="text-xs text-amber-300 font-semibold">Firma Yanıtı Bekleniyor</span>
            </div>

            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              4 aşamalı yasal takvime göre takip edilen ve henüz onay vermeyen mutabakatlar.
            </p>
          </div>

          <div className="pt-3 mt-2 border-t border-amber-500/20 flex items-center justify-between text-xs">
            <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1 group-hover:underline">
              <span>Takip Listesini Aç</span>
              <ArrowRight className="w-3 h-3 text-amber-400" />
            </span>
            {overduePendingCount > 0 && (
              <span className="text-[10px] text-rose-300 font-bold bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                {overduePendingCount} Geciken
              </span>
            )}
          </div>
        </div>

        {/* KART 3: 🟢 MUTABIK KALINANLAR & ARŞİV */}
        <div
          onClick={() => setActiveTab('APPROVED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
            activeTab === 'APPROVED'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/40'
              : 'bg-slate-900 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/20'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Mutabıklar & Arşiv
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/40">
                Resmi İmzalı Onaylar
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white font-mono">
                {approvedItems.filter(i => i.is_latest).length}
              </span>
              <span className="text-xs text-emerald-300 font-semibold">Firma Onayladı</span>
            </div>

            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Yetkilisi tarafından onaylanan mektuplar ve mutabakat anı ile güncel anlık bakiye eşleşmesi.
            </p>
          </div>

          <div className="pt-3 mt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1 group-hover:underline">
              <span>Onaylı Listeyi Gör</span>
              <ArrowRight className="w-3 h-3 text-emerald-400" />
            </span>
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleExportZip()}
                disabled={approvedItems.length === 0 || isExportingZip}
                className="px-2 py-0.5 rounded-md bg-sky-700/80 hover:bg-sky-600 text-sky-100 text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-40"
                title="Tüm onaylı resmi PDF mektuplarını tek bir ZIP olarak indir"
              >
                <Archive className="w-3 h-3 text-sky-300" />
                <span>ZIP</span>
              </button>
              <button
                type="button"
                onClick={handleExportApprovedToExcel}
                disabled={filteredApproved.length === 0}
                className="px-2 py-0.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-emerald-100 text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-40"
                title="Mutabık firmalar tablosunu Excel formatında indir"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-300" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 4. EYLEMSEL SEKME ÇUBUĞU (ACTION-ORIENTED TABS) */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 pt-1 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs">
          {/* Sekme 1: İnceleme Gerekenler */}
          <button
            type="button"
            onClick={() => setActiveTab('DISPUTED')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-xs ${
              activeTab === 'DISPUTED'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>⚠️ İnceleme Gerekenler (Farklar)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
              activeTab === 'DISPUTED' ? 'bg-white/20 text-white' : effectiveDisputed.length > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
            }`}>
              {effectiveDisputed.length}
            </span>
          </button>

          {/* Sekme 2: Onay Bekleyenler */}
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-xs ${
              activeTab === 'PENDING'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>⏳ Onay Bekleyenler</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
              activeTab === 'PENDING' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {pendingItems.length}
            </span>
          </button>

          {/* Sekme 3: Mutabıklar & Arşiv */}
          <button
            type="button"
            onClick={() => setActiveTab('APPROVED')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-xs ${
              activeTab === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>✅ Mutabıklar & Arşiv</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
              activeTab === 'APPROVED' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {approvedItems.filter(i => i.is_latest).length}
            </span>
          </button>

          {/* Sekme 4: Genel Liste */}
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-xs ${
              activeTab === 'ALL'
                ? 'bg-slate-700 text-white shadow-md shadow-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📋 Tüm Firmalar & Cari Hareketler</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
              activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {items.length}
            </span>
          </button>
        </div>

        {/* Sağ Taraf: Manuel Araçlar Aç/Kapa Düğmesi */}
        <button
          type="button"
          onClick={() => setShowManualTools(!showManualTools)}
          className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
        >
          <Settings className="w-3 h-3 text-slate-400" />
          <span>{showManualTools ? 'Manuel Araçları Gizle' : 'Manuel / Tarih Araçları'}</span>
          {showManualTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 5. SEKME İÇERİKLERİ */}
      <div className="space-y-4">
        
        {/* ============================================================ */}
        {/* SEKME 1: ⚠️ İNCELEME GEREKENLER (FARK / İTİRAZ BİLDİRİMLERİ) */}
        {/* ============================================================ */}
        {activeTab === 'DISPUTED' && (
          <div className="space-y-3 animate-in fade-in">
            {effectiveDisputed.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-80" />
                <h4 className="text-white font-bold text-sm">Harika! İncelenmesi gereken bir bakiye itirazı veya ekstre farkı bulunmuyor.</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Müşterileriniz mutabakat linki üzerinden "Mutabık Değiliz" seçip açıklama veya ekstre yüklediğinde burada listelenir ve yönetici WhatsApp hattına anlık bildirim düşer.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Firma Adı & İletişim</th>
                        <th className="py-2.5 px-3">Dönem & Zaman</th>
                        <th className="py-2.5 px-3">İtiraz Eden Yetkili</th>
                        <th className="py-2.5 px-3 text-right">Bizdeki Bakiye</th>
                        <th className="py-2.5 px-3 text-right">Müşteri Beyanı</th>
                        <th className="py-2.5 px-3 text-center">Fark Durumu</th>
                        <th className="py-2.5 px-3">Müşteri Notu & Yüklenen Belge</th>
                        <th className="py-2.5 px-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {effectiveDisputed.map((item) => {
                        const recBal = Number(item.balance) || 0;
                        const clientBal = item.response_balance != null ? Number(item.response_balance) : null;
                        const diff = clientBal != null ? (recBal - clientBal) : null;
                        const cleanPhone = (item.phone || '').replace(/\D/g, '');

                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Firma Adı & İletişim */}
                            <td className="py-2 px-3">
                              <div className="font-semibold text-white text-xs leading-tight">{item.firm_name}</div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                {item.phone && (
                                  <span className="font-mono text-emerald-400 flex items-center gap-0.5">
                                    <Phone className="w-2.5 h-2.5" /> {item.phone}
                                  </span>
                                )}
                                {item.email && (
                                  <span className="text-sky-400 truncate max-w-[130px]" title={item.email}>
                                    ✉️ {item.email}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Dönem & İtiraz Zamanı */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10.5px] border border-slate-700">
                                🗓️ {formatDateTR(item.period)}
                              </span>
                              {item.response_at && (
                                <div className="text-[10px] text-rose-300/80 mt-0.5">
                                  ⏰ {new Date(item.response_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              )}
                            </td>

                            {/* İtiraz Eden Yetkili */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="font-semibold text-rose-300 text-xs">
                                👤 {item.responder_name || 'Yetkili'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {item.responder_title || 'Yetkili'}
                              </div>
                              {item.client_ip && (
                                <div className="text-[9px] text-slate-500 font-mono">
                                  IP: {item.client_ip}
                                </div>
                              )}
                            </td>

                            {/* Bizdeki Bakiye */}
                            <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {recBal > 0 ? (
                                <span className="text-rose-400">{recBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[9.5px] font-normal">(Borç)</span></span>
                              ) : recBal < 0 ? (
                                <span className="text-emerald-400">{Math.abs(recBal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[9.5px] font-normal">(Alacak)</span></span>
                              ) : (
                                <span className="text-slate-400">0.00 TL</span>
                              )}
                            </td>

                            {/* Müşterinin Belirttiği */}
                            <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {clientBal != null ? (
                                <span className="text-amber-300 font-bold">{clientBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</span>
                              ) : (
                                <span className="text-slate-500 italic text-[10.5px]">Belirtilmedi</span>
                              )}
                            </td>

                            {/* Fark Durumu */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {diff != null ? (
                                Math.abs(diff) < 0.01 ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                    <Check className="w-3 h-3" /> Denk
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold" title="Kayıtlarımız ile müşteri bildirimi arasındaki bakiye farkı">
                                    Fark: {Math.abs(diff).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold">
                                  Fark Bildirildi
                                </span>
                              )}
                            </td>

                            {/* Müşteri Notu & Belge */}
                            <td className="py-2 px-3 max-w-xs">
                              {item.response_note ? (
                                <div 
                                  className="text-slate-300 text-[11px] truncate cursor-pointer hover:text-white hover:underline"
                                  onClick={() => setSelectedDisputeItem(item)}
                                  title={item.response_note}
                                >
                                  "{item.response_note}"
                                </div>
                              ) : (
                                <div className="text-slate-500 italic text-[10px]">Açıklama yok</div>
                              )}

                              {item.dispute_file_name ? (
                                <div className="mt-1">
                                  <a
                                    href={`/api/mutabakat/dispute-file/${item.token}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-bold transition-colors"
                                    title="Karşı firmanın yüklediği ekstreyi indir / aç"
                                  >
                                    <Paperclip className="w-3 h-3 text-sky-400 shrink-0" />
                                    <span className="truncate max-w-[140px] font-mono">{item.dispute_file_name}</span>
                                    <Download className="w-2.5 h-2.5 text-sky-300 ml-0.5 shrink-0" />
                                  </a>
                                </div>
                              ) : (
                                <div className="text-[9.5px] text-slate-500 mt-0.5">Dosya yüklenmedi</div>
                              )}
                            </td>

                            {/* İşlemler */}
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/90${cleanPhone.replace(/^0+/, '').replace(/^90/, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                                    title="Müşteriyle WhatsApp'tan İletişime Geç"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedDisputeItem(item)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="İtiraz Detaylarını Gör"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={`/mutabakat/${item.token}/pdf`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="Resmi Mutabakat Mektubunu İndir / Önizle (PDF)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(item.token)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="Onay Linkini Kopyala"
                                >
                                  {copiedToken === item.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetStatus(item.id)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Durumu Sıfırla (Gönderilmediye Al)"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SEKME 2: ⏳ MÜŞTERİ ONAYI BEKLEYENLER */}
        {/* ============================================================ */}
        {activeTab === 'PENDING' && (
          <div className="space-y-3 animate-in fade-in">
            {/* Üst Filtre & Toplu Hatırlatma Butonları */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setPendingFilter('ALL')}
                    className={`px-3 py-1 rounded-md transition-all font-semibold ${pendingFilter === 'ALL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Tümü ({pendingItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingFilter('OVERDUE')}
                    className={`px-3 py-1 rounded-md transition-all font-semibold flex items-center gap-1.5 ${pendingFilter === 'OVERDUE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <span>⏳ 3+ Gün Bekleyenler</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-bold">{overduePendingCount}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkRemind('REMINDER_1', pendingFilter === 'OVERDUE' ? 3 : 0)}
                  disabled={filteredPending.length === 0 || isRemindingBulk}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
                  title="Listelenen tüm firmalara otomatik hatırlatma gönder"
                >
                  {isRemindingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                  <span>{pendingFilter === 'OVERDUE' ? 'Gecikenlere Toplu Hatırlat' : 'Tümüne Hatırlat'}</span>
                </button>
              </div>
            </div>

            {/* Bekleyenler Tablosu */}
            {filteredPending.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2 opacity-80" />
                <h4 className="text-white font-bold text-sm">Şu an müşteri onayı bekleyen açık mutabakat bulunmuyor.</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Otopilot bir sonraki çeyrek dönem yasal tarihinde firmalara otomatik bildirim gönderecektir.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Firma Adı & İletişim</th>
                        <th className="py-2.5 px-3">Kesim Tarihi</th>
                        <th className="py-2.5 px-3 text-right">Mutabakat Bakiyesi</th>
                        <th className="py-2.5 px-3 text-center">Gönderilen Kanal</th>
                        <th className="py-2.5 px-3 text-center">Gönderim & Bekleme Süresi</th>
                        <th className="py-2.5 px-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredPending.map((pItem) => {
                        const balanceNum = Number(pItem.balance) || 0;
                        const sentTime = pItem.sent_at ? new Date(pItem.sent_at).getTime() : 0;
                        const daysWaiting = sentTime ? Math.floor((Date.now() - sentTime) / (1000 * 60 * 60 * 24)) : 0;
                        return (
                          <tr key={pItem.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2 px-3">
                              <div className="font-semibold text-white text-xs">{pItem.firm_name}</div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                {pItem.phone && <span>📱 {pItem.phone}</span>}
                                {pItem.email && <span>✉️ {pItem.email}</span>}
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[10.5px] border border-slate-700">
                                🗓️ {formatDateTR(pItem.period)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {balanceNum > 0 ? (
                                <span className="text-rose-400">{balanceNum.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (Borç)</span>
                              ) : balanceNum < 0 ? (
                                <span className="text-emerald-400">{Math.abs(balanceNum).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL (Alacak)</span>
                              ) : (
                                <span className="text-slate-400">0.00 TL (Denk)</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-semibold">
                                {pItem.sent_channels === 'BOTH' ? '📱+✉️ İkisi' : pItem.sent_channels === 'EMAIL' ? '✉️ E-Posta' : '📱 WhatsApp'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <div className="text-slate-300 text-[10.5px]">
                                {pItem.sent_at ? new Date(pItem.sent_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                              </div>
                              <div className="mt-0.5">
                                {daysWaiting >= 3 ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[9.5px] border border-rose-500/30">
                                    ⏳ {daysWaiting} gündür bekliyor
                                  </span>
                                ) : daysWaiting > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium text-[9.5px] border border-amber-500/30">
                                    ⏳ {daysWaiting} gün oldu
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 font-medium text-[9.5px] border border-sky-500/20">
                                    ✨ Bugün iletildi
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(pItem.token)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="Onay Linkini Kopyala"
                                >
                                  {copiedToken === pItem.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <a
                                  href={`/mutabakat/${pItem.token}/pdf`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="PDF İndir / Önizle"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleSendSingle(pItem)}
                                  disabled={sendingSingleId === pItem.id}
                                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Tekrar Hatırlatma Gönder"
                                >
                                  {sendingSingleId === pItem.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Send className="w-2.5 h-2.5" />}
                                  <span>Hatırlat</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetStatus(pItem.id)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                                  title="Durumu Sıfırla (Gönderilmediye Al)"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SEKME 3: ✅ MUTABIK KALINANLAR & ARŞİV */}
        {/* ============================================================ */}
        {activeTab === 'APPROVED' && (
          <div className="space-y-3 animate-in fade-in">
            {/* Üst Arama & Dışa Aktarma Çubuğu */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={approvedSearchTerm}
                  onChange={(e) => setApprovedSearchTerm(e.target.value)}
                  placeholder="Firma, yetkili veya telefon ara..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOnlyLatestApproved}
                    onChange={(e) => setShowOnlyLatestApproved(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900 cursor-pointer"
                  />
                  <span>Sadece En Son Mutabakatı Göster</span>
                </label>

                <button
                  type="button"
                  onClick={handleExportApprovedToExcel}
                  disabled={filteredApproved.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Listeyi Excel formatında indir"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel İndir</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportZip()}
                  disabled={filteredApproved.length === 0 || isExportingZip}
                  className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Onaylanan tüm resmi PDF mektuplarını tek bir ZIP dosyasında indir"
                >
                  {isExportingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                  <span>PDF'leri ZIP İndir</span>
                </button>
              </div>
            </div>

            {/* Mutabıklar Tablosu */}
            {filteredApproved.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <span className="text-slate-300 font-medium text-sm">Mutabık kalınmış firma kaydı bulunamadı.</span>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Firma Adı & İletişim</th>
                        <th className="py-2.5 px-3">Son Mutabakat Tarihi</th>
                        <th className="py-2.5 px-3 text-right">O Sıra Olan Bakiye</th>
                        <th className="py-2.5 px-3 text-right">Anlık Güncel Bakiye</th>
                        <th className="py-2.5 px-3 text-center">Bakiye Değişimi</th>
                        <th className="py-2.5 px-3">Onaylayan Yetkili</th>
                        <th className="py-2.5 px-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredApproved.map((item) => {
                        const recBal = Number(item.balance) || 0;
                        const currBal = Number(item.current_balance !== undefined ? item.current_balance : item.balance) || 0;
                        const diff = currBal - recBal;

                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Firma Adı & İletişim */}
                            <td className="py-2 px-3">
                              <div className="font-semibold text-white text-xs">{item.firm_name}</div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                {item.phone && <span>📱 {item.phone}</span>}
                                {item.email && <span>✉️ {item.email}</span>}
                              </div>
                            </td>

                            {/* Son Mutabakat Tarihi */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-slate-200">
                                🗓️ {formatDateTR(item.period)}
                              </div>
                              {item.response_at && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Onay: {new Date(item.response_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              )}
                            </td>

                            {/* O Sıra Olan Bakiye */}
                            <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {recBal > 0 ? (
                                <span className="text-rose-400">{recBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[10px] font-normal">(Borç)</span></span>
                              ) : recBal < 0 ? (
                                <span className="text-emerald-400">{Math.abs(recBal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[10px] font-normal">(Alacak)</span></span>
                              ) : (
                                <span className="text-slate-400">0.00 TL (Denk)</span>
                              )}
                            </td>

                            {/* Anlık Güncel Bakiye */}
                            <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                              {currBal > 0 ? (
                                <span className="text-rose-400">{currBal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[10px] font-normal">(Borç)</span></span>
                              ) : currBal < 0 ? (
                                <span className="text-emerald-400">{Math.abs(currBal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[10px] font-normal">(Alacak)</span></span>
                              ) : (
                                <span className="text-slate-400">0.00 TL (Denk)</span>
                              )}
                            </td>

                            {/* Bakiye Değişimi */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {Math.abs(diff) < 0.01 ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                  <Check className="w-3 h-3" /> Denk (Değişmedi)
                                </span>
                              ) : diff > 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold" title="Mutabakattan sonra yeni fatura veya borç eklendi">
                                  +{diff.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold" title="Mutabakattan sonra tahsilat/ödeme yapıldı">
                                  {diff.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                </span>
                              )}
                            </td>

                            {/* Onaylayan Yetkili */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-200 text-xs">
                                👤 {item.responder_name || 'Yetkili'}
                              </div>
                              {item.responder_title && (
                                <div className="text-[10px] text-slate-400">
                                  {item.responder_title}
                                </div>
                              )}
                            </td>

                            {/* İşlemler */}
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(item.token)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="Onay Linkini Kopyala"
                                >
                                  {copiedToken === item.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <a
                                  href={`/mutabakat/${item.token}/pdf`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                  title="Onaylı Mutabakat Mektubunu İndir / Önizle (PDF)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* SEKME 4: 📋 TÜM FİRMALAR & GENEL CARİ HAREKETLER */}
        {/* ============================================================ */}
        {activeTab === 'ALL' && (
          <div className="space-y-3 animate-in fade-in">
            {/* Arama ve Filtreleme Çubuğu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  Tümü ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('HAS_BOTH')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'HAS_BOTH' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  📱+✉️ İki Kanalı Olan ({stats.hasBoth || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('PHONE_ONLY')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'PHONE_ONLY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  📱 Sadece WhatsApp ({stats.hasPhone ? Math.max(0, stats.hasPhone - (stats.hasBoth || 0)) : 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('EMAIL_ONLY')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'EMAIL_ONLY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  ✉️ Sadece E-Posta ({stats.hasEmail ? Math.max(0, stats.hasEmail - (stats.hasBoth || 0)) : 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  ✅ Mutabık ({stats.approved})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('DISPUTED')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'DISPUTED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  ⚠️ Fark Bildiren ({stats.disputed})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SENT')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'SENT' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  ⏳ Bekleyen ({stats.pending})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('MISSING_CONTACT')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap text-xs ${statusFilter === 'MISSING_CONTACT' ? 'bg-rose-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  ⚠️ Eksik İletişim ({stats.missingContact || 0})
                </button>
              </div>

              {/* Arama Input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Firma, telefon veya e-posta ara..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Tablo */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Firma Adı</th>
                      <th className="py-2.5 px-3">İletişim Bilgileri (WhatsApp & E-Posta)</th>
                      <th className="py-2.5 px-3 text-center">Hedef Kanal</th>
                      <th className="py-2.5 px-3 text-right">Dönem Bakiyesi</th>
                      <th className="py-2.5 px-3 text-center">Mutabakat Durumu</th>
                      <th className="py-2.5 px-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5 text-emerald-400" />
                          <span>Mutabakat verileri hesaplanıyor...</span>
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          Bu filtre ile eşleşen firma kaydı bulunamadı.
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
                            <td className="py-1.5 px-3">
                              <div className="font-semibold text-slate-200 text-xs leading-tight">{item.firm_name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 leading-none">
                                Fatura: {item.total_billed?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL | 
                                Ödenen: {item.total_paid?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                              </div>
                            </td>

                            {/* İletişim Bilgileri (Telefon & E-Posta) */}
                            <td className="py-1.5 px-3">
                              {isEditingContact ? (
                                <div className="flex flex-col gap-1 bg-slate-950 p-1.5 rounded-lg border border-emerald-500/50">
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <input
                                      type="text"
                                      value={editedPhone}
                                      onChange={(e) => setEditedPhone(e.target.value)}
                                      placeholder="05xx xxx xx xx"
                                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white text-[11px] w-32 outline-none focus:border-emerald-500 font-mono"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                                    <input
                                      type="email"
                                      value={editedEmail}
                                      onChange={(e) => setEditedEmail(e.target.value)}
                                      placeholder="muhasebe@firma.com"
                                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white text-[11px] w-40 outline-none focus:border-sky-500"
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-1 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingContactFirmId(null)}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white text-[9.5px]"
                                    >
                                      İptal
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveContact(item.firm_id)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-[9.5px] font-bold flex items-center gap-1"
                                    >
                                      <Check className="w-2.5 h-2.5" /> Kaydet
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5 group">
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <Phone className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                    {hasPhone ? (
                                      <span className="font-mono text-slate-300">{item.phone}</span>
                                    ) : (
                                      <span className="text-slate-500 italic text-[10px]">Tel Yok</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px]">
                                    <Mail className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                    {hasEmail ? (
                                      <span className="text-slate-300 truncate max-w-[160px]" title={item.email}>{item.email}</span>
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
                                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition-opacity ml-1"
                                      title="İletişim Bilgilerini Düzenle"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Hedef Kanal */}
                            <td className="py-1.5 px-3 text-center whitespace-nowrap">
                              {hasPhone && hasEmail ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/15 to-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold">
                                  <span>📱+✉️ İkisi</span>
                                </span>
                              ) : hasPhone ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
                                  <Smartphone className="w-2.5 h-2.5" /> WhatsApp
                                </span>
                              ) : hasEmail ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-medium">
                                  <Mail className="w-2.5 h-2.5" /> E-Posta
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9.5px] font-semibold">
                                  İletişim Yok
                                </span>
                              )}

                              {item.sent_channels && (
                                <div className="text-[9px] text-slate-400 mt-0.5 leading-none">
                                  {item.sent_channels === 'BOTH' ? '📱+✉️ Gönderildi' : `${item.sent_channels} Gönderildi`}
                                </div>
                              )}
                            </td>

                            {/* Bakiye */}
                            <td className="py-1.5 px-3 text-right font-mono font-bold whitespace-nowrap text-xs">
                              {balanceNum > 0 ? (
                                <span className="text-rose-400">
                                  {balanceNum.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[10px] font-normal">(Borç)</span>
                                </span>
                              ) : balanceNum < 0 ? (
                                <span className="text-emerald-400">
                                  {Math.abs(balanceNum).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL <span className="text-[10px] font-normal">(Alacak)</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">0.00 TL</span>
                              )}
                            </td>

                            {/* Durum Rozeti */}
                            <td className="py-1.5 px-3 text-center whitespace-nowrap">
                              {item.status === 'APPROVED' ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                    <CheckCircle2 className="w-3 h-3" /> Mutabık
                                  </span>
                                  {item.responder_name && (
                                    <div className="text-[9.5px] text-slate-300 mt-0.5 truncate max-w-[140px]" title={`${item.responder_name} (${item.responder_title || 'Yetkili'})`}>
                                      👤 {item.responder_name}
                                    </div>
                                  )}
                                </div>
                              ) : item.status === 'DISPUTED' ? (
                                <div className="inline-flex flex-col items-center">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDisputeItem(item)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold hover:bg-rose-500/25 transition-colors"
                                    title="Müşteri itiraz notunu incelemek için tıklayın"
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Fark Bildirildi
                                    {item.dispute_file_name && <Paperclip className="w-2.5 h-2.5 text-sky-400 ml-0.5 inline" title="Müşteri ekstre yükledi" />}
                                  </button>
                                  {item.responder_name && (
                                    <div className="text-[9.5px] text-rose-300/80 mt-0.5 truncate max-w-[140px]" title={`${item.responder_name} (${item.responder_title || 'Yetkili'})`}>
                                      👤 {item.responder_name}
                                    </div>
                                  )}
                                </div>
                              ) : item.status === 'SENT' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
                                  <Clock className="w-3 h-3" /> Yanıt Bekleniyor
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                                  Gönderilmedi
                                </span>
                              )}
                            </td>

                            {/* İşlemler */}
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <a
                                  href={`/mutabakat/${item.token}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                  title="Resmi Mutabakat Mektubu ve Cari Ekstreyi İndir (PDF)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(item.token)}
                                  className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                                  title="Müşteri Onay Bağlantısını Kopyala"
                                >
                                  {copiedToken === item.token ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSendSingle(item)}
                                  disabled={sendingSingleId === item.id || (!hasPhone && !hasEmail)}
                                  className={`p-1 rounded transition-colors disabled:opacity-30 ${
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
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
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
          </div>
        )}

      </div>

      {/* 6. MANUEL İŞLEMLER & ÖZEL TARİH SEÇİMİ (AÇILIR / KAPANIR ACCORDION) */}
      {showManualTools && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Manuel Kesim Tarihi:
              </span>
              <input
                type="date"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={handlePrepareList}
                disabled={isPreparing}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50 shrink-0"
                title="Seçilen tarihe kadar olan tüm cari hareketleri hesaplar ve listeyi yeniler"
              >
                {isPreparing ? <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> : <RefreshCw className="w-3 h-3 text-emerald-400" />}
                <span>Bakiyeleri Hesapla</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                disabled={isSendingBatch || items.length === 0}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {isSendingBatch ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Gönderiliyor...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Çoklu Kanal Toplu Gönderim</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4 Çeyrek Hızlı Seçim Butonları */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            {[
              { key: 'Q1', label: '1. Çeyrek', date: '31 Mart', followup: 'Nisan' },
              { key: 'Q2', label: '2. Çeyrek', date: '30 Haziran', followup: 'Temmuz' },
              { key: 'Q3', label: '3. Çeyrek', date: '30 Eylül', followup: 'Ekim' },
              { key: 'Q4', label: '4. Çeyrek', date: '31 Aralık', followup: 'Ocak (Yıl Sonu)' },
            ].map(q => {
              const isSelected = selectedQuarterKey === q.key;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => handleSelectQuarter(q.key as any)}
                  className={`px-3 py-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/30'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="text-xs leading-tight font-bold">{q.label}</div>
                  <div className={`text-[10px] leading-tight mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {q.date} • {q.followup}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Seçili Çeyreğin 4 Aşamalı Yol Haritası */}
          {(() => {
            const activeSchedule = quarterSchedules.find(s => s.quarterKey === selectedQuarterKey) || quarterSchedules[2];
            if (!activeSchedule) return null;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 pt-1">
                {activeSchedule.stages.map((st, idx) => {
                  const stageColors = {
                    'INITIAL': {
                      border: 'border-sky-500/30',
                      bg: 'bg-sky-500/5',
                      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
                      btn: 'bg-sky-600 hover:bg-sky-500 text-white',
                      icon: '📤'
                    },
                    'REMINDER_1': {
                      border: 'border-amber-500/30',
                      bg: 'bg-amber-500/5',
                      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                      btn: 'bg-amber-600 hover:bg-amber-500 text-white',
                      icon: '🔔'
                    },
                    'REMINDER_2': {
                      border: 'border-orange-500/30',
                      bg: 'bg-orange-500/5',
                      badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                      btn: 'bg-orange-600 hover:bg-orange-500 text-white',
                      icon: '⚠️'
                    },
                    'FINAL_NOTICE': {
                      border: 'border-rose-500/30',
                      bg: 'bg-rose-500/5',
                      badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                      btn: 'bg-rose-600 hover:bg-rose-500 text-white',
                      icon: '🚨'
                    }
                  }[st.stage];

                  return (
                    <div
                      key={st.stage}
                      className={`p-3 rounded-xl border ${stageColors.border} ${stageColors.bg} flex flex-col justify-between space-y-2 relative group`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Aşama {idx + 1}
                          </span>
                          <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold border ${stageColors.badge}`}>
                            {st.targetDesc}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-white mt-1 flex items-center gap-1.5">
                          <span>{stageColors.icon}</span>
                          <span>{st.name}</span>
                        </div>

                        <p className="text-[10.5px] text-slate-300 mt-1 leading-snug">
                          {st.ruleDesc}
                        </p>

                        {st.weekendNote && (
                          <div className="mt-1.5 text-[9.5px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                            📌 {st.weekendNote}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (st.stage === 'INITIAL') {
                              setShowBatchModal(true);
                            } else {
                              handleBulkRemind(st.stage);
                            }
                          }}
                          className={`flex-1 py-1 px-2 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors ${stageColors.btn}`}
                        >
                          <span>{st.stage === 'INITIAL' ? 'İlk Gönder' : 'Bu Aşamayı Hatırlat'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openPreviewModal(st.stage)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] border border-slate-700 transition-colors"
                          title="Bu aşamanın resmi WhatsApp ve E-Posta şablonunu gör"
                        >
                          👁️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. TÜM MODALLAR */}
      {/* ============================================================ */}

      {/* WHATSAPP QR KOD BAĞLANTI MODALI */}
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

      {/* SMTP / E-POSTA AYARLARI MODALI */}
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
                    👉 Google Uygulama Şifresi oluşturun (myaccount.google.com/apppasswords)
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

      {/* YÖNETİCİ WHATSAPP BİLDİRİM NUMARASI MODALI */}
      {showManagerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" /> Yönetici WhatsApp Bildirim Hattı
              </h3>
              <button onClick={() => setShowManagerModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Müşterileriniz mutabakatı onayladığında (<b>Mutabıkız</b>) veya itiraz ettiğinde (<b>Fark Var</b>), şirket WhatsApp hattınız üzerinden bu yönetici numarasına anlık olarak ayrıntılı bildirim mesajı iletilir.
            </p>

            {managerModalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{managerModalSuccess}</span>
              </div>
            )}

            {managerModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{managerModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveManagerPhone} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Yönetici Telefon Numarası
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={tempManagerPhone}
                    onChange={(e) => setTempManagerPhone(e.target.value)}
                    placeholder="05XXXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Örn: 05321234567 veya 905321234567
                </span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestManagerPhone}
                  disabled={isTestingManagerPhone || !tempManagerPhone || !waStatus.isConnected}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl font-semibold flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-50 transition-colors"
                  title={!waStatus.isConnected ? 'WhatsApp bağlı olmadığı için test gönderilemez' : 'Test bildirimi gönder'}
                >
                  {isTestingManagerPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Test Bildirimi Gönder</span>
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManagerModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingManagerPhone}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-colors"
                  >
                    {isSavingManagerPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOPLU GÖNDERİM ONAY MODALI */}
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
                <span className="text-slate-400">Kesim Tarihi:</span>
                <span className="font-bold text-white">{formatDateTR(selectedPeriod)}</span>
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

      {/* MÜŞTERİ İTİRAZ / FARK BİLDİRİMİ DETAY MODALI */}
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

              {selectedDisputeItem.dispute_file_name && (
                <div>
                  <span className="text-slate-400 font-semibold">Karşı Firma Ekstresi / Belgesi:</span>
                  <div className="mt-1">
                    <a
                      href={`/api/mutabakat/dispute-file/${selectedDisputeItem.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors w-full"
                    >
                      <Paperclip className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate flex-1 font-mono text-[11px]">{selectedDisputeItem.dispute_file_name}</span>
                      <Download className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />
                    </a>
                  </div>
                </div>
              )}

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

      {/* İLK GÖNDERİM KURALI UYARI MODALI */}
      {earlySendWarning && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 text-left">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-base pb-3 border-b border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">İlk Gönderim Kuralı Uyarısı</h4>
                <p className="text-[10.5px] text-amber-400/90 font-normal mt-0.5">e-Fatura / e-Arşiv Yasal 7 Günlük Süre</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl text-amber-200 text-xs">
                {earlySendWarning.warning}
              </div>
              <p className="text-[11px] text-slate-400">
                Geriye dönük 7 günlük fatura kesim hakkı ve evrakların muhasebeye ulaşması nedeniyle dönem biter bitmez gönderilen mutabakatlarda sıkça fark çıkmaktadır.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEarlySendWarning(null)}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                İptal Et
              </button>
              {earlySendWarning.recommendedDate && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriod(earlySendWarning.recommendedDate);
                    setEarlySendWarning(null);
                    setSuccessMsg(`Kesim tarihi tavsiye edilen ${earlySendWarning.recommendedDate} tarihine ayarlandı.`);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>🗓️ ${earlySendWarning.recommendedDate} Olarak Planla</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmEarlySend}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold"
                title="Kuralı atlayarak derhal gönderimi başlat"
              >
                <span>Yine de Şimdi Gönder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ŞABLON ÖNİZLEME MODALI */}
      {previewStage && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left">
            <div className="flex items-center justify-between p-3.5 px-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {previewStage === 'INITIAL' && '1. Aşama: İlk Gönderim Şablonu'}
                    {previewStage === 'REMINDER_1' && '2. Aşama: 1. Hatırlatma Şablonu'}
                    {previewStage === 'REMINDER_2' && '3. Aşama: 2. Hatırlatma (KDV Öncesi) Şablonu'}
                    {previewStage === 'FINAL_NOTICE' && '4. Aşama: Son Yasal Uyarı (TTK m. 94) Şablonu'}
                  </h3>
                  <p className="text-[10.5px] text-slate-400">
                    Müşteriye hem WhatsApp hem de E-Posta kanalı üzerinden iletilen resmi metinler
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewStage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {isLoadingPreview ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Şablon yükleniyor...</span>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between pb-1.5">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <span>📱 WhatsApp Mesaj Metni</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (previewData?.whatsappCaption) {
                            navigator.clipboard.writeText(previewData.whatsappCaption);
                            alert('WhatsApp mesaj metni kopyalandı.');
                          }
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-semibold flex items-center gap-1 border border-slate-700"
                      >
                        <Copy className="w-3 h-3" /> Metni Kopyala
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-slate-200 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                      {previewData?.whatsappCaption}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between pb-1.5">
                      <span className="font-bold text-sky-400 flex items-center gap-1.5">
                        <span>✉️ E-Posta Konu & Başlık Vurgusu</span>
                      </span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div>
                        <span className="text-slate-500 text-[10.5px] block">Konu Satırı (Subject):</span>
                        <div className="text-white font-mono font-semibold text-xs mt-0.5">
                          {previewData?.emailSubject}
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-normal">
                        📌 E-posta içerisinde HTML formatında bakiye kartı, onay/itiraz butonları, 6102 sayılı TTK m. 94 yasal bilgilendirmesi ve ekstre dökümü PDF eki yer almaktadır.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-3 px-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewStage(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTOPİLOT GÜNLÜKLERİ MODALI */}
      {showAutopilotLogsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3.5 px-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Otopilot Otomasyon Günlükleri</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAutopilotLogsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2 text-xs">
              {!autopilotStatus?.recentLogs || autopilotStatus.recentLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">Henüz kaydedilmiş bir otomasyon işlemi bulunmuyor.</div>
              ) : (
                autopilotStatus.recentLogs.map(log => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : log.status === 'WARNING_CONNECTION' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                          {log.status === 'SUCCESS' ? 'BAŞARILI' : log.status === 'WARNING_CONNECTION' ? 'BAĞLANTI UYARISI' : 'HATA'}
                        </span>
                        <span className="font-bold text-white">{log.stage_name || log.stage}</span>
                        <span className="text-slate-400">({log.period})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {log.details || `Gönderilen: ${log.sent_count} Firma`}
                      </div>
                    </div>
                    <div className="text-right text-[10.5px] text-slate-400 shrink-0">
                      <div>{new Date(log.executed_at).toLocaleDateString('tr-TR')}</div>
                      <div>{new Date(log.executed_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 px-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAutopilotLogsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
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
