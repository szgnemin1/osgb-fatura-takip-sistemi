import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import FirmRegistration from './pages/FirmRegistration';
import Preparation from './pages/Preparation';
import Invoices from './pages/Invoices';
import FirmDetails from './pages/FirmDetails';
import Settings from './pages/Settings';

const App = () => {
  return (
    <Router>
      <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8 relative">
          <div className="max-w-7xl mx-auto h-full">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/firms" element={<FirmRegistration />} />
              <Route path="/prepare" element={<Preparation />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/details" element={<FirmDetails />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;