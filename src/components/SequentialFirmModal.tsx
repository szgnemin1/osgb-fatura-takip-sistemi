import React, { useState, useEffect } from 'react';
import { Firm, InvoiceType, PricingModel, ServiceType, GlobalSettings } from '../types';
import { db } from '../services/db';
import { 
  Building2, Hash, Layers, ShieldAlert, Users, DollarSign, 
  Percent, FileText, Folder, CheckCircle, ArrowRight, X, Phone, Mail, MapPin
} from 'lucide-react';

export interface UnmatchedQueueItem {
  index: number;
  name: string;
  sgk: string;
  danger: string;
  count: number;
  cleanSgk?: string;
}

interface SequentialFirmModalProps {
  isOpen: boolean;
  queue: UnmatchedQueueItem[];
  currentIndex: number;
  firmGroups: string[];
  defaultGroup?: string;
  globalSettings: GlobalSettings | null;
  onSaveCurrent: (createdFirm: Firm, employeeCount: number) => void;
  onSkipCurrent: () => void;
  onClose: () => void;
}

export const SequentialFirmModal: React.FC<SequentialFirmModalProps> = ({
  isOpen,
  queue,
  currentIndex,
  firmGroups,
  defaultGroup,
  globalSettings,
  onSaveCurrent,
  onSkipCurrent,
  onClose
}) => {
  const currentItem = queue[currentIndex];

  const [formData, setFormData] = useState<Omit<Firm, 'id'>>({
    name: '',
    sgkNumber: '',
    dangerClass: 'Tehlikeli',
    basePersonLimit: 10,
    baseFee: 1000,
    extraPersonFee: 50,
    expertPercentage: 60,
    doctorPercentage: 40,
    defaultInvoiceType: InvoiceType.E_FATURA,
    pricingModel: PricingModel.STANDARD,
    serviceType: ServiceType.BOTH,
    group: '',
    taxNumber: '',
    phone: '',
    email: '',
    contactPerson: '',
    address: '',
    isKdvExcluded: false,
    yearlyFee: 0,
    tolerancePercentage: 10,
    tiers: []
  });

  // Sıradaki firma değiştikçe formu otomatik doldur
  useEffect(() => {
    if (currentItem) {
      setFormData({
        name: currentItem.name || '',
        sgkNumber: currentItem.sgk || '',
        dangerClass: currentItem.danger || 'Tehlikeli',
        basePersonLimit: currentItem.count > 0 ? currentItem.count : 10,
        baseFee: 1000,
        extraPersonFee: 50,
        expertPercentage: globalSettings?.expertPercentage ?? 60,
        doctorPercentage: globalSettings?.doctorPercentage ?? 40,
        defaultInvoiceType: InvoiceType.E_FATURA,
        pricingModel: PricingModel.STANDARD,
        serviceType: ServiceType.BOTH,
        group: defaultGroup && defaultGroup !== 'ALL' && defaultGroup !== 'UNGROUPED' ? defaultGroup : (firmGroups[0] || ''),
        taxNumber: '',
        phone: '',
        email: '',
        contactPerson: '',
        address: '',
        isKdvExcluded: false,
        yearlyFee: 0,
        tolerancePercentage: 10,
        tiers: []
      });
    }
  }, [currentIndex, currentItem, defaultGroup, firmGroups, globalSettings]);

  if (!isOpen || !currentItem) return null;

  const totalInQueue = queue.length;
  const progressPercent = Math.round(((currentIndex + 1) / totalInQueue) * 100);
  const isLast = currentIndex + 1 >= totalInQueue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
      return;
    }
    const numericFields = ['basePersonLimit', 'baseFee', 'extraPersonFee', 'expertPercentage', 'doctorPercentage', 'yearlyFee'];
    const isNum = type === 'number' || numericFields.includes(name);
    setFormData(prev => ({
      ...prev,
      [name]: isNum ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Lütfen firma unvanını giriniz.");
      return;
    }

    try {
      const created = db.addFirm(formData);
      onSaveCurrent(created, currentItem.count);
    } catch (err: any) {
      alert("Firma kaydedilirken hata oluştu: " + (err.message || err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* ÜST BAŞLIK VE İLERLEME ÇUBUĞU */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 font-mono text-xs font-bold">
                  Sıra: {currentIndex + 1} / {totalInQueue}
                </span>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  <span>Yeni Firma Kaydı</span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Excel'den gelen yeni SGK sicil kaydı için firma bilgilerini onaylayın veya düzenleyin.
              </p>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              title="Kapat ve Fatura Hazırlığa Dön"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* İlerleme Çubuğu */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* FORM GÖVDESİ */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* 1. KART: TEMEL KİMLİK & SGK */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>1. Firma Tanımı ve SGK Bilgileri</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Firma / Şirket Unvanı <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                  placeholder="Firma tam unvanı..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>SGK İşyeri Sicil Numarası</span>
                </label>
                <input 
                  type="text" 
                  name="sgkNumber" 
                  value={formData.sgkNumber || ''} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-blue-500/40 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 outline-none" 
                  placeholder="26 haneli sicil no..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tehlike Sınıfı</span>
                </label>
                <select 
                  name="dangerClass" 
                  value={formData.dangerClass || 'Tehlikeli'} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                >
                  <option value="Az Tehlikeli">Az Tehlikeli</option>
                  <option value="Tehlikeli">Tehlikeli</option>
                  <option value="Çok Tehlikeli">Çok Tehlikeli</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>Vergi No / TCKN</span>
                </label>
                <input 
                  type="text" 
                  name="taxNumber" 
                  value={formData.taxNumber || ''} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                  placeholder="10 veya 11 haneli..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>Firma Grubu</span>
                </label>
                <select 
                  name="group" 
                  value={formData.group || ''} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                >
                  <option value="">-- Grupsuz --</option>
                  {firmGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. KART: SÖZLEŞME VE ÜCRET PARAMETRELERİ */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>2. Fatura ve Hizmet Ücreti Parametreleri</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Personel Kotası</span>
                </label>
                <input 
                  type="number" 
                  name="basePersonLimit" 
                  min="0"
                  value={formData.basePersonLimit} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sözleşme Taban Ücreti (TL)
                </label>
                <input 
                  type="number" 
                  name="baseFee" 
                  min="0"
                  value={formData.baseFee} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ekstra Kişi Başı (TL)
                </label>
                <input 
                  type="number" 
                  name="extraPersonFee" 
                  min="0"
                  value={formData.extraPersonFee} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Fatura Tipi</span>
                </label>
                <select 
                  name="defaultInvoiceType" 
                  value={formData.defaultInvoiceType} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                >
                  <option value={InvoiceType.E_FATURA}>E-Fatura</option>
                  <option value={InvoiceType.E_ARSIV}>E-Arşiv</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hizmet Kapsamı
                </label>
                <select 
                  name="serviceType" 
                  value={formData.serviceType || ServiceType.BOTH} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                >
                  <option value={ServiceType.BOTH}>İş Güvenliği + Hekimlik</option>
                  <option value={ServiceType.EXPERT_ONLY}>Sadece İş Güvenliği Uzmanı</option>
                  <option value={ServiceType.DOCTOR_ONLY}>Sadece İşyeri Hekimi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-purple-400" />
                  <span>Uzman Payı (%)</span>
                </label>
                <input 
                  type="number" 
                  name="expertPercentage" 
                  min="0"
                  max="100"
                  value={formData.expertPercentage} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-purple-400" />
                  <span>Hekim Payı (%)</span>
                </label>
                <input 
                  type="number" 
                  name="doctorPercentage" 
                  min="0"
                  max="100"
                  value={formData.doctorPercentage} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input 
                  type="checkbox" 
                  id="seqIsKdvExcluded" 
                  name="isKdvExcluded" 
                  checked={formData.isKdvExcluded || false} 
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="seqIsKdvExcluded" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  KDV Hariç (Fiyatlara KDV ekle)
                </label>
              </div>
            </div>
          </div>

          {/* 3. KART: İLETİŞİM BİLGİLERİ (İSTEĞE BAĞLI) */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>3. İletişim & Adres (İsteğe Bağlı)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Telefon</span>
                </label>
                <input 
                  type="text" 
                  name="phone" 
                  value={formData.phone || ''} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                  placeholder="05..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>E-Posta</span>
                </label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email || ''} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                  placeholder="muhasebe@..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Adres</span>
                </label>
                <input 
                  type="text" 
                  name="address" 
                  value={formData.address || ''} 
                  onChange={handleChange} 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                  placeholder="İlçe / İl"
                />
              </div>
            </div>
          </div>

          {/* DÜĞMELER / BUTONLAR */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 rounded-b-xl">
            <button
              type="button"
              onClick={onSkipCurrent}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Bu Firmayı Atla ({isLast ? 'Bitir' : 'Sıradakine Geç'})
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isLast ? 'Kaydet ve Tamamla' : 'Kaydet ve Sıradakine Geç'}</span>
                {!isLast && <ArrowRight className="w-4 h-4 ml-1" />}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
