import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  Sparkles,
  Calendar,
  ArrowRight,
  RefreshCw,
  Clock
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

const getInitialDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  };
};

export const TetkikMapping: React.FC = () => {
  const initial = useMemo(() => getInitialDates(), []);
  const [startDate, setStartDate] = useState<string>(initial.startDate);
  const [endDate, setEndDate] = useState<string>(initial.endDate);

  const [tetkikCompanies, setTetkikCompanies] = useState<TetkikCompany[]>([]);
  const [faturaFirms, setFaturaFirms] = useState<Firm[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtreler
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNMATCHED' | 'MATCHED' | 'WITH_SEVK'>('WITH_SEVK');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Verileri Sunucudan Yükle (Tarih Filtresi İle)
  const loadData = async (overrideStart = startDate, overrideEnd = endDate) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (overrideStart) params.append('startDate', overrideStart);
      if (overrideEnd) params.append('endDate', overrideEnd);

      const res = await fetch(`/api/tetkik/companies?${params.toString()}`, {
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

  // Hızlı Tarih Seçimleri
  const handleQuickPreset = (preset: 'CURRENT_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'ALL') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let s = '';
    let e = '';

    if (preset === 'CURRENT_MONTH') {
      const mStr = String(month + 1).padStart(2, '0');
      const lastDay = new Date(year, month + 1, 0).getDate();
      s = `${year}-${mStr}-01`;
      e = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'LAST_MONTH') {
      const prevDate = new Date(year, month - 1, 1);
      const prevYear = prevDate.getFullYear();
      const prevMonth = prevDate.getMonth();
      const mStr = String(prevMonth + 1).padStart(2, '0');
      const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
      s = `${prevYear}-${mStr}-01`;
      e = `${prevYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'LAST_30_DAYS') {
      const prior = new Date();
      prior.setDate(prior.getDate() - 30);
      s = prior.toISOString().split('T')[0];
      e = now.toISOString().split('T')[0];
    } else if (preset === 'ALL') {
      s = '';
      e = '';
    }

    setStartDate(s);
    setEndDate(e);
    setCurrentPage(1);
    loadData(s, e);
  };

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

  // İstatistikler (Seçili Dönem İçin)
  const stats = useMemo(() => {
    let total = tetkikCompanies.length;
    let matched = 0;
    let unmatched = 0;
    let totalUnbilled = 0;
    let totalReferralsCount = 0;

    tetkikCompanies.forEach(c => {
      const mapped = mappings[c.name];
      if (mapped && mapped !== 'IGNORE') {
        matched++;
      } else {
        unmatched++;
      }
      totalUnbilled += c.unbilledAmount || 0;
      totalReferralsCount += c.unbilledReferrals || 0;
    });

    return { total, matched, unmatched, totalUnbilled, totalReferralsCount };
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

  // Seçilen Tarih Aralığındaki Sevkleri Faturaya Aktar
  const handleSyncPeriod = async () => {
    const dateRangeLabel = startDate && endDate 
      ? `${startDate} ile ${endDate} arasındaki`
      : startDate 
      ? `${startDate} tarihinden sonraki`
      : 'Tüm zamanlardaki';

    if (!window.confirm(
      `${dateRangeLabel} faturalı sevkler çekilecek ve eski aylara ait faturalandırılmamış kayıtlar temizlenecektir.\n\nİşlemi onaylıyor musunuz?`
    )) {
      return;
    }

    setSyncing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/tetkik/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
          purgeOtherUnbilled: true
        })
      });

      if (!res.ok) {
        throw new Error('Sevkler aktarılırken sunucu hatası oluştu');
      }

      const resJson = await res.json();
      setSuccessMsg(`✅ Başarılı! ${resJson.syncedCount || 0} adet sevk Fatura Hazırlık sistemine aktarıldı. (Eski aylardan kalan sevkler temizlendi)`);
      setTimeout(() => setSuccessMsg(null), 5000);
      await loadData(startDate, endDate);
    } catch (e: any) {
      setError(e.message || 'Sevk aktarımı sırasında hata oluştu');
    } finally {
      setSyncing(false);
    }
  };

  // Eşleştirmeleri Kaydet ve Dönemi Faturaya Bağla
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

      // 3. Seçili tarih aralığını senkronize et
      await fetch('/api/tetkik/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
          purgeOtherUnbilled: true
        })
      });

      await res.json();
      setSuccessMsg(`Tüm eşleştirmeler kaydedildi ve seçilen döneme ait sevkler ilgili carilere başarıyla bağlandı!`);
      setTimeout(() => setSuccessMsg(null), 5000);
      await loadData(startDate, endDate);
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
      {/* ÜST BAŞLIK VE HIZLI GEÇİŞ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>Tetkik / Sevk Çekme & Cari Eşleştirme</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Sevkleri istediğiniz tarih aralığına göre kontrollü çekin; eski aylardan gelen gereksiz kayıtları filtreleyip Fatura Takip carileri ile eşleştirin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/prepare"
            className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Fatura Hazırlık Ekranına Git"
          >
            <span>Fatura Hazırlık'a Git</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || syncing}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Kaydediliyor...' : 'Eşleştirmeleri Kaydet & Aktar'}</span>
          </button>
        </div>
      </div>

      {/* TARİH ARALIĞI SEÇİM PANELİ (YARI MANUEL DÖNEM BELİRLEME) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Sol: Tarih Inputları */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-slate-400 font-medium">Başlangıç:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-slate-400 font-medium">Bitiş:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                loadData(startDate, endDate);
              }}
              disabled={loading}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-1.5 border border-slate-600 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sevkleri Listele</span>
            </button>
          </div>

          {/* Sağ: Aktarma Butonu */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncPeriod}
              disabled={syncing || loading}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50"
              title="Eski ayları temizler ve sadece seçili tarih aralığındaki sevkleri faturaya dahil eder"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sevkler Aktarılıyor...' : 'Bu Dönemdeki Sevkleri Faturaya Aktar'}</span>
            </button>
          </div>
        </div>

        {/* Hızlı Seçim Butonları */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
          <span className="text-slate-400 mr-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Hızlı Aralık:
          </span>
          <button
            type="button"
            onClick={() => handleQuickPreset('CURRENT_MONTH')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 rounded-lg transition-colors font-medium"
          >
            Bu Ay (Cari Ay)
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('LAST_MONTH')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 rounded-lg transition-colors font-medium"
          >
            Geçen Ay
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('LAST_30_DAYS')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 rounded-lg transition-colors font-medium"
          >
            Son 30 Gün
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('ALL')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors font-medium"
          >
            Tüm Zamanlar
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
            <span className="text-[11px] text-slate-400 block">Dönem Sevk Sayısı</span>
            <span className="text-lg font-bold font-mono text-slate-100">{stats.totalReferralsCount} Adet</span>
          </div>
          <Stethoscope className="w-5 h-5 text-blue-500/50" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-blue-400 block">Dönem Sevk Tutarı</span>
            <span className="text-sm font-bold font-mono text-blue-300">{formatCurrency(stats.totalUnbilled)}</span>
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
              setActiveTab('WITH_SEVK');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'WITH_SEVK' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dönemde Sevki Olanlar
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
              setActiveTab('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tüm Firmalar ({tetkikCompanies.length})
          </button>
        </div>
      </div>

      {/* EŞLEŞTİRME TABLOSU */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="p-3 w-1/2">Tetkik Sistemindeki Firma (Sevk Dönemi Verisi)</th>
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
                            <span>Bu Dönemde {row.unbilledReferrals} Sevk ({formatCurrency(row.unbilledAmount)})</span>
                          </span>
                        ) : row.totalReferrals > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono">
                            <span>{row.totalReferrals} Sevk</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Bu aralıkta sevk yok</span>
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
                            ❌ Bu Firmayı Atla (Faturaya Ekleme)
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
                              Bu firmaya ait sevkler faturaya dahil edilmeyecek (Atlandı)
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
                    Seçilen kriterlere ve tarih aralığına uygun Tetkik firması bulunamadı.
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
              Toplam {filteredCompanies.length} firma • Sayfa {currentPage} / {totalPages}
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
