import React, { useState } from 'react';
import { db } from '../services/db';
import { Save, Building2, CheckCircle2 } from 'lucide-react';
import { InvoiceType } from '../types';

const FirmRegistration = () => {
  const initialFormState = {
    name: '',
    basePersonLimit: 10,
    baseFee: 1000,
    extraPersonFee: 50,
    expertPercentage: 60,
    doctorPercentage: 40,
    defaultInvoiceType: InvoiceType.E_FATURA
  };

  const [formData, setFormData] = useState(initialFormState);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'name' || name === 'defaultInvoiceType') ? value : Number(value)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    db.addFirm(formData);
    
    // Yönlendirme yerine bildirim göster ve formu temizle
    setSuccessMessage(`${formData.name} başarıyla kaydedildi.`);
    setFormData(initialFormState);

    // Mesajı 3 saniye sonra kaldır
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-right-4 duration-500">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-500" />
          Firma Kayıt & Parametreler
        </h2>
        <p className="text-slate-400 mt-2">Yeni firma ekleyin ve faturalandırma kurallarını tanımlayın.</p>
      </header>

      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-lg flex items-center gap-3 text-emerald-400 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Firma Bilgileri */}
          <div className="col-span-2">
            <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-700 pb-2">Genel Bilgiler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Firma Adı</label>
                <input 
                  required
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Örn: ABC İnşaat Ltd. Şti."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fatura Tipi</label>
                <select
                  name="defaultInvoiceType"
                  value={formData.defaultInvoiceType}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={InvoiceType.E_FATURA}>E-Fatura</option>
                  <option value={InvoiceType.E_ARSIV}>E-Arşiv</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Bu firma için varsayılan olarak seçilecek fatura tipi.</p>
              </div>
            </div>
          </div>

          <div className="col-span-2 border-t border-slate-700 my-2"></div>

          {/* Fiyatlandırma Kuralları */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-400">Fiyatlandırma Kuralı</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Taban Kişi Limiti</label>
              <input 
                type="number" 
                name="basePersonLimit"
                min="0"
                value={formData.basePersonLimit}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Taban Fiyat (TL)</label>
              <input 
                type="number" 
                name="baseFee"
                min="0"
                value={formData.baseFee}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Ekstra Kişi Başı Ücret (TL)</label>
              <input 
                type="number" 
                name="extraPersonFee"
                min="0"
                value={formData.extraPersonFee}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Taban limit aşıldığında kişi başına eklenecek tutar.</p>
            </div>
          </div>

          {/* Hakediş Dağılımı */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-purple-400">Hakediş Dağılımı</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Uzman Payı (%)</label>
              <input 
                type="number" 
                name="expertPercentage"
                min="0"
                max="100"
                value={formData.expertPercentage}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Doktor Payı (%)</label>
              <input 
                type="number" 
                name="doctorPercentage"
                min="0"
                max="100"
                value={formData.doctorPercentage}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Toplam: {formData.expertPercentage + formData.doctorPercentage}%</p>
            </div>
          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end">
          <button 
            type="submit" 
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-blue-600/30"
          >
            <Save className="w-5 h-5" />
            Firmayı Kaydet
          </button>
        </div>
      </form>
    </div>
  );
};

export default FirmRegistration;