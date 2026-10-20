import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Firm, PreparationItem, TransactionType } from '../types';
import { Calculator, Save, AlertCircle, FilePlus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Preparation = () => {
  const navigate = useNavigate();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [items, setItems] = useState<Record<string, PreparationItem>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = db.getFirms();
    setFirms(f);

    const saved = db.getPreparationItems();
    const initialItems: Record<string, PreparationItem> = {};
    
    f.forEach(firm => {
      const existing = saved.find(s => s.firmId === firm.id);
      initialItems[firm.id] = existing || {
        firmId: firm.id,
        currentEmployeeCount: Number(firm.basePersonLimit),
        extraItemAmount: 0
      };
    });
    setItems(initialItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      db.savePreparationItems(Object.values(items));
    }
  }, [items, loading]);

  const handleUpdate = (firmId: string, field: keyof PreparationItem, value: number) => {
    setItems(prev => ({
      ...prev,
      [firmId]: {
        ...prev[firmId],
        [field]: Number(value)
      }
    }));
  };

  const calculateTotal = (firm: Firm, item: PreparationItem) => {
    // Güvenlik kontrolü: Eğer item yoksa veya boşsa varsayılan değerlerle hesapla
    const safeItem = item || {
      currentEmployeeCount: Number(firm.basePersonLimit),
      extraItemAmount: 0
    };
    
    const baseFee = Number(firm.baseFee);
    const limit = Number(firm.basePersonLimit);
    const currentCount = Number(safeItem.currentEmployeeCount);
    const extraFee = Number(firm.extraPersonFee);
    const extraItem = Number(safeItem.extraItemAmount);

    let price = baseFee;
    
    if (currentCount > limit) {
      const extraPeople = currentCount - limit;
      price += extraPeople * extraFee;
    }
    return price + extraItem;
  };

  const createInvoiceTransaction = (firm: Firm, item: PreparationItem, total: number) => {
    const date = new Date();
    // Güvenlik kontrolü
    const safeItem = item || {
      currentEmployeeCount: Number(firm.basePersonLimit),
      extraItemAmount: 0
    };

    db.addTransaction({
      firmId: firm.id,
      date: date.toISOString(),
      type: TransactionType.INVOICE,
      invoiceType: firm.defaultInvoiceType, // Firmanın varsayılan fatura tipi kullanılıyor
      description: `Hizmet Bedeli - ${date.toLocaleString('tr-TR', { month: 'long' })}`,
      debt: total,
      credit: 0,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      status: 'PENDING', // ÖNEMLİ: Onay bekliyor olarak oluşturuluyor
      calculatedDetails: {
        employeeCount: safeItem.currentEmployeeCount,
        extraItemAmount: safeItem.extraItemAmount,
        expertShare: total * (firm.expertPercentage / 100),
        doctorShare: total * (firm.doctorPercentage / 100)
      }
    });
  };

  const handleInvoiceSingle = (firmId: string) => {
    try {
      const firm = firms.find(f => f.id === firmId);
      const item = items[firmId]; // State'den al
      
      if (!firm) return;

      const total = calculateTotal(firm, item); // item undefined ise içeride handle ediliyor

      if (total <= 0) {
        alert("Toplam tutar 0 TL olduğu için fatura oluşturulamaz.");
        return;
      }

      if (!window.confirm(`${firm.name} firması için ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(total)} tutarında TASLAK fatura oluşturulsun mu?`)) return;

      createInvoiceTransaction(firm, item, total);
      alert(`${firm.name} faturası onay ekranına gönderildi.`);
    } catch (error) {
      console.error(error);
      alert("Hata oluştu.");
    }
  };

  const handleInvoiceAll = () => {
    // Tümünü faturalaştır mantığı
    if (firms.length === 0) {
      alert("Kayıtlı firma bulunamadı.");
      return;
    }

    const confirmMessage = "Tüm firmalar için hesaplanan tutarlar 'Kesilecek Faturalar' ekranına TASLAK olarak aktarılacak.\n\nDevam edilsin mi?";
    if (!window.confirm(confirmMessage)) return;

    let count = 0;
    
    firms.forEach(firm => {
      try {
        // State'de veri yoksa bile varsayılan bir obje oluştur
        const item = items[firm.id] || {
           firmId: firm.id,
           currentEmployeeCount: Number(firm.basePersonLimit),
           extraItemAmount: 0
        };

        const total = calculateTotal(firm, item);
        if (total > 0) {
          createInvoiceTransaction(firm, item, total);
          count++;
        }
      } catch (e) {
        console.error("Fatura döngü hatası:", e);
      }
    });

    if (count > 0) {
      alert(`${count} adet fatura taslağı oluşturuldu. Lütfen 'Kesilecek Faturalar' sayfasından onaylayınız.`);
      navigate('/invoices');
    } else {
      alert("Oluşturulacak uygun tutarlı fatura bulunamadı.");
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-yellow-500" />
            Fatura Hazırlık
          </h2>
          <p className="text-slate-400 mt-2">Çalışan sayılarını girin, hesaplayın ve onay ekranına gönderin.</p>
        </div>
        <button 
          onClick={handleInvoiceAll}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
        >
          <Save className="w-5 h-5" />
          Tümünü Faturalaştır
        </button>
      </header>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700">
                <th className="p-4 text-slate-400 font-medium">Firma Adı</th>
                <th className="p-4 text-slate-400 font-medium w-40">Mevcut Çalışan</th>
                <th className="p-4 text-slate-400 font-medium w-40">Ekstra Kalem (TL)</th>
                <th className="p-4 text-slate-400 font-medium w-40 text-right">Hesaplanan</th>
                <th className="p-4 text-slate-400 font-medium w-24 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {firms.map(firm => {
                const item = items[firm.id];
                // Item yüklenene kadar veya yoksa varsayılan göster
                const currentCount = item ? item.currentEmployeeCount : firm.basePersonLimit;
                const extraAmount = item ? item.extraItemAmount : 0;
                
                // Calculate total using safe logic (pass item or undefined, logic handles it)
                const total = calculateTotal(firm, item);
                const isOverLimit = currentCount > firm.basePersonLimit;

                return (
                  <tr key={firm.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{firm.name}</div>
                      <div className="text-xs text-slate-500">
                         Limit: {firm.basePersonLimit} • Taban: {formatCurrency(firm.baseFee)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          value={currentCount}
                          onChange={(e) => handleUpdate(firm.id, 'currentEmployeeCount', Number(e.target.value))}
                          className={`w-full bg-slate-900 border ${isOverLimit ? 'border-yellow-500/50 text-yellow-500' : 'border-slate-600'} rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
                        />
                        {isOverLimit && (
                          <span title="Limit Aşıldı">
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        min="0"
                        value={extraAmount}
                        onChange={(e) => handleUpdate(firm.id, 'extraItemAmount', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-lg font-bold text-blue-400">
                        {formatCurrency(total)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleInvoiceSingle(firm.id)}
                        title="Taslak Oluştur"
                        className="p-2 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {firms.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Henüz kayıtlı firma yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Preparation;