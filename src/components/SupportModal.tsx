import React, { useState, useEffect } from 'react';
import { 
  Github, Linkedin, Instagram, Info, Cpu, Monitor, 
  HardDrive, Send, ExternalLink, CheckCircle, X, LifeBuoy, Mail, Copy, Check
} from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  
  const [systemInfo, setSystemInfo] = useState({
    os: 'Yükleniyor...',
    cpu: 'Yükleniyor...',
    gpu: 'Yükleniyor...',
    appVersion: '2.2.0',
    platform: 'Web Tarayıcı',
    arch: '',
    ram: ''
  });

  useEffect(() => {
    if (!isOpen) return;

    const getSpecs = () => {
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

      setSystemInfo({
        os: `${navigator.platform} (Web)`,
        cpu: `${navigator.hardwareConcurrency || 4} Çekirdek`,
        gpu: gpu,
        appVersion: '2.2.0',
        platform: 'OSGB ProFinans Web',
        arch: '',
        ram: (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'Bilinmiyor'
      });
    };

    getSpecs();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendReport = () => {
    if (!description.trim()) {
      alert("Lütfen mesajınızı veya önerinizi yazınız.");
      return;
    }

    setIsSending(true);
    const email = "m.e.sezgin04@gmail.com";
    const subject = `OSGB Pro Hata/Öneri Bildirimi - v${systemInfo.appVersion}`;
    const body = `--- KULLANICI MESAJI ---
${description}

--- SİSTEM BİLGİLERİ ---
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

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("m.e.sezgin04@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Başlığı */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Destek & Geliştirici İletişimi
              </h3>
              <p className="text-xs text-slate-400">
                Teknik destek, soru, hata bildirimi ve geliştirme önerileri.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Gövdesi */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 max-h-[calc(92vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            
            {/* Sol Kolon: Geliştirici & Sosyal Medya & Tanılama (2 Kolon) */}
            <div className="md:col-span-2 space-y-4">
              
              {/* Geliştirici Kartı */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold flex items-center justify-center shadow-md text-sm shrink-0">
                    ES
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Emin Sezgin</h4>
                    <span className="text-[11px] text-blue-400 font-medium">Yazılım Geliştirici</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-slate-400 font-mono text-[11px] truncate" title="m.e.sezgin04@gmail.com">
                    m.e.sezgin04@gmail.com
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="E-postayı kopyala"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Sosyal Medya Linkleri */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5 text-blue-400" /> Kanallar
                </h4>
                <div className="space-y-1.5">
                  <a 
                    href="https://www.linkedin.com/in/szgnemin" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800/80 text-xs text-slate-300 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Linkedin className="w-4 h-4 text-blue-400" />
                      <span>LinkedIn</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                  </a>

                  <a 
                    href="https://www.instagram.com/szgn_emin/" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800/80 text-xs text-slate-300 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Instagram className="w-4 h-4 text-pink-400" />
                      <span>Instagram</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                  </a>

                  <a 
                    href="https://github.com/szgnemin1" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-800/80 text-xs text-slate-300 hover:text-white transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Github className="w-4 h-4 text-slate-300" />
                      <span>GitHub</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Sistem Tanılama */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-[11px]">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Sistem Bilgileri
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-blue-400" /> Sürüm</span>
                  <span className="text-slate-200 font-mono">v{systemInfo.appVersion}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-purple-400" /> İşlemci</span>
                  <span className="text-slate-200 font-mono">{systemInfo.cpu}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Bellek</span>
                  <span className="text-slate-200 font-mono">{systemInfo.ram}</span>
                </div>
              </div>

            </div>

            {/* Sağ Kolon: Mesaj ve Hata Bildirimi (3 Kolon) */}
            <div className="md:col-span-3">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden h-full flex flex-col justify-between">
                
                {sentSuccess && (
                  <div className="absolute inset-0 bg-emerald-600/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
                    <CheckCircle className="w-14 h-14 mb-3" />
                    <h4 className="text-lg font-bold">Mail Hazırlandı!</h4>
                    <p className="text-xs opacity-90 mt-1 max-w-xs">
                      Varsayılan e-posta istemciniz açıldı. Lütfen gönder butonuna basınız.
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setSentSuccess(false)} 
                      className="mt-4 bg-white text-emerald-800 px-4 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Yeni Mesaj Yaz
                    </button>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    Hata Bildir veya Öneri Gönder
                  </h4>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Programda karşılaştığınız bir sorunu veya eklenmesini istediğiniz bir özelliği doğrudan geliştiriciye iletin:
                  </p>

                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    rows={6} 
                    placeholder="Karşılaştığınız hatayı veya önerinizi detaylıca yazın..." 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500 transition-colors resize-none mb-3"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-500 text-center sm:text-left">
                    Sistem tanı bilgileri otomatik olarak mesaja eklenecektir.
                  </span>

                  <button 
                    type="button"
                    onClick={handleSendReport} 
                    disabled={isSending || !description.trim()} 
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 text-xs transition-all cursor-pointer shrink-0"
                  >
                    {isSending ? (
                      'Hazırlanıyor...'
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>E-posta İle Gönder</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
