

import React, { useState, useEffect } from 'react';
import { Github, Linkedin, MessageSquare, Info, Cpu, Monitor, HardDrive, Send, ExternalLink, Instagram, CheckCircle } from 'lucide-react';

const Support = () => {
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  
  const [systemInfo, setSystemInfo] = useState({
    os: 'Yükleniyor...',
    cpu: 'Yükleniyor...',
    gpu: 'Yükleniyor...',
    appVersion: '2.1.0',
    platform: 'Web Browser',
    arch: '',
    ram: ''
  });

  useEffect(() => {
    const getSpecs = () => {
      const isElectron = typeof window !== 'undefined' && (window as any).process && (window as any).process.type === 'renderer';
      let gpu = 'Bilinmiyor';
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpu = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }
      } catch (e) {}

      if (isElectron) {
        const proc = (window as any).process;
        setSystemInfo({
          os: `${proc.platform} (Sürüm: ${proc.getSystemVersion()})`,
          cpu: `${navigator.hardwareConcurrency} Çekirdek - Mimari: ${proc.arch}`,
          gpu: gpu,
          appVersion: '2.1.0',
          platform: 'Windows Masaüstü Uygulaması (EXE)',
          arch: proc.arch,
          ram: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Bilinmiyor'
        });
      } else {
        setSystemInfo(prev => ({
          ...prev,
          os: `${navigator.platform} (Web)`,
          cpu: `${navigator.hardwareConcurrency} Çekirdek`,
          gpu: gpu,
          platform: 'Web Tarayıcı',
          ram: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Bilinmiyor'
        }));
      }
    };
    getSpecs();
  }, []);

  const handleSendReport = () => {
    if (!description.trim()) {
      alert("Lütfen mesajınızı yazınız.");
      return;
    }

    setIsSending(true);
    const email = "m.e.sezgin04@gmail.com";
    const subject = `OSGB Pro Bug/Öneri Raporu - v${systemInfo.appVersion}`;
    const body = `--- KULLANICI MESAJI ---
${description}

--- CIHAZ BILGILERI ---
Sürüm: ${systemInfo.appVersion}
Platform: ${systemInfo.platform}
Sistem: ${systemInfo.os}
Donanım: ${systemInfo.cpu} / ${systemInfo.gpu}
RAM: ${systemInfo.ram}
Tarih: ${new Date().toLocaleString('tr-TR')}
`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    setTimeout(() => {
        setIsSending(false);
        setSentSuccess(true);
        setDescription('');
        setTimeout(() => setSentSuccess(false), 5000);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <header>
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-500" />
          Destek ve Geliştirici İletişimi
        </h2>
        <p className="text-slate-400 mt-2">Uygulama ile ilgili her türlü soru, hata bildirimi ve iş birliği için ulaşabilirsiniz.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Info className="w-5 h-5 text-blue-400" /> Sosyal Medya</h3>
            <div className="flex flex-col gap-3">
              <a href="https://www.linkedin.com/in/szgnemin" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-900 rounded-lg group hover:bg-slate-750 transition-all">
                <div className="flex items-center gap-3"><Linkedin className="w-5 h-5 text-blue-400" /><span className="text-sm">LinkedIn</span></div>
                <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-white" />
              </a>
              <a href="https://www.instagram.com/szgn_emin/" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-900 rounded-lg group hover:bg-slate-750 transition-all">
                <div className="flex items-center gap-3"><Instagram className="w-5 h-5 text-pink-500" /><span className="text-sm">Instagram</span></div>
                <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-white" />
              </a>
              <a href="https://github.com/szgnemin1" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-slate-900 rounded-lg group hover:bg-slate-750 transition-all">
                <div className="high-quality flex items-center gap-3"><Github className="w-5 h-5 text-white" /><span className="text-sm">GitHub</span></div>
                <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-white" />
              </a>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Otomatik Sistem Tanılama</h4>
            <div className="space-y-4">
               <div className="flex items-center gap-3"><Monitor className="w-4 h-4 text-blue-400" /><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Yazılım</span><span className="text-xs text-slate-200">{systemInfo.platform}</span></div></div>
               <div className="flex items-center gap-3"><Cpu className="w-4 h-4 text-purple-400" /><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Donanım</span><span className="text-xs text-slate-200">{systemInfo.cpu}</span></div></div>
               <div className="flex items-center gap-3"><HardDrive className="w-4 h-4 text-emerald-400" /><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase">Ekran Kartı</span><span className="text-xs text-slate-200 truncate w-40">{systemInfo.gpu}</span></div></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-xl relative overflow-hidden">
            {sentSuccess && (
                <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white animate-in fade-in duration-300">
                    <CheckCircle className="w-16 h-16 mb-4" />
                    <h3 className="text-2xl font-bold">Rapor Hazırlandı!</h3>
                    <p className="mt-2 opacity-90">Mail uygulamanızdan gönder butonuna basınız.</p>
                    <button onClick={() => setSentSuccess(false)} className="mt-6 bg-white text-emerald-700 px-6 py-2 rounded-lg font-bold">Yeni Mesaj</button>
                </div>
            )}
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><Send className="w-6 h-6 text-emerald-500" /> Hata Bildir / Öneri</h3>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={12} placeholder="Sorunu veya önerinizi buraya yazın..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none mb-6" />
            <button onClick={handleSendReport} disabled={isSending} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98]">
                {isSending ? 'Hazırlanıyor...' : <><Send className="w-5 h-5" /> Mail Uygulaması İle Gönder</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;