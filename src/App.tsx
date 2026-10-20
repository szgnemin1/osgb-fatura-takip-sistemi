
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import FirmRegistration from './pages/FirmRegistration';
import Preparation from './pages/Preparation';
import Invoices from './pages/Invoices';
import FirmDetails from './pages/FirmDetails';
import Settings from './pages/Settings';
import DebtTracking from './pages/DebtTracking';
import Support from './pages/Support';
import Expenses from './pages/Expenses'; // Yeni Sayfa
import Quotes from './pages/Quotes';
import CuttingPortal from './pages/CuttingPortal';
import { db } from './services/db';
import { Loader2, Menu, RefreshCw, AlertCircle } from 'lucide-react';
import io from 'socket.io-client';

import Login from './pages/Login';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('auth_token'));
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = (token: string) => {
      setIsAuthenticated(true);
  };

  const handleLogout = () => {
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
  };

  const initApp = async () => {
      if (!isAuthenticated) return;
      setIsInitializing(true);
      setError(null);
      try {
          await db.initData();
          setIsInitializing(false);
      } catch (e: any) {
          console.error(e);
          if (e.message === '401' || e.message === '403') {
              handleLogout();
          } else {
              setError(e.message || "Veritabanına bağlanılamadı.");
          }
          setIsInitializing(false);
      }
  };

  useEffect(() => {
    if (isAuthenticated) {
        initApp();

        // Socket.io for Real-Time Concurrency
        const socketUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : undefined;
        const socket = io(socketUrl as any);
        
        socket.on('db_updated', () => {
           db.initData();
        });

        socket.on('transaction_approved', ({ id }) => {
           const transactionsStr = localStorage.getItem('osgb_transactions');
           if (transactionsStr) {
               const transactions = JSON.parse(transactionsStr);
               const updated = transactions.map((t: any) => t.id === id ? { ...t, status: 'APPROVED' } : t);
               localStorage.setItem('osgb_transactions', JSON.stringify(updated));
           }
           db.initData(); 
        });

        // Listen for global logout event from db.ts
        const handleAuthError = () => handleLogout();
        window.addEventListener('auth_error', handleAuthError);

        return () => {
            socket.disconnect();
            window.removeEventListener('auth_error', handleAuthError);
        };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Fatura Kesim Terminali (#/kesim): Şifresiz / Operatör PIN ile doğrudan erişim
  const isKesimPath = window.location.hash.startsWith('#/kesim');
  if (isKesimPath) {
    return (
      <Router>
        <Routes>
          <Route path="/kesim" element={<CuttingPortal />} />
          <Route path="*" element={<Navigate to="/kesim" replace />} />
        </Routes>
      </Router>
    );
  }

  if (!isAuthenticated) {
      return <Login onLogin={handleLogin} />;
  }

  if (isInitializing) {
      return (
          <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              <p className="animate-pulse">Veriler Yükleniyor...</p>
          </div>
      );
  }

  if (error) {
      return (
          <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-6 p-6 text-center">
              <div className="bg-rose-500/10 p-4 rounded-full">
                  <AlertCircle className="w-12 h-12 text-rose-500" />
              </div>
              <div>
                  <h2 className="text-xl font-bold text-white">Bağlantı Hatası</h2>
                  <p className="text-slate-400 mt-2 max-w-md">{error}</p>
                  <p className="text-xs text-slate-600 mt-2">Bilgisayarınızın açık ve uygulamanın çalıştığından emin olun.</p>
              </div>
              <button 
                onClick={initApp}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all"
              >
                  <RefreshCw className="w-4 h-4" />
                  Tekrar Dene
              </button>
          </div>
      );
  }

  return (
    <Router>
      <div className="flex h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden">
        
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
          
          {/* Mobil Header */}
          <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-30">
             <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-300 hover:text-white">
                  <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-white tracking-wider flex items-center gap-2">
                   <span className="text-blue-500">OSGB</span> PRO
                </span>
             </div>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto h-full pb-20 md:pb-0">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/firms" element={<FirmRegistration />} />
                <Route path="/prepare" element={<Preparation />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/details" element={<FirmDetails />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/debt-tracking" element={<DebtTracking />} />
                <Route path="/support" element={<Support />} />
                <Route path="/quotes" element={<Quotes />} />
                <Route path="/kesim" element={<CuttingPortal />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;
