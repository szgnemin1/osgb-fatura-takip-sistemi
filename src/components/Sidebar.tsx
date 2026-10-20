
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Calculator, Receipt, FileText, Settings, TrendingDown, LifeBuoy, X, Wallet, LogOut, FileSignature } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
      isActive 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
    }`;

  // Overlay ve Sidebar Container sınıfları
  const sidebarContainerClass = `
    fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 h-full flex flex-col transition-transform duration-300 ease-in-out
    md:translate-x-0 md:static md:h-screen
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
          <NavLink to="/quotes" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
            <FileSignature className="w-5 h-5" />
            <span>Fiyat Teklifi</span>
          </NavLink>
          
          <div className="pt-2 border-t border-slate-800 mt-2 space-y-1">
            <NavLink to="/support" className={navClass} onClick={() => window.innerWidth < 768 && onClose()}>
              <LifeBuoy className="w-5 h-5" />
              <span>Destek & İletişim</span>
            </NavLink>
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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-left"
            >
              <LogOut className="w-5 h-5" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          v2.1.0 • Mobil Uyumlu
        </div>
      </div>
    </>
  );
};

export default Sidebar;
