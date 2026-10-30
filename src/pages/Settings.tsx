import React, { useRef, useState, useEffect } from 'react';
import { db } from '../services/db';
import { exporter } from '../services/exporter';
import { 
  Save, Upload, Download, Database, Trash2, AlertOctagon, RefreshCw, 
  TrendingUp, Percent, Landmark, Receipt, Users, UserPlus, Lock, KeyRound, 
  CheckCircle2, AlertCircle, Edit2, X, Eye, EyeOff, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GlobalSettings, AppUser } from '../types';

const Settings = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const updatePriceInputRef = useRef<HTMLInputElement>(null);
    
  // Aktif Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'params' | 'pricing' | 'danger'>('users');

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

  // Yeni Kullanıcı Ekleme Modalı State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addPasswordConfirm, setAddPasswordConfirm] = useState('');
  const [addRole, setAddRole] = useState<'admin' | 'user'>('user');
  const [addUserError, setAddUserError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Kullanıcı Düzenleme / Şifre Sıfırlama Modalı State
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editUserError, setEditUserError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

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
    loadUsers();

    const handleUserUpdate = (e: any) => {
      if (e.detail) {
        setCurrentUser({ username: e.detail.username, role: e.detail.role });
      } else {
        setCurrentUser(db.getCurrentUser());
      }
    };
    window.addEventListener('auth_user_updated', handleUserUpdate);
    return () => window.removeEventListener('auth_user_updated', handleUserUpdate);
  }, []);

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
        role: addRole
      });

      setShowAddModal(false);
      setAddUsername('');
      setAddPassword('');
      setAddPasswordConfirm('');
      setAddRole('user');
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
        role: editRole
      });

      setEditingUser(null);
      loadUsers();
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

          {/* B) SİSTEM KULLANICILARI & YENİ KULLANICI EKLEME */}
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
                    Fatura programına giriş yapabilecek kullanıcıların listesi ve yetkileri.
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
                    setShowAddModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-2 transition-all shrink-0"
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
                            <div className="flex items-center gap-2 text-xs mt-0.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                isAdmin
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isAdmin ? 'Yönetici (Admin)' : 'Standart Kullanıcı'}
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
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Şifre Sıfırla / Rol Düzenle"
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
      {/* MODAL: YENİ KULLANICI EKLEME */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
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

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
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
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-900/30 flex items-center gap-1.5"
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
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

            <form onSubmit={handleUpdateUser} className="p-5 space-y-4">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-900/30 flex items-center gap-1.5"
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
