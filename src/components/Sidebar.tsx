
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Calculator, Receipt, FileText, Settings, TrendingDown, LifeBuoy, X, Wallet, LogOut, FileSignature, FileCheck } from 'lucide-react';
import { db } from '../services/db';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [currentUser, setCurrentUser] = useState(() => db.getCurrentUser());

  useEffect(() => {
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
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
      isActive 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
    }`;

  // Overlay ve Sidebar Container sınıfları
  const sidebarContainerClass = `
    fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-slate-900 border-r border-slate-800 h-full flex flex-col transition-transform duration-300 ease-in-out
    md:translate-x-0 md:static md:h-screen md:shrink-0
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <>
      {/* Mobile Backdrop (Siyah Perde) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div className={sidebarContainerClass}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-100 tracking-wider flex items-center gap-2">
              <img src="logo.svg" alt="Logo" className="w-8 h-8" />
              <div><span className="text-blue-500">OSGB</span> PRO</div>
          </h1>
          {/* Mobil Kapatma Butonu */}
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 4px;
          }
        `}</style>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          <NavLink to="/" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Ana Sayfa</span>
          </NavLink>
          <NavLink to="/firms" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <Building2 className="w-5 h-5" />
            <span>Firma Kayıt</span>
          </NavLink>
          <NavLink to="/prepare" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <Calculator className="w-5 h-5" />
            <span>Fatura Hazırlık</span>
          </NavLink>
          <NavLink to="/invoices" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <Receipt className="w-5 h-5" />
            <span>Kesilecek Faturalar</span>
          </NavLink>
          <NavLink to="/expenses" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <Wallet className="w-5 h-5" />
            <span>Gider Yönetimi</span>
          </NavLink>
          <NavLink to="/details" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <FileText className="w-5 h-5" />
            <span>Cari Detay</span>
          </NavLink>
          <NavLink to="/debt-tracking" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <TrendingDown className="w-5 h-5" />
            <span>Borç Takip</span>
          </NavLink>
          <NavLink to="/mutabakat" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <FileCheck className="w-5 h-5" />
            <span>Cari Mutabakat</span>
          </NavLink>
          <NavLink to="/quotes" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <FileSignature className="w-5 h-5" />
            <span>Fiyat Teklifi</span>
          </NavLink>
          
          <div className="pt-2 border-t border-slate-800 mt-2 space-y-1">
            <NavLink to="/settings" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
              <Settings className="w-5 h-5" />
              <span>Ayarlar & Yedek</span>
            </NavLink>
            <button 
              onClick={() => {
                if (window.confirm("Çıkış yapmak istediğinize emin misiniz?")) {
                  window.dispatchEvent(new Event('auth_error'));
                }
              }} 
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-left text-sm"
            >
              <LogOut className="w-5 h-5" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </nav>

        {/* Kullanıcı Profil Özeti */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <NavLink 
            to="/settings"
            onClick={() => window.innerWidth < 768 && onClose()}
            className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all group"
            title="Kullanıcı Ayarları ve Profil"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
              {(currentUser.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="truncate flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{currentUser.username}</div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                {currentUser.role === 'admin' ? (
                  <span className="text-emerald-400 font-medium">Yönetici</span>
                ) : (
                  <span className="text-slate-400">Kullanıcı</span>
                )}
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
          </NavLink>
        </div>

        <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/60">
          <span className="text-[11px] text-slate-500 font-mono">v2.2.0</span>
          <button 
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event('open_support'));
              if (window.innerWidth < 768) onClose();
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Destek & İletişim"
          >
            <LifeBuoy className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-[11px]">Destek & İletişim</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
