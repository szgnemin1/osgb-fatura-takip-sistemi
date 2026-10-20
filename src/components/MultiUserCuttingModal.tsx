import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Link as LinkIcon,
  RefreshCw,
  Key
} from 'lucide-react';

interface OperatorStat {
  code: string;
  name: string;
  total: number;
  approved: number;
  pending: number;
  progressPercent: number;
  directLink: string;
  fixedLink: string;
}

interface ActiveBatchResponse {
  active: boolean;
  batchId?: string;
  createdAt?: string;
  totalInvoices?: number;
  serverIp?: string;
  port?: number;
  operators?: OperatorStat[];
}

interface MultiUserCuttingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingInvoicesCount: number;
}

export const MultiUserCuttingModal: React.FC<MultiUserCuttingModalProps> = ({
  isOpen,
  onClose,
  pendingInvoicesCount
}) => {
  const [activeBatch, setActiveBatch] = useState<ActiveBatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Yeni Dağıtım Form State
  const [showForm, setShowForm] = useState(false);
  const [operatorCount, setOperatorCount] = useState<number>(2);
  const [operatorNames, setOperatorNames] = useState<string[]>(['Operatör 1', 'Operatör 2']);

  // Sunucudan Aktif Dağıtımı Çek
  const fetchActiveBatch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/batches/active');
      if (res.ok) {
        const json: ActiveBatchResponse = await res.json();
        setActiveBatch(json);
        if (!json.active) {
          setShowForm(true);
        } else {
          setShowForm(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActiveBatch();
    }
  }, [isOpen]);

  // Kişi Sayısı Değiştiğinde İsim Dizisini Güncelle
  const handleOperatorCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(10, count));
    setOperatorCount(validCount);
    setOperatorNames(prev => {
      const newNames = [...prev];
      while (newNames.length < validCount) {
        newNames.push(`Operatör ${newNames.length + 1}`);
      }
      return newNames.slice(0, validCount);
    });
  };

  // Dağıtımı Oluştur
  const handleCreateBatch = async () => {
    if (pendingInvoicesCount === 0) {
      alert("Şu anda onay bekleyen fatura bulunmuyor.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/batches/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          operatorCount,
          operatorNames
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'İş paylaşımı oluşturulamadı');
      }
      await fetchActiveBatch();
      setShowForm(false);
    } catch (e: any) {
      alert(e.message || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Dağıtımı Sonlandır
  const handleCancelBatch = async () => {
    if (!window.confirm("Aktif iş paylaşımını sonlandırmak istediğinize emin misiniz? Faturalar tekil listede görünmeye devam edecektir.")) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/batches/cancel', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      await fetchActiveBatch();
      setShowForm(true);
    } catch (e: any) {
      alert('İptal sırasında hata oluştu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Şifreleri Döndür / Yenile (Güvenlik)
  const handleRotateCodes = async (operatorCode?: string) => {
    const confirmMsg = operatorCode
      ? `Bu operatörün 4 haneli güvenlik şifresini yenilemek istediğinize emin misiniz?`
      : `Tüm operatörlerin 4 haneli güvenlik şifrelerini yenilemek istediğinize emin misiniz?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/batches/rotate-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ operatorCode })
      });
      if (res.ok) {
        await fetchActiveBatch();
      } else {
        const err = await res.json();
        alert(err.error || 'Şifreler yenilenemedi');
      }
    } catch (e: any) {
      alert('Hata: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Kopyalama Yardımcısı
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Tümünü WhatsApp İçin Kopyala
  const handleCopyAllForWhatsApp = () => {
    if (!activeBatch || !activeBatch.operators) return;
    const origin = window.location.origin;
    const fixedUrl = `${origin}/#/kesim`;

    let msg = `📋 *OSGB FATURA KESİM İŞ PAYLAŞIMI*\n`;
    msg += `Toplam Kesilecek: *${activeBatch.totalInvoices} Fatura*\n`;
    msg += `Sabit Link: ${fixedUrl}\n\n`;
    msg += `👥 *GÖREV VE 4 HANELİ GÜVENLİK ŞİFRELERİ:*\n`;

    activeBatch.operators.forEach(op => {
      const link = `${origin}/#/kesim?kod=${op.code}`;
      msg += `\n👤 *${op.name}* (${op.total} Fatura)\n`;
      msg += `🔑 4 Haneli Şifre: *${op.code}*\n`;
      msg += `🔗 Direkt Link: ${link}\n`;
    });

    msg += `\n_Linke tıklayıp faturayı portalda kestikten sonra "Kestim (Onayla)" butonuna basmanız yeterlidir._`;

    handleCopy(msg, 'whatsapp_all');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* MODAL BAŞLIK */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Çoklu Fatura Kesimi & İş Paylaşımı</span>
              </h2>
              <p className="text-xs text-slate-400">
                Faturaları eşit bölüştürün, her operatör sadece kendi payını kessin, karışıklık önlensin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL GÖVDE */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* DURUM 1: AKTİF BİR DAĞITIM VARSA (TAKİP VE LİNK PAYLAŞIM EKRANI) */}
          {activeBatch?.active && !showForm && (
            <div className="space-y-4 animate-in fade-in">
              
              {/* Canlı Özet Başlığı */}
              <div className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold text-white">İş Paylaşımı Aktif</h3>
                    <span className="text-xs text-slate-400 font-mono">
                      (Toplam {activeBatch.totalInvoices} Fatura)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Sabit Portal: <span className="text-blue-400 font-mono font-semibold">{window.location.origin}/#/kesim</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyAllForWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95 shrink-0"
                >
                  {copiedKey === 'whatsapp_all' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp Formatında Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {/* Operatör Kartları ve Şifre Yönetimi */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Operatörler ve 4 Haneli Şifreler:
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRotateCodes()}
                    className="text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors font-medium"
                    title="Tüm operatörlerin 4 haneli şifrelerini anında yeniler"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Şifreleri Yenile (Döndür)</span>
                  </button>
                </div>

                {activeBatch.operators?.map(op => {
                  const directLink = `${window.location.origin}/#/kesim?kod=${op.code}`;
                  const isOpDone = op.total > 0 && op.approved === op.total;

                  return (
                    <div
                      key={op.code}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isOpDone
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        
                        {/* Sol: İsim ve 4 Haneli Şifre */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1 bg-blue-950/70 border border-blue-500/40 px-2.5 py-1.5 rounded-xl shadow-inner">
                            <Key className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-mono text-sm font-bold text-blue-200 tracking-wider">
                              {op.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRotateCodes(op.code)}
                              className="text-slate-500 hover:text-amber-400 ml-1 p-0.5 hover:bg-slate-800 rounded transition-colors"
                              title="Yalnızca bu operatörün şifresini yenile"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{op.name}</span>
                              {isOpDone && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/30">
                                  Tamamlandı
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                              <span>
                                {op.approved} / {op.total} Kesildi
                              </span>
                              <span>•</span>
                              <span className="font-mono text-emerald-400 font-semibold">
                                %{op.progressPercent}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sağ: İlerleme Barı ve Aksiyonlar */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-500"
                              style={{ width: `${op.progressPercent}%` }}
                            />
                          </div>

                          {/* Kopyala */}
                          <button
                            type="button"
                            onClick={() => handleCopy(directLink, `link_${op.code}`)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
                            title="Operatör Linkini Kopyala"
                          >
                            {copiedKey === `link_${op.code}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Kopyalandı</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Linki Kopyala</span>
                              </>
                            )}
                          </button>

                          {/* Aç */}
                          <a
                            href={directLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
                            title="Terminali Yeni Sekmede Aç"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Alt Butonlar */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                >
                  Yeniden Dağıt / Kişi Sayısını Değiştir
                </button>
                <button
                  type="button"
                  onClick={handleCancelBatch}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  İş Paylaşımını Sonlandır
                </button>
              </div>

            </div>
          )}

          {/* DURUM 2: YENİ DAĞITIM FORMU */}
          {(!activeBatch?.active || showForm) && (
            <div className="space-y-4 animate-in fade-in">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">Onay Bekleyen Toplam Fatura</div>
                  <div className="text-2xl font-bold text-white font-mono">{pendingInvoicesCount} Adet</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Kişi Başı Ortalama</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">
                    ~{Math.ceil(pendingInvoicesCount / (operatorCount || 1))} Adet
                  </div>
                </div>
              </div>

              {/* Kaç Kişi Kesecek */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Kaç Kişi Fatura Kesecek?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleOperatorCountChange(num)}
                      className={`py-2.5 rounded-xl font-bold text-sm border transition-all ${
                        operatorCount === num
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30 scale-102'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {num} Kişi
                    </button>
                  ))}
                </div>
              </div>

              {/* Operatör İsimleri */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Operatör İsimleri (İsteğe Bağlı):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {operatorNames.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
                      <span className="text-xs font-mono font-bold text-blue-400">
                        #{101 + idx}:
                      </span>
                      <input
                        type="text"
                        placeholder={`Operatör ${idx + 1}`}
                        value={name}
                        onChange={e => {
                          const val = e.target.value;
                          setOperatorNames(prev => {
                            const updated = [...prev];
                            updated[idx] = val;
                            return updated;
                          });
                        }}
                        className="bg-transparent text-xs text-white outline-none flex-1 font-medium placeholder:text-slate-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bilgilendirme */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Sabit Link: {window.location.origin}/#/kesim</span>
                </div>
                <p className="text-[11px] text-blue-300/80">
                  Her operatöre 101, 102 gibi kısa bir kod atanacaktır. Operatör bu kodla girdiğinde sadece kendi payına düşen faturaları görecek ve tek tıkla carisine işleyebilecektir.
                </p>
              </div>

              {/* Aksiyon Butonları */}
              <div className="pt-2 flex items-center justify-end gap-2">
                {activeBatch?.active && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 text-xs text-slate-400 hover:text-white font-medium transition-colors"
                  >
                    Vazgeç
                  </button>
                )}
                <button
                  type="button"
                  disabled={loading || pendingInvoicesCount === 0}
                  onClick={handleCreateBatch}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Dağıtılıyor...' : 'Faturaları Eşit Dağıt & Kodları Üret'}</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default MultiUserCuttingModal;
