
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Save, Building2, CheckCircle2, Trash2, Edit, Plus, X, Network, Stethoscope, CheckSquare, Square, Search, FileText, Upload } from 'lucide-react';
import { InvoiceType, Firm, PricingModel, PricingTier, ServiceType } from '../types';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

const FirmRegistration = () => {
  const initialFormState: Omit<Firm, 'id'> = {
    name: '',
    parentFirmId: '',
    basePersonLimit: 10,
    baseFee: 1000,
    extraPersonFee: 50,
    expertPercentage: 60,
    doctorPercentage: 40,
    defaultInvoiceType: InvoiceType.E_FATURA,
    taxNumber: '',
    phone: '',
    email: '',
    contactPerson: '',
    address: '',
    yearlyFee: 0,
    pricingModel: PricingModel.STANDARD,
    tolerancePercentage: 10,
    tiers: [],
    serviceType: ServiceType.BOTH,
    isKdvExcluded: false, // Varsayılan KDV Dahil
    // İkincil Model Varsayılanları
    hasSecondaryModel: false,
    secondaryPricingModel: PricingModel.STANDARD,
    secondaryBaseFee: 0,
    secondaryBasePersonLimit: 0,
    secondaryExtraPersonFee: 0,
    secondaryTiers: []
  };

  const [formData, setFormData] = useState<Firm | Omit<Firm, 'id'>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [existingFirms, setExistingFirms] = useState<Firm[]>([]);
  const [selectedFirms, setSelectedFirms] = useState<string[]>([]);
  
  // Arama State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Excel Eşleşme State'i
  const [mappingData, setMappingData] = useState<any[] | null>(null);
  const [mappingPage, setMappingPage] = useState(1);
  const mappingItemsPerPage = 50;
  
  // Tier state helpers
  const [newTier, setNewTier] = useState<PricingTier>({ min: 0, max: 0, price: 0 });
  const [newSecTier, setNewSecTier] = useState<PricingTier>({ min: 0, max: 0, price: 0 });

  const [newSgkInput, setNewSgkInput] = useState('');

  const handleAddSgk = () => {
      if(!newSgkInput.trim()) return;
      const currentSgks = formData.sgkNumber ? formData.sgkNumber.split(',').map(s => s.trim()).filter(Boolean) : [];
      if(!currentSgks.includes(newSgkInput.trim())) {
          currentSgks.push(newSgkInput.trim());
          setFormData({ ...formData, sgkNumber: currentSgks.join(', ') });
      }
      setNewSgkInput('');
  };

  const handleRemoveSgk = (sgkToRemove: string) => {
      const currentSgks = formData.sgkNumber ? formData.sgkNumber.split(',').map(s => s.trim()).filter(Boolean) : [];
      const newSgks = currentSgks.filter(s => s !== sgkToRemove);
      setFormData({ ...formData, sgkNumber: newSgks.join(', ') });
  };

  const loadFirms = () => {
    setExistingFirms(db.getFirms());
    setSelectedFirms([]);
  };

  useEffect(() => {
    loadFirms();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Checkbox kontrolü
    if (type === 'checkbox') {
        setFormData(prev => ({
            ...prev,
            [name]: (e.target as HTMLInputElement).checked
        }));
        return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: (name === 'name' || name === 'defaultInvoiceType' || name === 'pricingModel' || name === 'secondaryPricingModel' || name === 'taxNumber' || name === 'address' || name === 'parentFirmId' || name === 'serviceType') ? value : Number(value)
    }));
  };

  // --- Tier Yönetimi (Ana Model) ---
  const handleAddTier = () => {
    if (newTier.max <= newTier.min) return alert("Maksimum değer minimumdan büyük olmalı.");
    setFormData(prev => ({
      ...prev,
      tiers: [...(prev.tiers || []), newTier]
    }));
    setNewTier({ min: newTier.max + 1, max: newTier.max + 11, price: 0 });
  };
  const removeTier = (index: number) => {
    setFormData(prev => ({ ...prev, tiers: prev.tiers?.filter((_, i) => i !== index) }));
  };

  // --- Tier Yönetimi (İkincil Model) ---
  const handleAddSecTier = () => {
    if (newSecTier.max <= newSecTier.min) return alert("Maksimum değer minimumdan büyük olmalı.");
    setFormData(prev => ({
      ...prev,
      secondaryTiers: [...(prev.secondaryTiers || []), newSecTier]
    }));
    setNewSecTier({ min: newSecTier.max + 1, max: newSecTier.max + 11, price: 0 });
  };
  const removeSecTier = (index: number) => {
    setFormData(prev => ({ ...prev, secondaryTiers: prev.secondaryTiers?.filter((_, i) => i !== index) }));
  };
  // --- EXCEL ILE FIRMA GUNCELLEME ---
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

              let headerRowIdx = -1;
              for (let i = 0; i < rawData.length; i++) {
                  if (rawData[i] && rawData[i].length > 0 && String(rawData[i][0]).length > 2) {
                      headerRowIdx = i;
                      break;
                  }
              }

              if (headerRowIdx === -1) {
                  alert("Geçerli bir Excel formatı bulunamadı.");
                  return;
              }

              const headers = rawData[headerRowIdx].map((h: any) => String(h || "").toLowerCase());
              
              let nameIdx = -1;
              let taxIdx = -1;
              let dangerIdx = -1;
              let addressIdx = -1;
              let countIdx = -1;
              let sgkIdx = -1;
              
              headers.forEach((h: string, idx: number) => {
                  if (h.includes("unvan") || h.includes("firma")) nameIdx = idx;
                  else if (h.includes("vergi") || h.includes("v.n")) taxIdx = idx;
                  else if (h.includes("tehlike")) dangerIdx = idx;
                  else if (h.includes("adres")) addressIdx = idx;
                  else if (h.includes("sgk") || h.includes("detsis") || h.includes("sicil")) sgkIdx = idx;
                  else if (h.match(/(çalışan|personel|sayı|calisan)/) && !h.match(/(görevlendirilen|tc|t\.c|kimlik|no|kod|tel|vergi|il|ilçe|ad soyad|onaylayan|tanımlayan)/)) countIdx = idx;
              });

              if (nameIdx === -1) {
                  alert("Firma adı / unvan sütunu bulunamadı!");
                  return;
              }
              
              const currentFirms = db.getFirms();
              const proposedMappings: any[] = [];

              for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                  const row = rawData[i];
                  if (!row || !row[nameIdx]) continue;

                  const rawName = String(row[nameIdx]).trim();
                  if (rawName.length < 3) continue;

                  const xlTax = taxIdx !== -1 && row[taxIdx] ? String(row[taxIdx]).trim() : '';
                  const xlSgk = sgkIdx !== -1 && row[sgkIdx] ? String(row[sgkIdx]).trim() : '';
                  let matchedFirm = null;

                  const hasSgk = (dbSgk: string | undefined, search: string) => {
                      if (!dbSgk) return false;
                      return dbSgk.split(',').map(s => s.trim()).includes(search.trim());
                  };

                  if (xlSgk) {
                      matchedFirm = currentFirms.find(f => hasSgk(f.sgkNumber, xlSgk));
                  }

                  if (!matchedFirm && xlTax) {
                      matchedFirm = currentFirms.find(f => f.taxNumber === xlTax);
                  }

                  const normalize = (text: string) => {
                      if(!text) return '';
                      let cleaned = String(text)
                          .replace(/İ/g, 'I').replace(/i/g, 'I').replace(/ı/g, 'I').replace(/I/g, 'I')
                          .replace(/Ğ/g, 'G').replace(/ğ/g, 'G').replace(/Ü/g, 'U').replace(/ü/g, 'U')
                          .replace(/Ş/g, 'S').replace(/ş/g, 'S').replace(/Ö/g, 'O').replace(/ö/g, 'O')
                          .replace(/Ç/g, 'C').replace(/ç/g, 'C')
                          .toUpperCase()
                          .replace(/[^A-Z0-9 ]/g, ' ') 
                          .replace(/\s+/g, ' ')
                          .trim();
                          
                      let withoutSuffix = cleaned.replace(/\b(LTD|STI|SAN|TIC|AS|A S|VE|LIMITED|SIRKETI|TICARET|ANONIM|SANAYI)\b/g, '').replace(/\s+/g, ' ').trim();
                      // Eğer şirket ismi sadece "TİCARET" kelimesinden falan oluşuyorsa boş dönmesin
                      return withoutSuffix.length > 2 ? withoutSuffix : cleaned;
                  };

                  if (xlSgk) {
                      matchedFirm = currentFirms.find(f => hasSgk(f.sgkNumber, xlSgk));
                  }

                  if (!matchedFirm && xlTax) {
                      matchedFirm = currentFirms.find(f => f.taxNumber === xlTax);
                  }

                  if (!matchedFirm) {
                      const cleanSearch = normalize(rawName);
                      
                      // 1. TAM İSİM EŞLEŞMESİ (Temizlenmiş)
                      matchedFirm = currentFirms.find(f => {
                          const fClean = normalize(f.name || '');
                          if (fClean.length < 3 || cleanSearch.length < 3) return false;
                          
                          // ŞUBE KONTROLÜ: İsim aynı olsa da SGK numaraları Excel ile çakışıyorsa eşleştirme.
                          const isNameMatch = fClean === cleanSearch;
                          if (isNameMatch) {
                              if (xlSgk && f.sgkNumber && !hasSgk(f.sgkNumber, xlSgk)) return false;
                              if (xlTax && f.taxNumber && f.taxNumber !== xlTax) return false;
                              return true;
                          }
                          return false;
                      });
                      
                      // 2. KISMİ İSİM EŞLEŞMESİ (Alt Küme - Daha Güvenli)
                      if (!matchedFirm) {
                          const excelTokens = cleanSearch.split(' ');
                          let bestMatch = null;
                          let maxDbTokenCount = 0;

                          for (const f of currentFirms) {
                              if (xlSgk && f.sgkNumber && !hasSgk(f.sgkNumber, xlSgk)) continue;
                              if (xlTax && f.taxNumber && f.taxNumber !== xlTax) continue;

                              const fClean = normalize(f.name || '');
                              if (fClean.length >= 4 && cleanSearch.length >= 4) {
                                  const dbTokens = fClean.split(' ');
                                  
                                  // dbTokens içindeki HER kelimenin, excelTokens içinde tam veya başlangıç olarak geçmesi gerekir
                                  // (Sadece "ALİ" yazıyorsa "ALİ İNŞAAT" ile eşleşir)
                                  const isSubset = dbTokens.every(dt => 
                                      dt.length >= 3 && excelTokens.some(et => et === dt || et.startsWith(dt))
                                  );

                                  if (isSubset) {
                                      // Eğer birden fazla altküme eşleşmesi varsa, daha uzun kelime sayısına sahip olanı seç (daha spesifik olan)
                                      if (dbTokens.length > maxDbTokenCount) {
                                          maxDbTokenCount = dbTokens.length;
                                          bestMatch = f;
                                      }
                                  }
                              }
                          }
                          if (bestMatch) matchedFirm = bestMatch;
                      }
                  }

                  const xlDanger = dangerIdx !== -1 && row[dangerIdx] ? String(row[dangerIdx]).trim() : '';
                  const xlAddress = addressIdx !== -1 && row[addressIdx] ? String(row[addressIdx]).trim() : '';
                  const xlCount = countIdx !== -1 && row[countIdx] ? parseInt(String(row[countIdx]).replace(/[^0-9]/g, '')) : 0;
                  
                  let mappedDanger = '';
                  if (xlDanger.toLowerCase().includes("çok") || xlDanger.toLowerCase().includes("cok")) mappedDanger = "Çok Tehlikeli";
                  else if (xlDanger.toLowerCase().includes("az")) mappedDanger = "Az Tehlikeli";
                  else if (xlDanger.toLowerCase().includes("tehlike")) mappedDanger = "Tehlikeli";

                  proposedMappings.push({
                      id: uuidv4(),
                      excelName: rawName,
                      excelTax: xlTax,
                      excelDanger: mappedDanger,
                      excelAddress: xlAddress,
                      excelCount: isNaN(xlCount) ? 0 : xlCount,
                      excelSgk: xlSgk,
                      matchedFirmId: matchedFirm ? matchedFirm.id : 'NEW'
                  });
              }

              proposedMappings.sort((a, b) => a.excelName.localeCompare(b.excelName, 'tr'));
              setMappingData(proposedMappings);
              setMappingPage(1);
          } catch (error: any) {
              console.error(error);
              alert("Excel okunurken bir hata oluştu: " + (error?.message || error));
          }
      };
      reader.readAsBinaryString(file);
      e.target.value = ''; // Reset file input
  };

  const updateMappingItem = (id: string, matchedFirmId: string) => {
      setMappingData(prev => prev?.map(m => m.id === id ? { ...m, matchedFirmId } : m) || null);
  };

  const handleApplyMapping = () => {
      if (!mappingData) return;
      
      const currentFirms = db.getFirms();
      const newFirmsToSave = [...currentFirms];
      let updatedCount = 0;
      let newCount = 0;

      mappingData.forEach(mapping => {
          if (mapping.matchedFirmId === 'IGNORE') return;

          if (mapping.matchedFirmId === 'NEW') {
              newFirmsToSave.push({
                  id: uuidv4(),
                  name: mapping.excelName,
                  taxNumber: mapping.excelTax,
                  sgkNumber: mapping.excelSgk,
                  dangerClass: mapping.excelDanger,
                  address: mapping.excelAddress,
                  basePersonLimit: mapping.excelCount || 10,
                  baseFee: 1000,
                  extraPersonFee: 50,
                  expertPercentage: 60,
                  doctorPercentage: 40,
                  defaultInvoiceType: InvoiceType.E_FATURA,
                  yearlyFee: 0,
                  pricingModel: PricingModel.STANDARD,
                  tolerancePercentage: 10,
                  tiers: [],
                  serviceType: ServiceType.BOTH,
                  isKdvExcluded: false,
                  hasSecondaryModel: false,
                  secondaryPricingModel: PricingModel.STANDARD,
                  secondaryBaseFee: 0,
                  secondaryBasePersonLimit: 0,
                  secondaryExtraPersonFee: 0,
                  secondaryTiers: []
              });
              newCount++;
          } else {
              const firmToUpdate = newFirmsToSave.find(f => f.id === mapping.matchedFirmId);
              if (firmToUpdate) {
                  let changed = false;
                  if (mapping.excelTax && firmToUpdate.taxNumber !== mapping.excelTax) { firmToUpdate.taxNumber = mapping.excelTax; changed = true; }
                  
                  if (mapping.excelSgk) {
                      if (!firmToUpdate.sgkNumber) {
                          firmToUpdate.sgkNumber = mapping.excelSgk;
                          changed = true;
                      } else {
                          const existingSgks = firmToUpdate.sgkNumber.split(',').map((s: string) => s.trim());
                          if (!existingSgks.includes(mapping.excelSgk.trim())) {
                              firmToUpdate.sgkNumber += `, ${mapping.excelSgk.trim()}`;
                              changed = true;
                          }
                      }
                  }

                  if (mapping.excelDanger && firmToUpdate.dangerClass !== mapping.excelDanger) { firmToUpdate.dangerClass = mapping.excelDanger; changed = true; }
                  if (mapping.excelAddress && firmToUpdate.address !== mapping.excelAddress) { firmToUpdate.address = mapping.excelAddress; changed = true; }
                  if (mapping.excelName && firmToUpdate.name !== mapping.excelName) { firmToUpdate.name = mapping.excelName; changed = true; }
                  if (changed) updatedCount++;
              }
          }
      });

      db.saveFirms(newFirmsToSave);
      loadFirms();
      setMappingData(null);
      setSuccessMessage(`Eşleşme Tamamlandı! ${updatedCount} firma güncellendi, ${newCount} yeni firma eklendi.`);
      setTimeout(() => setSuccessMessage(''), 8000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.focus();
    
    if (isEditing && 'id' in formData) {
      db.updateFirm(formData as Firm);
      setSuccessMessage(`${formData.name} güncellendi.`);
    } else {
      db.addFirm(formData);
      setSuccessMessage(`${formData.name} kaydedildi.`);
    }
    
    setFormData(initialFormState);
    setIsEditing(false);
    loadFirms();
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleEdit = (firm: Firm) => {
    setFormData(firm);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string, name: string) => {
    window.focus();
    if (window.confirm(`${name} firmasını silmek istediğinize emin misiniz?`)) {
        db.deleteFirm(id);
        loadFirms();
        window.focus();
    }
  };

  const handleCancelEdit = () => {
    setFormData(initialFormState);
    setIsEditing(false);
  };

  // --- TOPLU SİLME ---
  const toggleSelectAll = () => {
      if (selectedFirms.length === filteredFirms.length) setSelectedFirms([]);
      else setSelectedFirms(filteredFirms.map(f => f.id));
  };
  const toggleSelect = (id: string) => {
      if (selectedFirms.includes(id)) setSelectedFirms(selectedFirms.filter(s => s !== id));
      else setSelectedFirms([...selectedFirms, id]);
  };
  const handleBulkDelete = () => {
      window.focus();
      if (selectedFirms.length === 0) return;
      if (window.confirm(`${selectedFirms.length} adet firmayı silmek istediğinize emin misiniz?`)) {
          db.deleteFirmsBulk(selectedFirms);
          loadFirms();
          window.focus();
      }
  };

  const filteredFirms = existingFirms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- RENDER HELPERS ---
  const renderPricingFields = (prefix: '' | 'secondary', model: PricingModel, tiers: PricingTier[], tierSetter: any, tierRemover: any, newTierState: any, newTierStateSetter: any) => {
      const getField = (f: string) => prefix ? `secondary${f.charAt(0).toUpperCase() + f.slice(1)}` : f;
      
      return (
        <div className="space-y-4">
             {(model === PricingModel.STANDARD || model === PricingModel.TOLERANCE) && (
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Taban Kişi</label>
                        <input type="number" name={getField('basePersonLimit')} value={(formData as any)[getField('basePersonLimit')] || 0} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Taban Ücret</label>
                        <input type="number" name={getField('baseFee')} value={(formData as any)[getField('baseFee')] || 0} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Ekstra Kişi Başı</label>
                        <input type="number" name={getField('extraPersonFee')} value={(formData as any)[getField('extraPersonFee')] || 0} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm" />
                    </div>
                     {model === PricingModel.TOLERANCE && !prefix && (
                         <div>
                            <label className="block text-xs font-medium text-yellow-400 mb-1">Tolerans (%)</label>
                            <input type="number" name="tolerancePercentage" value={formData.tolerancePercentage} onChange={handleChange} className="w-full bg-slate-900 border border-yellow-500/50 rounded px-3 py-2 text-white text-sm" />
                        </div>
                    )}
                </div>
            )}

            {model === PricingModel.TIERED && (
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700">
                    <div className="flex gap-2 items-end mb-2">
                        <input type="number" placeholder="Min" value={newTierState.min} onChange={e => newTierStateSetter((p:any) => ({...p, min: Number(e.target.value)}))} className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                        <input type="number" placeholder="Max" value={newTierState.max} onChange={e => newTierStateSetter((p:any) => ({...p, max: Number(e.target.value)}))} className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                        <input type="number" placeholder="Fiyat" value={newTierState.price} onChange={e => newTierStateSetter((p:any) => ({...p, price: Number(e.target.value)}))} className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                        <button type="button" onClick={tierSetter} className="bg-blue-600 text-white p-1 rounded"><Plus className="w-3 h-3" /></button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {tiers?.map((tier, idx) => (
                            <div key={idx} className="flex justify-between bg-slate-800 p-1.5 rounded text-xs">
                                <span>{tier.min}-{tier.max} Kişi</span>
                                <span className="text-blue-400">{tier.price} TL</span>
                                <button type="button" onClick={() => tierRemover(idx)} className="text-rose-500"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                     <div className="mt-2 pt-2 border-t border-slate-700">
                        <label className="block text-xs font-medium text-slate-400">Limit Dışı Ekstra</label>
                        <input type="number" name={getField('extraPersonFee')} value={(formData as any)[getField('extraPersonFee')] || 0} onChange={handleChange} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm mt-1" />
                    </div>
                </div>
            )}
        </div>
      );
  }

  if (mappingData) {
      return (
          <div className="max-w-5xl mx-auto animate-in slide-in-from-right-4 duration-500 pb-12">
            <header className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-2">
                <div>
                    <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <Upload className="w-8 h-8 text-emerald-500" />
                        Excel Firma Eşleştirme
                    </h2>
                    <p className="text-slate-400 mt-2">Sistemdeki mevcut firmalarla Excel satırlarını eşleştirin veya yeni firma olarak ekleyin.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setMappingData(null)} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors">İptal</button>
                    <button onClick={handleApplyMapping} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 flex items-center gap-2 transition-colors shadow-lg">
                        <CheckCircle2 className="w-5 h-5" />
                        Eşleşmeleri Uygula
                    </button>
                </div>
            </header>
            
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 border-b border-slate-700">
                            <th className="p-2 font-semibold text-slate-300 w-1/2">Excel'deki Firma (Gelen Veri)</th>
                            <th className="p-2 font-semibold text-slate-300 w-1/2">Sistemdeki Eşleşme (Hedef)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mappingData.slice((mappingPage - 1) * mappingItemsPerPage, mappingPage * mappingItemsPerPage).map(row => (
                            <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                <td className="p-2">
                                    <div className="font-medium text-white">{row.excelName}</div>
                                    <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                        {row.excelTax && <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">Vergi: {row.excelTax}</span>}
                                        {row.excelSgk && <span className="bg-purple-900/30 text-purple-200 px-2 py-0.5 rounded border border-purple-700/50">SGK: {row.excelSgk}</span>}
                                        {row.excelDanger && <span className="bg-orange-900/30 text-orange-200 px-2 py-0.5 rounded border border-orange-700/50">{row.excelDanger}</span>}
                                        {row.excelCount > 0 && <span className="bg-blue-900/30 text-blue-200 px-2 py-0.5 rounded border border-blue-700/50">Çalışan: {row.excelCount}</span>}
                                        {row.excelAddress && <span className="text-slate-500 w-full mt-1 truncate block" title={row.excelAddress}>{row.excelAddress}</span>}
                                    </div>
                                </td>
                                <td className="p-2">
                                    <select 
                                        value={row.matchedFirmId} 
                                        onChange={(e) => updateMappingItem(row.id, e.target.value)}
                                        className={`w-full p-2.5 rounded text-sm outline-none border focus:ring-2 focus:ring-emerald-500 transition-colors ${row.matchedFirmId === 'NEW' ? 'bg-emerald-900/40 border-emerald-600 text-emerald-50' : row.matchedFirmId === 'IGNORE' ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-blue-900/40 border-blue-600 text-blue-50'}`}
                                    >
                                        <option value="IGNORE" className="bg-slate-800 text-slate-200">❌ Bu satırı atla (Aktarma)</option>
                                        <option value="NEW" className="bg-emerald-900 text-emerald-100">✨ YENİ FİRMA OLARAK EKLE</option>
                                        <optgroup label="Mevcut Sistem Firmaları ile Eşleştir" className="bg-slate-900 text-slate-400">
                                            {existingFirms.map(f => (
                                                <option key={f.id} value={f.id} className="bg-slate-800 text-white">{f.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {mappingData.length > mappingItemsPerPage && (
                    <div className="flex items-center justify-between p-2 bg-slate-900/50 border-t border-slate-700">
                        <span className="text-sm text-slate-400">
                            Toplam {mappingData.length} kayıt. Sayfa {mappingPage} / {Math.ceil(mappingData.length / mappingItemsPerPage)}
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setMappingPage(p => Math.max(1, p - 1))}
                                disabled={mappingPage === 1}
                                className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Önceki
                            </button>
                            <button 
                                onClick={() => setMappingPage(p => Math.min(Math.ceil(mappingData.length / mappingItemsPerPage), p + 1))}
                                disabled={mappingPage === Math.ceil(mappingData.length / mappingItemsPerPage)}
                                className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Sonraki
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in slide-in-from-right-4 duration-500 pb-12">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
            <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-500" />
              {isEditing ? 'Firma Düzenle' : 'Firma Kayıt & Parametreler'}
            </h2>
            <p className="text-slate-400 mt-2">Çoklu fiyatlandırma modelleri, fatura tipleri ve yıllık ücret tanımlamaları.</p>
        </div>
        {!isEditing && (
            <label className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-lg whitespace-nowrap w-fit">
                <Upload className="w-5 h-5" />
                <span>Excel'den İçe Aktar / Güncelle</span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
            </label>
        )}
      </header>

      {successMessage && (
        <div className="mb-6 p-2 bg-emerald-500/10 border border-emerald-500/50 rounded-lg flex items-center gap-3 text-emerald-400 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl mb-12 relative">
        {isEditing && (
            <button type="button" onClick={handleCancelEdit} className="absolute top-2 right-4 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SOL: TEMEL BİLGİLER */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">Genel Bilgiler</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Firma Adı</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Örn: ABC İnşaat Ltd. Şti." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-2">
                      <Network className="w-4 h-4 text-purple-400" />
                      Bağlı Olduğu Ana Firma (Şube ise Seçiniz)
                  </label>
                  <select name="parentFirmId" value={formData.parentFirmId || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">-- Yok (Ana Firma) --</option>
                      {existingFirms
                          .filter(f => isEditing ? f.id !== (formData as Firm).id : true) // Kendini seçemesin
                          .map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                          ))
                      }
                  </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Varsayılan Fatura Tipi</label>
                    <div className="flex gap-2">
                        <label className={`flex-1 cursor-pointer text-center py-2 rounded text-xs font-bold transition-all ${formData.defaultInvoiceType === InvoiceType.E_FATURA ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                            <input type="radio" name="defaultInvoiceType" value={InvoiceType.E_FATURA} checked={formData.defaultInvoiceType === InvoiceType.E_FATURA} onChange={handleChange} className="hidden" />
                            E-FATURA
                        </label>
                        <label className={`flex-1 cursor-pointer text-center py-2 rounded text-xs font-bold transition-all ${formData.defaultInvoiceType === InvoiceType.E_ARSIV ? 'bg-orange-600 text-white shadow' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                            <input type="radio" name="defaultInvoiceType" value={InvoiceType.E_ARSIV} checked={formData.defaultInvoiceType === InvoiceType.E_ARSIV} onChange={handleChange} className="hidden" />
                            E-ARŞİV
                        </label>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-purple-400 mb-1">Yıllık İşlem Ücreti</label>
                    <input type="number" name="yearlyFee" value={formData.yearlyFee} onChange={handleChange} className="w-full bg-slate-900 border border-purple-500/30 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-emerald-400 mb-1 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" /> Hizmet Kapsamı
                </label>
                <select name="serviceType" value={formData.serviceType || ServiceType.BOTH} onChange={handleChange} className="w-full bg-slate-900 border border-emerald-500/30 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value={ServiceType.BOTH}>Tümü (Uzman + Hekim)</option>
                    <option value={ServiceType.EXPERT_ONLY}>Sadece İş Güvenliği Uzmanı</option>
                    <option value={ServiceType.DOCTOR_ONLY}>Sadece İşyeri Hekimi</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Fatura açıklaması ve hesaplama bu seçime göre yapılır.</p>
              </div>

                {/* VERGİ VE ADRES (HER ZAMAN GÖRÜNÜR) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
                    <div className="col-span-1 md:col-span-3 text-[10px] text-slate-400 flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        <span>Fatura kesimi için aşağıdaki bilgilerin doğruluğu önemlidir.</span>
                    </div>
                    
                    {/* Vergi No (1 Kolon) */}
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-300 mb-1">Vergi No / TCKN</label>
                        <input type="text" name="taxNumber" value={formData.taxNumber || ''} onChange={handleChange} placeholder="VKN veya TCKN" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:border-blue-500 outline-none" />
                    </div>
                    
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1.5">
                            <span>Yetkili Telefon (WhatsApp)</span>
                        </label>
                        <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="Örn: 0532 123 4567" className="w-full bg-slate-900 border border-emerald-500/40 rounded px-2 py-2 text-white text-sm focus:border-emerald-500 outline-none" />
                    </div>

                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-slate-300 mb-1">Yetkili / Muhasebe İlgilisi</label>
                        <input type="text" name="contactPerson" value={formData.contactPerson || ''} onChange={handleChange} placeholder="İsim / Unvan" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:border-blue-500 outline-none" />
                    </div>
                    
                    {/* Firma Adresi (2 Kolon) */}
                    <div className="col-span-1 md:col-span-3">
                        <label className="block text-xs font-medium text-slate-300 mb-1">Firma Adresi</label>
                        <textarea name="address" value={formData.address || ''} onChange={handleChange} placeholder="Fatura Adresi" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm h-[38px] resize-none overflow-hidden focus:border-blue-500 outline-none" />
                    </div>

                    {/* SGK Numaraları (Tam Genişlik) */}
                    <div className="col-span-1 md:col-span-3">
                        <label className="block text-xs font-medium text-slate-300 mb-1">SGK / DETSİS Numaraları</label>
                        <div className="flex flex-col gap-2 p-2.5 bg-slate-900 border border-slate-600 rounded">
                            {formData.sgkNumber && formData.sgkNumber.split(',').map(s => s.trim()).filter(Boolean).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {formData.sgkNumber.split(',').map(s => s.trim()).filter(Boolean).map((sgk, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 shadow-sm">
                                            <span className="text-sm text-slate-200 font-mono tracking-wide">{sgk}</span>
                                            <button type="button" onClick={() => handleRemoveSgk(sgk)} className="text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-full p-0.5 transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 mt-1">
                                <input 
                                    type="text" 
                                    value={newSgkInput} 
                                    onChange={(e) => setNewSgkInput(e.target.value)} 
                                    onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddSgk(); } }}
                                    placeholder="Yeni SGK veya DETSİS numarası girip ekle..." 
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none" 
                                />
                                <button type="button" onClick={handleAddSgk} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1 shadow-sm">
                                    <Plus size={16} /> SGK Ekle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* SAĞ: FİYATLANDIRMA MODELLERİ */}
          <div className="space-y-6">
             <h3 className="text-lg font-semibold text-slate-200 border-b border-slate-700 pb-2">Fiyatlandırma Kurgusu</h3>
             
             {/* KDV Hariç Seçeneği */}
             <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <input 
                    type="checkbox" 
                    id="isKdvExcluded" 
                    name="isKdvExcluded" 
                    checked={formData.isKdvExcluded || false} 
                    onChange={handleChange} 
                    className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500" 
                />
                <div>
                    <label htmlFor="isKdvExcluded" className="block text-sm font-bold text-white cursor-pointer select-none">Fiyatlar KDV Hariç</label>
                    <p className="text-xs text-slate-500">Seçilirse, girilen fiyatlar <b>Net</b> kabul edilir ve üzerine KDV eklenerek fatura oluşturulur.</p>
                </div>
             </div>

             {/* MODEL 1 */}
             <div className="p-2 bg-slate-700/30 rounded-lg border border-slate-600">
                <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-blue-400 text-sm">Ana Model (Zorunlu)</span>
                    <select name="pricingModel" value={formData.pricingModel} onChange={handleChange} className="bg-slate-900 border border-slate-600 rounded text-xs px-2 py-1 text-white outline-none">
                        <option value={PricingModel.STANDARD}>Standart</option>
                        <option value={PricingModel.TOLERANCE}>Toleranslı</option>
                        <option value={PricingModel.TIERED}>Kademeli</option>
                    </select>
                </div>
                {renderPricingFields('', formData.pricingModel, formData.tiers || [], handleAddTier, removeTier, newTier, setNewTier)}
             </div>

             {/* MODEL 2 */}
             <div className={`p-2 rounded-lg border transition-all ${formData.hasSecondaryModel ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-800 border-slate-700 opacity-60'}`}>
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" name="hasSecondaryModel" id="secModelCheck" checked={formData.hasSecondaryModel} onChange={handleChange} className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="secModelCheck" className="font-bold text-emerald-400 text-sm cursor-pointer select-none">İkincil Model (Ek Hizmet vb.)</label>
                    </div>
                    {formData.hasSecondaryModel && (
                        <select name="secondaryPricingModel" value={formData.secondaryPricingModel} onChange={handleChange} className="bg-slate-900 border border-slate-600 rounded text-xs px-2 py-1 text-white outline-none">
                            <option value={PricingModel.STANDARD}>Standart</option>
                            <option value={PricingModel.TIERED}>Kademeli</option>
                        </select>
                    )}
                </div>
                {formData.hasSecondaryModel && renderPricingFields('secondary', formData.secondaryPricingModel || PricingModel.STANDARD, formData.secondaryTiers || [], handleAddSecTier, removeSecTier, newSecTier, setNewSecTier)}
             </div>

          </div>

        </div>

        <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end">
          <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-blue-600/30">
            <Save className="w-5 h-5" />
            {isEditing ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>

      {/* Kayıtlı Firmalar Listesi */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold text-slate-200">Kayıtlı Firmalar</h3>
             
             {/* Arama Kutusu */}
             <div className="relative">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                 <input 
                    type="text" 
                    placeholder="Firma Ara..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                 />
             </div>

             {selectedFirms.length > 0 && (
                 <button onClick={handleBulkDelete} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors animate-in zoom-in">
                     <Trash2 className="w-4 h-4" />
                     Seçilenleri Sil ({selectedFirms.length})
                 </button>
             )}
        </div>
        
        <div className="overflow-hidden">
            <table className="w-full text-left table-fixed text-[10px] sm:text-xs">
                <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                        <th className="p-2 w-8 sm:w-10">
                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                                {selectedFirms.length === filteredFirms.length && filteredFirms.length > 0 ? <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" /> : <Square className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </button>
                        </th>
                        <th className="p-2 text-slate-400">Firma Adı</th>
                        <th className="p-2 text-slate-400 w-16 sm:w-20">Tip</th>
                        <th className="p-2 text-slate-400 text-right w-20 sm:w-24">Taban</th>
                        <th className="p-2 text-slate-400 text-center w-16 sm:w-24">Hizmet</th>
                        <th className="p-2 text-slate-400 text-center w-10 sm:w-16">KDV</th>
                        <th className="p-2 text-slate-400 text-center w-16 sm:w-24">İşlem</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {filteredFirms.map(firm => (
                        <tr key={firm.id} className={`hover:bg-slate-700/50 ${selectedFirms.includes(firm.id) ? 'bg-blue-900/20' : ''}`}>
                            <td className="p-2 text-center">
                                <button onClick={() => toggleSelect(firm.id)} className="text-slate-500 hover:text-blue-400">
                                    {selectedFirms.includes(firm.id) ? <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" /> : <Square className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </button>
                            </td>
                            <td className="p-2 text-slate-200 font-medium overflow-hidden">
                                <div className="truncate" title={firm.name}>
                                    {firm.name}
                                </div>
                                {firm.parentFirmId && <span className="text-[9px] text-slate-500 bg-slate-800 px-1 py-0.5 rounded border border-slate-700 mt-1 inline-block">Şube</span>}
                            </td>
                            <td className="p-2 text-slate-400 text-sm">
                                {firm.defaultInvoiceType === InvoiceType.E_FATURA ? (
                                    <span className="text-[8px] sm:text-[10px] bg-indigo-500/20 text-indigo-400 px-1 sm:px-2 py-0.5 sm:py-1 rounded border border-indigo-500/30 truncate block text-center">E-FATURA</span>
                                ) : (
                                    <span className="text-[8px] sm:text-[10px] bg-orange-500/20 text-orange-400 px-1 sm:px-2 py-0.5 sm:py-1 rounded border border-orange-500/30 truncate block text-center">E-ARŞİV</span>
                                )}
                            </td>
                            <td className="p-2 text-slate-400 text-right truncate" title={new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(firm.baseFee)}>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(firm.baseFee)}</td>
                            <td className="p-2 text-center">
                                {firm.serviceType === ServiceType.EXPERT_ONLY ? (
                                    <span className="text-[9px] sm:text-xs bg-blue-500/10 text-blue-400 px-1 sm:px-2 py-0.5 sm:py-1 rounded block truncate">Uzman</span>
                                ) : firm.serviceType === ServiceType.DOCTOR_ONLY ? (
                                    <span className="text-[9px] sm:text-xs bg-purple-500/10 text-purple-400 px-1 sm:px-2 py-0.5 sm:py-1 rounded block truncate">Hekim</span>
                                ) : (
                                    <span className="text-[9px] sm:text-xs bg-emerald-500/10 text-emerald-400 px-1 sm:px-2 py-0.5 sm:py-1 rounded block truncate">Tümü</span>
                                )}
                            </td>
                            <td className="p-2 text-center text-[9px] sm:text-xs">
                                {firm.isKdvExcluded ? <span className="text-yellow-500 font-bold block truncate">HARİÇ</span> : <span className="text-slate-500 block truncate">DAHİL</span>}
                            </td>
                            <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1 sm:gap-2">
                                     <button 
                                        onClick={() => handleEdit(firm)}
                                        className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        title="Düzenle"
                                    >
                                        <Edit className="w-5 h-5" />
                                    </button>
                                     <button 
                                        onClick={() => handleDelete(firm.id, firm.name)}
                                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Sil"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredFirms.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Kayıtlı firma bulunamadı.</td></tr>}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default FirmRegistration;
