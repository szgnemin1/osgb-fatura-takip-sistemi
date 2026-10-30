import React, { useRef, useState, useEffect } from 'react';
import { db } from '../services/db';
import { exporter } from '../services/exporter';
import { 
  Save, Upload, Download, Database, Trash2, AlertOctagon, RefreshCw, 
  TrendingUp, Percent, Landmark, Receipt, Users, UserPlus, Lock, KeyRound, 
  CheckCircle2, AlertCircle, Edit2, X, Eye, EyeOff, Loader2,
  ShieldCheck, ShieldAlert, ShieldOff, QrCode, Copy, Check,
  Bot, Send, Power, HelpCircle, Plus
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { GlobalSettings, AppUser, TelegramConfig, TelegramAllowedUser } from '../types';

const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const updatePriceInputRef = useRef<HTMLInputElement>(null);
    
  // Aktif Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'params' | 'pricing' | 'danger' | 'telegram'>('users');

  // Mevcut Oturum Kullanıcısı
  const [currentUser, setCurrentUser] = useState(() => db.getCurrentUser());

  // Global Parametreler State
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

  // Kullanıcılar Listesi State
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Kendi Bilgilerini Güncelleme (Profil / Şifre) State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // 2FA (Google Authenticator) State
  const [meUser, setMeUser] = useState<AppUser | null>(null);
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState<{ secret: string; otpauthUrl: string; username: string } | null>(null);
  const [setup2FACode, setSetup2FACode] = useState('');
  const [setup2FAError, setSetup2FAError] = useState('');
  const [isSubmitting2FA, setIsSubmitting2FA] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disable2FAError, setDisable2FAError] = useState('');
  const [isSubmittingDisable2FA, setIsSubmittingDisable2FA] = useState(false);

  // Yeni Kullanıcı Ekleme Modalı State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addPasswordConfirm, setAddPasswordConfirm] = useState('');
  const [addRole, setAddRole] = useState<'admin' | 'user'>('user');
  const [addTwoFactor, setAddTwoFactor] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Kullanıcı Düzenleme / Şifre Sıfırlama Modalı State
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editTwoFactor, setEditTwoFactor] = useState(false);
  const [editUserError, setEditUserError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Telegram Bot State
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);
  const [telegramTokenInput, setTelegramTokenInput] = useState('');
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [isTelegramActive, setIsTelegramActive] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramSuccessMsg, setTelegramSuccessMsg] = useState('');
  const [telegramErrorMsg, setTelegramErrorMsg] = useState('');

  // Telegram Yetkili Ekleme State
  const [newTelegramId, setNewTelegramId] = useState('');
  const [newTelegramName, setNewTelegramName] = useState('');
  const [isAddingTelegramUser, setIsAddingTelegramUser] = useState(false);
  const [deletingTelegramUserId, setDeletingTelegramUserId] = useState<number | null>(null);
  const [copiedTelegramId, setCopiedTelegramId] = useState<string | null>(null);

  const loadTelegramConfig = async () => {
    setIsLoadingTelegram(true);
    setTelegramErrorMsg('');
    try {
      const cfg = await db.getTelegramConfig();
      setTelegramConfig(cfg);
      setIsTelegramActive(cfg.isActive);
      if (cfg.maskedToken) {
        setTelegramTokenInput(cfg.maskedToken);
      }
    } catch (err: any) {
      console.error('Telegram ayarları yüklenemedi:', err);
      setTelegramErrorMsg(err.message || 'Telegram ayarları yüklenemedi.');
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  const handleTestTelegramToken = async () => {
    setIsTestingTelegram(true);
    setTelegramErrorMsg('');
    setTelegramSuccessMsg('');
    try {
      const res = await db.testTelegramBot(telegramTokenInput);
      if (res.success && res.bot) {
        setTelegramSuccessMsg(`Bağlantı Başarılı! Bot: @${res.bot.username} (${res.bot.first_name})`);
      }
    } catch (err: any) {
      setTelegramErrorMsg(err.message || 'Bot bağlantısı kurulamadı. Tokenı kontrol edin.');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSaveTelegramConfig = async () => {
    setIsSavingTelegram(true);
    setTelegramErrorMsg('');
    setTelegramSuccessMsg('');
    try {
      const res = await db.saveTelegramConfig({
        token: telegramTokenInput,
        isActive: isTelegramActive
      });
      setTelegramSuccessMsg(res.message || 'Ayarlar başarıyla kaydedildi!');
      await loadTelegramConfig();
    } catch (err: any) {
      setTelegramErrorMsg(err.message || 'Ayar kaydedilirken bir hata oluştu.');
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleAddTelegramUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTelegramId.trim() || !newTelegramName.trim()) {
      setTelegramErrorMsg('Lütfen Telegram ID ve İsim/Unvan alanlarını doldurun.');
      return;
    }
    setIsAddingTelegramUser(true);
    setTelegramErrorMsg('');
    setTelegramSuccessMsg('');
    try {
      await db.addTelegramUser(newTelegramId.trim(), newTelegramName.trim());
      setNewTelegramId('');
      setNewTelegramName('');
      setTelegramSuccessMsg('Yetkili kullanıcı başarıyla eklendi.');
      await loadTelegramConfig();
    } catch (err: any) {
      setTelegramErrorMsg(err.message || 'Yetkili eklenemedi.');
    } finally {
      setIsAddingTelegramUser(false);
    }
  };

  const handleDeleteTelegramUser = async (user: TelegramAllowedUser) => {
    if (!window.confirm(`"${user.name}" (${user.telegram_id}) kullanıcısının bot erişim yetkisini kaldırmak istediğinize emin misiniz?`)) {
      return;
    }
    setDeletingTelegramUserId(user.id);
    setTelegramErrorMsg('');
    try {
      await db.deleteTelegramUser(user.id);
      setTelegramSuccessMsg(`"${user.name}" yetkisi kaldırıldı.`);
      await loadTelegramConfig();
    } catch (err: any) {
      setTelegramErrorMsg(err.message || 'Yetki silinemedi.');
    } finally {
      setDeletingTelegramUserId(null);
    }
  };

  const loadMe = async () => {
    try {
      const me = await db.getMe();
      setMeUser(me);
    } catch (_) {}
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await db.getUsers();
      setUsersList(Array.isArray(users) ? users : []);
    } catch (err: any) {
      console.error('Kullanıcı listesi yüklenemedi:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    setGlobalSettings(db.getGlobalSettings());
    loadMe();
    loadUsers();

    const handleUserUpdate = (e: any) => {
      if (e.detail) {
        setCurrentUser({ username: e.detail.username, role: e.detail.role });
      } else {
        setCurrentUser(db.getCurrentUser());
      }
      loadMe();
    };
    window.addEventListener('auth_user_updated', handleUserUpdate);
    return () => window.removeEventListener('auth_user_updated', handleUserUpdate);
  }, []);

  useEffect(() => {
    if (activeTab === 'telegram') {
      loadTelegramConfig();
    }
  }, [activeTab]);

  // --- KENDİ BİLGİLERİNİ GÜNCELLE (KULLANICI ADI & ŞİFRE) ---
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    if (!currentPassword) {
      setProfileErrorMsg('Değişiklik yapabilmek için mevcut şifrenizi girmelisiniz.');
      return;
    }

    if (newUsername && newUsername.trim().length < 3) {
      setProfileErrorMsg('Yeni kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setProfileErrorMsg('Yeni şifre en az 4 karakter olmalıdır.');
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setProfileErrorMsg('Yeni şifre ile şifre tekrarı uyuşmuyor.');
        return;
      }
    }

    if (!newUsername.trim() && !newPassword) {
      setProfileErrorMsg('Lütfen yeni bir kullanıcı adı veya yeni bir şifre girin.');
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const res = await db.changeMyCredentials({
        currentPassword,
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword || undefined
      });

      setProfileSuccessMsg(res.message || 'Bilgileriniz başarıyla güncellendi.');
      setCurrentUser({ username: res.username || currentUser.username, role: res.role || currentUser.role });
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setNewPasswordConfirm('');
      loadUsers();
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Güncelleme sırasında bir hata oluştu.');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // --- 2FA (GOOGLE AUTHENTICATOR) İŞLEMLERİ ---
  const handleStart2FASetup = async () => {
    setSetup2FAError('');
    setSetup2FACode('');
    setCopiedSecret(false);
    setIsSubmitting2FA(true);
    try {
      const data = await db.setup2FA();
      setSetup2FAData(data);
      setShow2FASetupModal(true);
    } catch (err: any) {
      alert(err.message || '2FA kurulumu başlatılamadı.');
    } finally {
      setIsSubmitting2FA(false);
    }
  };

  const handleVerifyAndEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup2FAData || !setup2FACode.trim()) {
      setSetup2FAError('Lütfen 6 haneli kodu giriniz.');
      return;
    }

    setSetup2FAError('');
    setIsSubmitting2FA(true);
    try {
      await db.verifyAndEnable2FA(setup2FAData.secret, setup2FACode.trim());
      setShow2FASetupModal(false);
      setSetup2FAData(null);
      setSetup2FACode('');
      await loadMe();
      await loadUsers();
      alert('Google Authenticator (2FA) başarıyla aktif edildi!');
    } catch (err: any) {
      setSetup2FAError(err.message || 'Doğrulama kodu hatalı.');
    } finally {
      setIsSubmitting2FA(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disable2FAPassword) {
      setDisable2FAError('Lütfen mevcut şifrenizi giriniz.');
      return;
    }

    setDisable2FAError('');
    setIsSubmittingDisable2FA(true);
    try {
      await db.disable2FA(disable2FAPassword);
      setShowDisable2FAModal(false);
      setDisable2FAPassword('');
      await loadMe();
      await loadUsers();
      alert('İki Adımlı Doğrulama (2FA) kapatıldı.');
    } catch (err: any) {
      setDisable2FAError(err.message || '2FA kapatılamadı.');
    } finally {
      setIsSubmittingDisable2FA(false);
    }
  };

  const handleResetUser2FA = async (user: AppUser) => {
    if (!window.confirm(`"${user.username}" kullanıcısının Google Authenticator (2FA) korumasını sıfırlamak istediğinize emin misiniz?\n\nBu işlem, telefonunu kaybeden veya değiştiren personelin sisteme yeniden şifresiyle girebilmesini sağlar.`)) {
      return;
    }

    try {
      await db.resetUser2FA(user.id);
      loadUsers();
      if (String(user.id) === String(meUser?.id)) {
        loadMe();
      }
      alert(`"${user.username}" kullanıcısının 2FA doğrulaması sıfırlandı.`);
    } catch (err: any) {
      alert(err.message || '2FA sıfırlanamadı.');
    }
  };

  // --- YENİ KULLANICI EKLEME ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');

    if (!addUsername.trim() || addUsername.trim().length < 3) {
      setAddUserError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    if (!addPassword || addPassword.length < 4) {
      setAddUserError('Şifre en az 4 karakter olmalıdır.');
      return;
    }

    if (addPassword !== addPasswordConfirm) {
      setAddUserError('Şifreler uyuşmuyor.');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      await db.createUser({
        username: addUsername.trim(),
        password: addPassword,
        role: addRole,
        twoFactorEnabled: addTwoFactor
      });

      setShowAddModal(false);
      setAddUsername('');
      setAddPassword('');
      setAddPasswordConfirm('');
      setAddRole('user');
      setAddTwoFactor(false);
      loadUsers();
      alert('Yeni kullanıcı başarıyla eklendi.');
    } catch (err: any) {
      setAddUserError(err.message || 'Kullanıcı eklenemedi.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // --- KULLANICI DÜZENLEME & ŞİFRE SIFIRLAMA ---
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword('');
    setEditRole(user.role);
    setEditTwoFactor(!!user.twoFactorEnabled);
    setEditUserError('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError('');

    if (!editUsername.trim() || editUsername.trim().length < 3) {
      setEditUserError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    if (editPassword && editPassword.length < 4) {
      setEditUserError('Şifre belirlenecekse en az 4 karakter olmalıdır.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await db.updateUser(editingUser.id, {
        username: editUsername.trim(),
        password: editPassword || undefined,
        role: editRole,
        twoFactorEnabled: editTwoFactor
      });

      setEditingUser(null);
      loadUsers();
      if (String(editingUser.id) === String(meUser?.id)) {
        loadMe();
      }
      alert('Kullanıcı başarıyla güncellendi.');
    } catch (err: any) {
      setEditUserError(err.message || 'Kullanıcı güncellenemedi.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // --- KULLANICI SİLME ---
  const handleDeleteUser = async (user: AppUser) => {
    if (!window.confirm(`"${user.username}" kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    try {
      await db.deleteUser(user.id);
      loadUsers();
      alert('Kullanıcı başarıyla silindi.');
    } catch (err: any) {
      alert(err.message || 'Kullanıcı silinemedi.');
    }
  };

  // --- GLOBAL PARAMETRELER VE VERİ YÖNETİMİ ---
  const handleSaveGlobalSettings = (e: React.FormEvent) => { 
    e.preventDefault(); 
    db.saveGlobalSettings(globalSettings); 
    alert('Global parametreler güncellendi.'); 
  };

  const handleDownloadBackup = () => {
    const data = db.getFullBackup();
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); 
    link.href = url; 
    link.download = `OSGB_Yedek_${dateStr}.json`; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    if (!window.confirm("DİKKAT! Veritabanı silinecek ve yedek yüklenecek. Devam edilsin mi?")) { 
      e.target.value = ''; 
      return; 
    }
    const reader = new FileReader();
    reader.onload = (event) => { 
      try { 
        if (db.restoreBackup(JSON.parse(event.target?.result as string))) { 
          alert("Yüklendi. Yenileniyor..."); 
          window.location.reload(); 
        } else { 
          alert("Dosya bozuk."); 
        } 
      } catch (err) { 
        alert("Hata oluştu."); 
      } 
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => { exporter.exportAdvancedTemplate(); };
  
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { 
      try { 
        const result = db.bulkImportFirms(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]] ? XLSX.utils.sheet_to_json(XLSX.read(evt.target?.result, { type: 'binary' }).Sheets[XLSX.read(evt.target?.result, { type: 'binary' }).SheetNames[0]]) : []); 
        alert(`Tamamlandı. Eklenen: ${result.newFirmsCount}`); 
        window.location.reload(); 
      } catch (err) { 
        alert("Excel Hatası."); 
      } 
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadUpdateTemplate = () => {
    const firms = db.getFirms();
    exporter.exportFirmsForEditing(firms);
  };

  const handleImportUpdateExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
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
      } catch (err: any) { 
        alert("Dosya okuma hatası: " + err.message); 
      }
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
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Üst Başlık */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Database className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" /> Ayarlar & Kullanıcı Yönetimi
          </h2>
          <p className="text-slate-400 mt-1 text-xs sm:text-sm">
            Kullanıcı hesapları, şifre değişikliği, global oranlar ve veri yedekleme.
          </p>
        </div>

        {/* Aktif Kullanıcı Rozeti */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
            {(currentUser.username || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-slate-200 font-semibold">{currentUser.username}</div>
            <div className="text-[10px] text-emerald-400 uppercase font-medium">
              {currentUser.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
            </div>
          </div>
        </div>
      </header>

      {/* Modern Sekme (Tab) Menüsü */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/80">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Kullanıcılar & Şifre</span>
        </button>

        <button
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'params'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Global Parametreler</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'pricing'
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Fiyat & Excel</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'telegram'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Telegram Bot</span>
        </button>

        <button
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'danger'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Sıfırlama & Bakım</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. SEKME: KULLANICILAR & ŞİFRE (Kullanıcı Adı/Şifre Değiştirme ve Yönetim) */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* A) KENDİ HESABIM: KULLANICI ADI & ŞİFRE DEĞİŞTİRME */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Profil ve Şifre Bilgilerini Güncelle
                  </h3>
                  <p className="text-xs text-slate-400">
                    Giriş yaptığınız hesabın kullanıcı adını veya şifresini buradan değiştirebilirsiniz.
                  </p>
                </div>
              </div>
            </div>

            {profileSuccessMsg && (
              <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs sm:text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="mt-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mevcut Kullanıcı Adı */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Aktif Kullanıcı Adınız
                  </label>
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-300 text-sm font-mono flex items-center justify-between">
                    <span>{currentUser.username}</span>
                    <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      {currentUser.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                    </span>
                  </div>
                </div>

                {/* Yeni Kullanıcı Adı (İsteğe Bağlı) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Yeni Kullanıcı Adı <span className="text-slate-500 font-normal">(Değiştirmek istemiyorsanız boş bırakın)</span>
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Yeni kullanıcı adı girin..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Mevcut Şifre Doğrulama */}
              <div className="border-t border-slate-800/80 pt-4">
                <div className="max-w-md">
                  <label className="block text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Mevcut Şifreniz <span className="text-rose-400">*</span>
                    <span className="text-slate-500 font-normal text-[11px]">(Güvenlik doğrulaması için zorunludur)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Mevcut şifrenizi girin..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Yeni Şifre Alanları (İsteğe Bağlı) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Yeni Şifre <span className="text-slate-500 font-normal">(Değiştirmek istemiyorsanız boş bırakın)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Yeni şifre (en az 4 karakter)..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Yeni Şifre (Tekrar)
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Yeni şifrenizi tekrar girin..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isSubmittingProfile}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-900/30 flex items-center gap-2 transition-all"
                >
                  {isSubmittingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Güncelleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Bilgilerimi Güncelle</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* B) GOOGLE AUTHENTICATOR (2FA) İKİ ADIMLI DOĞRULAMA KARTI */}
          <section className={`border rounded-2xl p-6 shadow-xl transition-all ${
            meUser?.twoFactorEnabled
              ? 'bg-emerald-950/20 border-emerald-500/40'
              : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  meUser?.twoFactorEnabled
                    ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                }`}>
                  {meUser?.twoFactorEnabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Google Authenticator (2FA) ile İki Adımlı Doğrulama
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      meUser?.twoFactorEnabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {meUser?.twoFactorEnabled ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {meUser?.twoFactorEnabled
                      ? 'Hesabınız iki adımlı doğrulama ile en üst düzeyde korunmaktadır. Giriş yaparken şifrenize ek olarak telefonunuzdaki Google Authenticator uygulamasından 6 haneli kod istenir.'
                      : 'Şifreniz çalınsa bile hesabınıza izinsiz girişi %100 engelleyin. Telefonunuza Google Authenticator uygulamasını indirerek bu özelliği tamamen ücretsiz aktif edebilirsiniz.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 w-full sm:w-auto">
                {meUser?.twoFactorEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDisable2FAError('');
                      setDisable2FAPassword('');
                      setShowDisable2FAModal(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldOff className="w-4 h-4" />
                    <span>2FA'yı Devre Dışı Bırak</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting2FA}
                    onClick={handleStart2FASetup}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isSubmitting2FA ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    <span>Google Authenticator'ı Aktif Et</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* C) SİSTEM KULLANICILARI & YENİ KULLANICI EKLEME */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Sistem Kullanıcıları ({usersList.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fatura programına giriş yapabilecek kullanıcıların listesi, rolleri ve 2FA durumları.
                  </p>
                </div>
              </div>

              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setAddUserError('');
                    setAddUsername('');
                    setAddPassword('');
                    setAddPasswordConfirm('');
                    setAddRole('user');
                    setAddTwoFactor(false);
                    setShowAddModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-2 transition-all shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Yeni Kullanıcı Ekle</span>
                </button>
              )}
            </div>

            {/* Kullanıcılar Listesi */}
            <div className="mt-5 overflow-hidden">
              {isLoadingUsers ? (
                <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kullanıcılar yükleniyor...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  Kayıtlı kullanıcı bulunamadı.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {usersList.map((user) => {
                    const isSelf = String(user.username).toLowerCase() === String(currentUser.username).toLowerCase();
                    const isAdmin = user.role === 'admin';

                    return (
                      <div
                        key={user.id}
                        className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelf
                            ? 'bg-blue-950/20 border-blue-500/40 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isAdmin 
                              ? 'bg-purple-600/20 border border-purple-500/40 text-purple-300' 
                              : 'bg-slate-800 border border-slate-700 text-slate-300'
                          }`}>
                            {(user.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100 text-sm truncate" title={user.username}>
                                {user.username}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-medium">
                                  Siz
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs mt-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                isAdmin
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isAdmin ? 'Yönetici' : 'Kullanıcı'}
                              </span>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                user.twoFactorEnabled
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-500'
                              }`}>
                                {user.twoFactorEnabled ? (
                                  <>
                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                    2FA Aktif
                                  </>
                                ) : (
                                  <>
                                    <ShieldOff className="w-3 h-3 text-slate-500" />
                                    2FA Yok
                                  </>
                                )}
                              </span>

                              {user.createdAt && (
                                <span className="text-[10px] text-slate-500">
                                  {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* İşlemler (Sadece Admin veya Düzenleme) */}
                        {currentUser.role === 'admin' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {user.twoFactorEnabled && (
                              <button
                                type="button"
                                onClick={() => handleResetUser2FA(user)}
                                className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
                                title="Google Authenticator (2FA) Sıfırla (Telefonunu kaybeden veya değiştiren personel için)"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Şifre Sıfırla / Rol & 2FA Düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                                title="Kullanıcıyı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SEKME: GLOBAL PARAMETRELER (Hakediş & KDV & Banka) */}
      {/* ======================================================== */}
      {activeTab === 'params' && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in duration-200">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Percent className="w-5 h-5 text-purple-500" /> Global Hesaplama Parametreleri
          </h3>
          <form onSubmit={handleSaveGlobalSettings} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Uzman Hakediş (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={globalSettings.expertPercentage} 
                  onChange={e => setGlobalSettings(p => ({...p, expertPercentage: Number(e.target.value)}))} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Doktor Hakediş (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={globalSettings.doctorPercentage} 
                  onChange={e => setGlobalSettings(p => ({...p, doctorPercentage: Number(e.target.value)}))} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Uzman KDV (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  value={globalSettings.vatRateExpert} 
                  onChange={e => setGlobalSettings(p => ({...p, vatRateExpert: Number(e.target.value)}))} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Doktor KDV (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  value={globalSettings.vatRateDoctor} 
                  onChange={e => setGlobalSettings(p => ({...p, vatRateDoctor: Number(e.target.value)}))} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Sağlık KDV (%)</label>
                <input 
                  type="number" 
                  min="0" 
                  value={globalSettings.vatRateHealth} 
                  onChange={e => setGlobalSettings(p => ({...p, vatRateHealth: Number(e.target.value)}))} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white"
                />
              </div>
            </div>
            
            {/* Sadeleştirilmiş Kopyalama Ayarı */}
            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-500" /> Fatura Kopyalama Ayarları
              </h4>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="simpleDebtMode" 
                    checked={globalSettings.simpleDebtMode || false} 
                    onChange={e => setGlobalSettings(p => ({...p, simpleDebtMode: e.target.checked}))} 
                    className="mt-1 w-5 h-5 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="simpleDebtMode" className="block text-sm font-bold text-white cursor-pointer select-none">
                      Sadeleştirilmiş Borç Modu
                    </label>
                    <p className="text-xs text-slate-400 mt-1">
                      Aktif edildiğinde: "Kesilecek Faturalar" sayfasındaki kopyalama butonu, <b>sadece firma borçlu ise</b> görünür. 
                      Kopyalanan metin sadece "Toplam Borç: X TL" bilgisini içerir.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-500" /> Banka & IBAN Bilgisi
              </label>
              <textarea 
                rows={3} 
                value={globalSettings.bankInfo} 
                onChange={e => setGlobalSettings(p => ({...p, bankInfo: e.target.value}))} 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500 resize-none font-mono text-sm" 
                placeholder="Banka ve IBAN bilgilerinizi buraya girin..."
              />
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-purple-900/30"
              >
                Ayarları Kaydet
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ======================================================== */}
      {/* 3. SEKME: FİYAT & EXCEL (Yıllık Güncelleme & Yedekleme) */}
      {/* ======================================================== */}
      {activeTab === 'pricing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* YILLIK FİYAT GÜNCELLEME */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" /> Yıllık Toplu Fiyat Güncelleme
            </h3>
            <p className="text-slate-400 mb-6 text-xs sm:text-sm">
              Mevcut firmaların fiyatlarını Excel'e dökün, topluca düzenleyin ve geri yükleyin.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleDownloadUpdateTemplate} 
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white px-4 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <Download className="w-4 h-4" /> Mevcut Fiyatları İndir (Excel)
              </button>
              <div className="relative flex-1">
                <input type="file" ref={updatePriceInputRef} onChange={handleImportUpdateExcel} accept=".xlsx, .xls" className="hidden" />
                <button 
                  onClick={() => updatePriceInputRef.current?.click()} 
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors border border-slate-700 shadow-md"
                >
                  <Upload className="w-4 h-4" /> Güncel Fiyatları Yükle
                </button>
              </div>
            </div>
          </section>

          {/* DİĞER EXCEL VE YEDEK İŞLEMLERİ */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Save className="w-5 h-5 text-emerald-500" /> Yedekleme ve Excel Aktarımı
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Veritabanı Yedeği</label>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDownloadBackup} 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-colors shadow-md"
                  >
                    <Download className="w-4 h-4" /> Yedeği İndir (JSON)
                  </button>
                  <div className="relative flex-1">
                    <input type="file" ref={fileInputRef} onChange={handleRestoreBackup} accept=".json" className="hidden" />
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-slate-700 transition-colors shadow-md"
                    >
                      <Upload className="w-4 h-4" /> Yedeği Yükle
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Toplu Firma Kaydı</label>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDownloadTemplate} 
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-colors shadow-md"
                  >
                    <Download className="w-4 h-4" /> Yeni Kayıt Şablonu
                  </button>
                  <div className="relative flex-1">
                    <input type="file" ref={excelInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                    <button 
                      onClick={() => excelInputRef.current?.click()} 
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-slate-700 transition-colors shadow-md"
                    >
                      <Upload className="w-4 h-4" /> Yeni Kayıt Yükle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. SEKME: SIFIRLAMA & BAKIM */}
      {/* ======================================================== */}
      {activeTab === 'danger' && (
        <section className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 shadow-xl animate-in fade-in duration-200">
          <h3 className="text-lg font-bold text-rose-500 mb-2 flex items-center gap-2">
            <AlertOctagon className="w-6 h-6" /> Tehlikeli Bölge & Sıfırlama
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mb-6">
            Bu işlemler veritabanında geri döndürülemez değişikliklere yol açabilir. Lütfen işlem yapmadan önce yedeğinizi alın.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleClearTransactions} 
              className="flex-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Sadece Cari Hareketleri Sil
            </button>
            <button 
              onClick={handleFactoryReset} 
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm shadow-lg shadow-rose-900/40"
            >
              <Trash2 className="w-4 h-4" /> Fabrika Ayarlarına Dön
            </button>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 5. SEKME: TELEGRAM BOTU & CARİ SORGULAMA YÖNETİMİ */}
      {/* ======================================================== */}
      {activeTab === 'telegram' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Bildirim Mesajları */}
          {telegramSuccessMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span className="font-medium">{telegramSuccessMsg}</span>
              </div>
              <button onClick={() => setTelegramSuccessMsg('')} className="text-emerald-400/60 hover:text-emerald-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {telegramErrorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span className="font-medium">{telegramErrorMsg}</span>
              </div>
              <button onClick={() => setTelegramErrorMsg('')} className="text-rose-400/60 hover:text-rose-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 1. KART: BOT DURUMU VE TOKEN YAPILANDIRMASI */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Telegram Cari Botu Yapılandırması
                  </h3>
                  <p className="text-xs text-slate-400">
                    Çalışanlarınızın ve yetkililerinizin Telegram üzerinden firma bakiyesi sorgulaması ve PDF ekstre almasını sağlar.
                  </p>
                </div>
              </div>

              {/* Canlı Durum Rozeti */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isLoadingTelegram ? (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor...
                  </span>
                ) : telegramConfig?.isActive && telegramConfig?.isPollingRunning ? (
                  <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-950">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Aktif & Çalışıyor {telegramConfig.botUsername && `(@${telegramConfig.botUsername})`}
                  </span>
                ) : telegramConfig?.isConfigured ? (
                  <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    Durduruldu {telegramConfig.botUsername && `(@${telegramConfig.botUsername})`}
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                    Yapılandırılmadı
                  </span>
                )}
              </div>
            </div>

            {/* Token ve Butonlar Formu */}
            <div className="pt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Telegram Bot API Token <span className="text-sky-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showTelegramToken ? 'text' : 'password'}
                    value={telegramTokenInput}
                    onChange={(e) => setTelegramTokenInput(e.target.value)}
                    placeholder="Örn: 7123456789:AAFlq... (Telegram @BotFather'dan alınan token)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 pr-24 text-white text-xs sm:text-sm font-mono outline-none focus:border-sky-500 transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowTelegramToken(!showTelegramToken)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      title={showTelegramToken ? 'Gizle' : 'Göster'}
                    >
                      {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {telegramTokenInput && !telegramTokenInput.includes('...') && (
                      <button
                        type="button"
                        onClick={() => setTelegramTokenInput('')}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Temizle"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Telegram uygulamasında <b className="text-slate-400">@BotFather</b> ile konuşup <code className="text-sky-400">/newbot</code> komutu ile aldığınız API Token.
                </p>
              </div>

              {/* Bot Servisi Açma / Kapama Toggle */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isTelegramActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Power className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-200">
                      Telegram Bot Servisini Çalıştır
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isTelegramActive ? 'Bot aktif durumdadır, mesajları arka planda dinler.' : 'Bot durdurulmuştur, mesaj yanıtlamaz.'}
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTelegramActive}
                    onChange={(e) => setIsTelegramActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* Eylem Butonları */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestTelegramToken}
                  disabled={isTestingTelegram || !telegramTokenInput}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
                >
                  {isTestingTelegram ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                      <span>Test Ediliyor...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 text-sky-400" />
                      <span>Bağlantıyı Test Et</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveTelegramConfig}
                  disabled={isSavingTelegram}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-sky-950/40 transition-all disabled:opacity-50"
                >
                  {isSavingTelegram ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Ayarları Kaydet & {isTelegramActive ? 'Başlat' : 'Durdur'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* 2. KART: YETKİLİ TELEGRAM KULLANICILARI (ID TANITMA & SİLME) */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Yetkili Telegram Kullanıcıları
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sadece burada tanımlı Telegram kullanıcıları bot üzerinden firma bakiyelerini ve PDF ekstrelerini sorgulayabilir.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold self-start sm:self-auto">
                {telegramConfig?.allowedUsers?.length || 0} Yetkili Tanımlı
              </span>
            </div>

            {/* Güvenlik Bilgilendirme Uyarısı */}
            <div className="bg-sky-950/20 border border-sky-800/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-300">
              <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-sky-300">Sıfır Güvenlik Riski:</b> Buraya eklenmeyen yabancı bir kişi bota mesaj atsa bile sistem sorgu yapmasına izin vermez, finansal verileri gizler ve kişiye yalnızca kendi Telegram ID'sini göstererek yöneticisine başvurmasını söyler.
              </div>
            </div>

            {/* Yeni Yetkili Ekleme Formu */}
            <form onSubmit={handleAddTelegramUser} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" /> Yeni Yetkili Ekle
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Telegram ID Numarası <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTelegramId}
                    onChange={(e) => setNewTelegramId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Örn: 589218492"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Kişi / Unvan / Açıklama <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTelegramName}
                    onChange={(e) => setNewTelegramName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz (Muhasebe)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    disabled={isAddingTelegramUser || !newTelegramId.trim() || !newTelegramName.trim()}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-sky-950 disabled:opacity-50"
                  >
                    {isAddingTelegramUser ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Yetki Ver</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Yetkili Kullanıcılar Tablosu */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Kişi / Açıklama</th>
                    <th className="py-2.5 px-4 font-semibold">Telegram ID</th>
                    <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Kayıt Tarihi</th>
                    <th className="py-2.5 px-4 font-semibold text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {telegramConfig?.allowedUsers && telegramConfig.allowedUsers.length > 0 ? (
                    telegramConfig.allowedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-[10px]">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          <div className="flex items-center gap-2">
                            <span>{user.telegram_id}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(user.telegram_id);
                                setCopiedTelegramId(user.telegram_id);
                                setTimeout(() => setCopiedTelegramId(null), 2000);
                              }}
                              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                              title="ID Kopyala"
                            >
                              {copiedTelegramId === user.telegram_id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 hidden sm:table-cell">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTelegramUser(user)}
                            disabled={deletingTelegramUserId === user.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                            title="Yetkiyi Kaldır / Sil"
                          >
                            {deletingTelegramUserId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Henüz yetkilendirilmiş Telegram kullanıcısı bulunmuyor. Yukarıdaki formdan çalışanlarınızın Telegram ID'lerini ekleyebilirsiniz.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. KART: ADIM ADIM HIZLI KURULUM REHBERİ */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
            <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-400" /> 4 Adımda Kolay Kurulum Kılavuzu
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px]">1</span>
                  Telegram'da Bot Oluşturun
                </div>
                <p className="text-slate-400">
                  Telegram'ı açıp arama yerine <b className="text-white">@BotFather</b> yazın. Sohbeti başlatıp <code className="text-sky-300">/newbot</code> yazın ve botunuza bir isim ve kullanıcı adı verin.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px]">2</span>
                  Token'ı Sisteme Tanıtın
                </div>
                <p className="text-slate-400">
                  BotFather'ın verdiği <code className="text-sky-300">API Token</code>'ı yukarıdaki kutucuğa yapıştırın. "Bağlantıyı Test Et" ve "Ayarları Kaydet & Başlat" butonuna basın.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px]">3</span>
                  Çalışan ID'lerini Ekleyin
                </div>
                <p className="text-slate-400">
                  Çalışanlarınız Telegram'da bota veya <b className="text-white">@userinfobot</b>'a mesaj attığında sayısal ID numaralarını öğrenirler. Bu ID'yi yukarıdaki "Yeni Yetkili Ekle" formuna girin.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px]">4</span>
                  Bakiye & PDF Ekstre Alın
                </div>
                <p className="text-slate-400">
                  Yetkili çalışanlarınız bota firma adını (örn: <b className="text-white">Tekstil</b>) yazdığında güncel borç/alacak kartı ve altında <b className="text-emerald-400">[📄 Cari Ekstre (PDF İndir)]</b> butonu çıkar!
                </p>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: YENİ KULLANICI EKLEME */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Yeni Kullanıcı Ekle</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-120px)]">
              {addUserError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addUserError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Kullanıcı Adı <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="Örn: muhasebe, ahmet..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Şifre <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="En az 4 karakter..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Şifre (Tekrar) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={addPasswordConfirm}
                  onChange={(e) => setAddPasswordConfirm(e.target.value)}
                  placeholder="Şifreyi tekrar yazın..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Kullanıcı Rolü / Yetki
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'admin' | 'user')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-purple-500"
                >
                  <option value="user">Standart Kullanıcı (Veri girişi ve fatura)</option>
                  <option value="admin">Yönetici (Tam yetki + Kullanıcı yönetimi)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer bg-slate-950/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={addTwoFactor}
                    onChange={(e) => setAddTwoFactor(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-900 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Google Authenticator (2FA) Girişte Zorunlu Olsun
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kullanıcı sisteme giriş yaparken şifresine ek olarak 6 haneli 2FA kodu girmek zorunda olur.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingAdd ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kullanıcıyı Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: KULLANICI DÜZENLEME & ŞİFRE SIFIRLAMA */}
      {/* ======================================================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Kullanıcıyı Düzenle</h3>
                  <div className="text-xs text-slate-400">{editingUser.username}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-120px)]">
              {editUserError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editUserError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Yeni Şifre Sıfırla <span className="text-slate-500 font-normal">(Aynı kalması için boş bırakın)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Yeni şifre belirleyin (opsiyonel)..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Kullanıcı Rolü / Yetki
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                >
                  <option value="user">Standart Kullanıcı</option>
                  <option value="admin">Yönetici (Admin)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer bg-slate-950/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={editTwoFactor}
                    onChange={(e) => setEditTwoFactor(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Google Authenticator (2FA) Durumu
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      İşaretli ise kullanıcının giriş yaparken 6 haneli kod girmesi zorunludur. İşareti kaldırırsanız 2FA sıfırlanır.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-900/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Değişiklikleri Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: GOOGLE AUTHENTICATOR (2FA) KURULUM MODALI */}
      {/* ======================================================== */}
      {show2FASetupModal && setup2FAData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Google Authenticator (2FA) Kurulumu</h3>
                  <p className="text-xs text-slate-400">Hesabınızı iki adımlı doğrulama ile koruyun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShow2FASetupModal(false);
                  setSetup2FAData(null);
                  setSetup2FACode('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleVerifyAndEnable2FA} className="overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[calc(92vh-130px)]">
              {setup2FAError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{setup2FAError}</span>
                </div>
              )}

              {/* 2 Sütunlu Kompakt Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-center">
                {/* Sol Taraf: QR Kod ve Manuel Kod */}
                <div className="flex flex-col items-center justify-center bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-center space-y-2.5">
                  <div className="p-2.5 bg-white rounded-xl shadow-md border-2 border-slate-700 inline-block">
                    <QRCodeSVG
                      value={setup2FAData.otpauthUrl}
                      size={140}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  
                  <div className="w-full">
                    <div className="text-[11px] text-slate-400 mb-1">
                      Kamera okumazsa manuel kod:
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
                      <input
                        type="text"
                        readOnly
                        value={setup2FAData.secret}
                        className="w-full bg-transparent text-emerald-400 font-mono text-[11px] outline-none select-all text-center tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(setup2FAData.secret);
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 2000);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                        title="Kodu kopyala"
                      >
                        {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSecret ? 'Kopyalandı' : 'Kopyala'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sağ Taraf: Adımlar ve Doğrulama Kodu */}
                <div className="space-y-3.5">
                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                      <span>Telefonda <strong>Google Authenticator</strong> uygulamasını açın.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                      <span><strong>"+"</strong> butonuna basıp <strong>QR Kodu</strong> taratın.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                      <span>Uygulamada oluşan <strong>6 haneli kodu</strong> aşağıya yazın:</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1 text-center">
                      Telefonunuzdaki 6 Haneli Kodu Girin:
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="000000"
                      value={setup2FACode}
                      onChange={(e) => setSetup2FACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl py-2.5 text-center text-2xl font-mono tracking-widest text-emerald-400 outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShow2FASetupModal(false);
                        setSetup2FAData(null);
                        setSetup2FACode('');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting2FA || setup2FACode.length !== 6}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isSubmitting2FA ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Doğrulanıyor...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Doğrula ve Aktif Et</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: 2FA DEVRE DIŞI BIRAKMA MODALI */}
      {/* ======================================================== */}
      {showDisable2FAModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ShieldOff className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">2FA'yı Devre Dışı Bırak</h3>
                  <p className="text-xs text-slate-400">Güvenlik doğrulaması gereklidir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDisable2FAModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisable2FA} className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-120px)]">
              {disable2FAError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{disable2FAError}</span>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed">
                İki Adımlı Doğrulamayı (Google Authenticator) kapatmak istediğinize emin misiniz? Güvenliğiniz için lütfen mevcut hesap şifrenizi girin.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mevcut Şifreniz <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={disable2FAPassword}
                  onChange={(e) => setDisable2FAPassword(e.target.value)}
                  placeholder="Mevcut şifrenizi girin..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDisable2FAModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDisable2FA || !disable2FAPassword}
                  className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-rose-900/30 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingDisable2FA ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Kapatılıyor...</span>
                    </>
                  ) : (
                    <>
                      <ShieldOff className="w-3.5 h-3.5" />
                      <span>2FA'yı Devre Dışı Bırak</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
