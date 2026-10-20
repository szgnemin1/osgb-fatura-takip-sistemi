import React, { useState, useEffect, useMemo } from 'react';
import {
  GitCompare,
  Search,
  CheckCircle,
  AlertCircle,
  Save,
  RotateCcw,
  Building2,
  Stethoscope,
  XCircle,
  Sparkles
} from 'lucide-react';
import { Firm } from '../types';

interface TetkikCompany {
  id?: string;
  name: string;
  hazardClass?: string;
  doctor?: string;
  specialist?: string;
  totalReferrals: number;
  totalAmount: number;
  unbilledReferrals: number;
  unbilledAmount: number;
  matchedFirmId: string;
}

export const TetkikMapping: React.FC = () => {
  const [tetkikCompanies, setTetkikCompanies] = useState<TetkikCompany[]>([]);
  const [faturaFirms, setFaturaFirms] = useState<Firm[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtreler
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNMATCHED' | 'MATCHED' | 'WITH_SEVK'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Verileri Sunucudan Yükle
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/tetkik/companies', {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      if (!res.ok) {
        throw new Error('Tetkik firmaları yüklenemedi');
      }
      const data = await res.json();
      setTetkikCompanies(data.tetkikCompanies || []);
      setFaturaFirms(data.faturaFirms || []);

      // İlk harita eşleşmelerini state'e al
      const initialMap: Record<string, string> = {};
      (data.tetkikCompanies || []).forEach((c: TetkikCompany) => {
        initialMap[c.name] = c.matchedFirmId || '';
      });
      setMappings(initialMap);
    } catch (e: any) {
      setError(e.message || 'Veri yükleme hatası');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fatura firmaları arama haritası
  const firmMap = useMemo(() => {
    const map = new Map<string, Firm>();
    faturaFirms.forEach(f => map.set(f.id, f));
    return map;
  }, [faturaFirms]);

  // Eşleme Değişikliği
  const handleMappingChange = (tetkikName: string, targetFirmId: string) => {
    setMappings(prev => ({
      ...prev,
      [tetkikName]: targetFirmId
    }));
  };

  // İstatistikler
  const stats = useMemo(() => {
    let total = tetkikCompanies.length;
    let matched = 0;
    let unmatched = 0;
    let totalUnbilled = 0;

    tetkikCompanies.forEach(c => {
      const mapped = mappings[c.name];
      if (mapped && mapped !== 'IGNORE') {
        matched++;
      } else {
        unmatched++;
      }
      totalUnbilled += c.unbilledAmount || 0;
    });

    return { total, matched, unmatched, totalUnbilled };
  }, [tetkikCompanies, mappings]);

  // Filtrelenmiş Liste
  const filteredCompanies = useMemo(() => {
    return tetkikCompanies.filter(c => {
      const currentMap = mappings[c.name] || '';
      const isMatched = currentMap && currentMap !== 'IGNORE';

      // Tab filtreleri
      if (activeTab === 'UNMATCHED' && isMatched) return false;
      if (activeTab === 'MATCHED' && !isMatched) return false;
      if (activeTab === 'WITH_SEVK' && (c.unbilledReferrals === 0 && c.totalReferrals === 0)) return false;

      // Arama filtresi
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(q);
      const targetFirm = currentMap && currentMap !== 'IGNORE' && currentMap !== 'NEW' ? firmMap.get(currentMap) : null;
      const targetMatch = targetFirm ? targetFirm.name.toLowerCase().includes(q) : false;

      return nameMatch || targetMatch;
    });
  }, [tetkikCompanies, mappings, activeTab, search, firmMap]);

  // Sayfalama
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage) || 1;
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCompanies.slice(start, start + itemsPerPage);
  }, [filteredCompanies, currentPage]);

  // Değişiklikleri Kaydet
  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');

      // 1. Eğer 'NEW' olarak işaretlenen firma varsa önce yeni firma olarak oluştur
      for (const [tetkikName, target] of Object.entries(mappings)) {
        if (target === 'NEW') {
          const comp = tetkikCompanies.find(c => c.name === tetkikName);
          const createRes = await fetch('/api/tetkik/create-firm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
              tetkikName,
              hazardClass: comp?.hazardClass
            })
          });
          if (createRes.ok) {
            const json = await createRes.json();
            if (json.firm && json.firm.id) {
              mappings[tetkikName] = json.firm.id;
            }
          }
        }
      }

      // 2. Tüm eşleştirmeleri topluca sunucuya kaydet
      const payload = Object.entries(mappings).map(([tetkikName, targetFirmId]) => ({
        tetkikName,
        targetFirmId
      }));

      const res = await fetch('/api/tetkik/save-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ mappings: payload })
      });

      if (!res.ok) {
        throw new Error('Eşleştirmeler kaydedilirken sunucu hatası oluştu');
      }

      const resJson = await res.json();
      setSuccessMsg(`Tüm eşleştirmeler başarıyla kaydedildi! (${resJson.updatedCount || 0} adet sevk faturaya bağlandı)`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Kayıt sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ₺';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12 animate-in fade-in">
      {/* ÜST BAŞLIK VE AKSİYONLAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>Tetkik Firma Eşleştirme</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Tetkik takip sistemindeki firmaları Fatura Takip carileri ile eşleştirin. Otomatik tahmin yapılmaz; sadece belirlediğiniz eşleşmeler faturaya yansır.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
            title="Verileri Yenile"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Kaydediliyor...' : 'Eşleştirmeleri Kaydet'}</span>
          </button>
        </div>
      </div>

      {/* BİLDİRİMLER */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI ÖZET KARTLARI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-400 block">Toplam Tetkik Firması</span>
            <span className="text-lg font-bold font-mono text-slate-100">{stats.total}</span>
          </div>
          <Building2 className="w-5 h-5 text-slate-600" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-emerald-400 block">Eşleşen Firmalar</span>
            <span className="text-lg font-bold font-mono text-emerald-300">{stats.matched}</span>
          </div>
          <CheckCircle className="w-5 h-5 text-emerald-500/40" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-amber-400 block">Eşleşme Bekleyenler</span>
            <span className="text-lg font-bold font-mono text-amber-300">{stats.unmatched}</span>
          </div>
          <AlertCircle className="w-5 h-5 text-amber-500/40" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-blue-400 block">Bekleyen Sevk Tutarı</span>
            <span className="text-sm font-bold font-mono text-blue-300">{formatCurrency(stats.totalUnbilled)}</span>
          </div>
          <Stethoscope className="w-5 h-5 text-blue-500/40" />
        </div>
      </div>

      {/* ARAMA VE SEKMELER */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-sm">
        {/* Arama */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tetkik veya Fatura firma adı ara..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tab Filtreleri */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tümü ({tetkikCompanies.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('UNMATCHED');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'UNMATCHED' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Eşleşmeyenler ({stats.unmatched})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('MATCHED');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'MATCHED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Eşleşenler ({stats.matched})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('WITH_SEVK');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'WITH_SEVK' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sevk Kaydı Olanlar
          </button>
        </div>
      </div>

      {/* EŞLEŞTİRME TABLOSU (FirmRegistration.tsx İle Birebir Format) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="p-3 w-1/2">Tetkik Sistemindeki Firma (Gelen Veri)</th>
                <th className="p-3 w-1/2">Fatura Takip Eşleşmesi (Hedef Cari)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedCompanies.map(row => {
                const currentVal = mappings[row.name] || '';
                const isMatched = currentVal && currentVal !== 'IGNORE' && currentVal !== 'NEW';
                const matchedFirmObj = isMatched ? firmMap.get(currentVal) : null;

                return (
                  <tr
                    key={row.name}
                    className={`transition-colors ${
                      isMatched
                        ? 'bg-blue-950/10 hover:bg-slate-800/40'
                        : currentVal === 'IGNORE'
                        ? 'bg-slate-950/40 opacity-75'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Sol Sütun: Tetkik Firması Bilgisi */}
                    <td className="p-3 align-middle">
                      <div className="font-semibold text-slate-100 text-sm select-text">
                        {row.name}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {row.unbilledReferrals > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                            <Stethoscope className="w-3 h-3" />
                            <span>{row.unbilledReferrals} Sevk ({formatCurrency(row.unbilledAmount)})</span>
                          </span>
                        ) : row.totalReferrals > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono">
                            <span>Geçmiş {row.totalReferrals} Sevk</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Sevk kaydı yok</span>
                        )}

                        {row.hazardClass && row.hazardClass !== '-' && (
                          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded text-[10px]">
                            {row.hazardClass}
                          </span>
                        )}

                        {row.doctor && row.doctor !== '-' && (
                          <span className="bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                            Hekim: {row.doctor}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sağ Sütun: Fatura Takip Hedef Firma Seçimi */}
                    <td className="p-3 align-middle">
                      <div className="flex flex-col gap-1">
                        <select
                          value={currentVal}
                          onChange={e => handleMappingChange(row.name, e.target.value)}
                          className={`w-full p-2.5 rounded-lg text-xs outline-none border transition-colors ${
                            currentVal === 'NEW'
                              ? 'bg-emerald-900/40 border-emerald-500 text-emerald-100 font-semibold'
                              : currentVal === 'IGNORE'
                              ? 'bg-slate-950 border-slate-700 text-slate-400'
                              : isMatched
                              ? 'bg-blue-900/40 border-blue-500 text-blue-100 font-semibold'
                              : 'bg-slate-950 border-amber-500/60 text-amber-200 ring-1 ring-amber-500/30'
                          }`}
                        >
                          <option value="" className="bg-slate-900 text-amber-300 font-semibold">
                            ⚠️ Eşleşme Bekliyor (Lütfen Seçin...)
                          </option>
                          <option value="IGNORE" className="bg-slate-900 text-slate-400">
                            ❌ Bu Firmayı Atla (Faturalandırma Yapma)
                          </option>
                          <option value="NEW" className="bg-slate-900 text-emerald-300 font-bold">
                            ✨ BU İSİMLE YENİ FİRMA OLARAK EKLE
                          </option>
                          <optgroup label="Mevcut Fatura Takip Carileri" className="bg-slate-900 text-slate-300">
                            {faturaFirms.map(f => (
                              <option key={f.id} value={f.id} className="bg-slate-800 text-white">
                                {f.name} {f.taxNumber ? `(VKN: ${f.taxNumber})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        </select>

                        {/* Durum Bilgisi */}
                        <div className="flex items-center gap-1.5 text-[10px] pl-0.5">
                          {isMatched && matchedFirmObj ? (
                            <span className="text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle className="w-3 h-3" />
                              <span>Eşleşti: <b>{matchedFirmObj.name}</b></span>
                            </span>
                          ) : currentVal === 'NEW' ? (
                            <span className="text-emerald-300 flex items-center gap-1 font-medium">
                              <Sparkles className="w-3 h-3" />
                              <span>Kaydet butonuna basıldığında yeni cari açılacak</span>
                            </span>
                          ) : currentVal === 'IGNORE' ? (
                            <span className="text-slate-500 italic">
                              Bu firmaya ait tetkik sevkleri faturalandırma hazırlığına eklenmeyecek
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Eşleşme seçilmedi</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedCompanies.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-slate-500">
                    Arama kriterine uygun Tetkik firması bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* SAYFALAMA */}
        {filteredCompanies.length > itemsPerPage && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Toplam {filteredCompanies.length} kayıt • Sayfa {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Önceki
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TetkikMapping;
