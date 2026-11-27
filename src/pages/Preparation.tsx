
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/db';
import { Firm, PreparationItem, TransactionType, GlobalSettings, InvoiceType, PricingModel, ServiceType } from '../types';
import { Calculator, Save, ArrowRight, Upload, Search, CalendarCheck, Filter, FileSpreadsheet, XCircle, ListFilter, AlertCircle, Network, GitCompare, Download, Loader2, CheckCircle2, Building2, Folder, Settings, Plus, Stethoscope, } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { GroupManagerModal } from '../components/GroupManagerModal';
import { SequentialFirmModal, UnmatchedQueueItem } from '../components/SequentialFirmModal';
import { CheckCircle } from 'lucide-react';

const months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const Preparation = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTetkikDetailFirm, setSelectedTetkikDetailFirm] = useState<any | null>(null);

  // Sıralı Yeni Firma Kayıt Modalı State'leri
  const [showSequentialModal, setShowSequentialModal] = useState(false);
  const [sequentialQueue, setSequentialQueue] = useState<UnmatchedQueueItem[]>([]);
  const [sequentialIndex, setSequentialIndex] = useState(0);

  const [firms, setFirms] = useState<Firm[]>([]);
  const [items, setItems] = useState<Record<string, PreparationItem>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  
  // Firma Grupları State'leri
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Filtre State'leri
  const [filterType, setFilterType] = useState<'ALL' | InvoiceType>('ALL');
  const [uploadedFirmIds, setUploadedFirmIds] = useState<string[]>([]); // Excel'den gelen ID'leri tutar

  // İSG-Katip Excel Eşleşmeyenler State
  const [unmatchedRows, setUnmatchedRows] = useState<any[]>([]);
  const [unmatchedPage, setUnmatchedPage] = useState(1);
  const unmatchedItemsPerPage = 50;
  const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<Record<number, string>>({});

  // Eşleşmeyen Tetkik/Sevk Kayıtları State
  const [unmatchedHealthRecords, setUnmatchedHealthRecords] = useState<any[]>([]);
  const [showUnmatchedHealthModal, setShowUnmatchedHealthModal] = useState(false);
  const [selectedHealthMapping, setSelectedHealthMapping] = useState<Record<string, string>>({});

  // Sevk Tablosunda Kullanıcı Tarafından Düzenlenen Tutarlar (Firma ID -> Belirlenen Tutar)
  
  // Sevk Aktarım Tarih & İşlem State'leri
  const [tetkikStartDate, setTetkikStartDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const y = firstDay.getFullYear();
    const m = String(firstDay.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [tetkikEndDate, setTetkikEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const y = lastDay.getFullYear();
    const m = String(lastDay.getMonth() + 1).padStart(2, '0');
    const d = String(lastDay.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [isSyncingSevkler, setIsSyncingSevkler] = useState(false);

  const loadData = React.useCallback(() => {
    const f = db.getFirms();
    setFirms(f);
    setGroups(db.getFirmGroups());
    setGlobalSettings(db.getGlobalSettings());
    
    const extHealth = db.getExternalHealthServices ? db.getExternalHealthServices().filter((s:any) => !s.isBilled) : [];
    
    let saved = db.getPreparationItems();
    if (!Array.isArray(saved)) saved = [];
    
    const initialItems: Record<string, PreparationItem> = {};
    const transactions = db.getTransactions ? db.getTransactions() : [];

    // Halihazırda PENDING (bekleyen taslak) faturalara kilitlenmiş sağlık tetkiklerini bul
    const lockedHealthRecordIds = new Set<string>();
    transactions.forEach((t: any) => {
        if (t.status === 'PENDING' && t.calculatedDetails?.externalHealthRecordIds) {
            t.calculatedDetails.externalHealthRecordIds.forEach((id: string) => lockedHealthRecordIds.add(id));
        }
    });

    // Faturalandırılmamış ve bekleyen faturaya henüz bağlanmamış sağlık hizmetleri
    const unbilledHealthRecords = extHealth.filter((s: any) => !s.isBilled && !lockedHealthRecordIds.has(s.id));

    // Her sağlık kaydını ait olduğu firmaya ata
    const firmHealthRecordsMap: Record<string, any[]> = {};
    const unmatchedHealthList: any[] = [];

    unbilledHealthRecords.forEach((s: any) => {
        if (s.matchedFirmId === '__SKIP__' || s.matchedFirmId === 'IGNORE') {
            return;
        }
        const matchedFirm = s.matchedFirmId ? f.find(firm => firm.id === s.matchedFirmId) : null;
        if (matchedFirm) {
            if (!firmHealthRecordsMap[matchedFirm.id]) firmHealthRecordsMap[matchedFirm.id] = [];
            firmHealthRecordsMap[matchedFirm.id].push(s);
        } else {
            unmatchedHealthList.push(s);
        }
    });
    setUnmatchedHealthRecords(unmatchedHealthList);

    f.forEach(firm => {
      const existing = saved.find((s: any) => s && s.firmId === firm.id);
      const firmHealth = firmHealthRecordsMap[firm.id] || [];
      const healthIds = firmHealth.map((h: any) => h.id);
      const healthTotal = firmHealth.reduce((sum: number, h: any) => sum + (Number(h.amount) || 0), 0);

      const currentExtra = existing ? (Number(existing.extraItemAmount) || 0) : 0;
      const effectiveExtra = healthTotal > 0 ? healthTotal : currentExtra;

      initialItems[firm.id] = { 
        firmId: firm.id, 
        currentEmployeeCount: existing ? existing.currentEmployeeCount : (Number(firm.basePersonLimit) || 0), 
        extraItemAmount: effectiveExtra, 
        addYearlyFee: existing ? existing.addYearlyFee : false,
        externalHealthRecordIds: healthIds
      };
    });
    setItems(initialItems);
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = db.subscribe(() => {
        loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  // Eşleşmeyen Sevkleri Firma Bazında Grupla
  const unmatchedCompanyGroups = React.useMemo(() => {
    const map = new Map<string, { companyName: string; referrals: any[]; totalAmount: number }>();
    unmatchedHealthRecords.forEach(rec => {
      const name = (rec.sourceCompanyName || 'Bilinmeyen Firma').trim();
      if (!map.has(name)) {
        map.set(name, { companyName: name, referrals: [], totalAmount: 0 });
      }
      const group = map.get(name)!;
      group.referrals.push(rec);
      group.totalAmount += Number(rec.amount) || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [unmatchedHealthRecords]);

  const unmatchedHealthTotal = React.useMemo(() => {
    return unmatchedHealthRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [unmatchedHealthRecords]);

  // İsme göre akıllı eşleştirme önerisi
  const normalizeName = (name: string) => {
    return (name || '')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const findBestFirmMatch = (tetkikName: string, allFirms: Firm[]): string => {
    const normTetkik = normalizeName(tetkikName);
    if (!normTetkik) return '';

    const exact = allFirms.find(f => normalizeName(f.name) === normTetkik);
    if (exact) return exact.id;

    const cleanTetkik = normTetkik
      .replace(/\b(a s|as|ltd|sti|san|tic|ins|ve|ticaret|sanayi|limited|sirketi)\b/g, '')
      .trim();

    if (cleanTetkik.length >= 3) {
      const partial = allFirms.find(f => {
        const cleanF = normalizeName(f.name)
          .replace(/\b(a s|as|ltd|sti|san|tic|ins|ve|ticaret|sanayi|limited|sirketi)\b/g, '')
          .trim();
        return cleanF.includes(cleanTetkik) || cleanTetkik.includes(cleanF);
      });
      if (partial) return partial.id;
    }
    return '';
  };

  // Eşleşmeyen firmalar açıldığında önerileri otomatik ata
  useEffect(() => {
    if (unmatchedCompanyGroups.length > 0 && firms.length > 0) {
      setSelectedHealthMapping(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        unmatchedCompanyGroups.forEach(group => {
          if (!updated[group.companyName]) {
            const suggested = findBestFirmMatch(group.companyName, firms);
            if (suggested) {
              updated[group.companyName] = suggested;
              hasChanges = true;
            }
          }
        });
        return hasChanges ? updated : prev;
      });
    }
  }, [unmatchedCompanyGroups, firms]);



  // Sevk Aktarım Barı İstatistiği
  const { totalActiveHealthCount, totalActiveHealthTotal } = React.useMemo(() => {
    const extHealth = db.getExternalHealthServices ? db.getExternalHealthServices().filter((s:any) => !s.isBilled) : [];
    const matched = extHealth.filter((s: any) => s.matchedFirmId && s.matchedFirmId !== '__SKIP__' && s.matchedFirmId !== 'IGNORE');
    const total = matched.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    return { totalActiveHealthCount: matched.length, totalActiveHealthTotal: total };
  }, [items]);

  // Sevkleri Seçilen Tarih Aralığına Göre Senkronize Et
  const handleSyncSevkler = async () => {
    setIsSyncingSevkler(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/tetkik/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          startDate: tetkikStartDate,
          endDate: tetkikEndDate,
          purgeOtherUnbilled: true
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sevkler aktarılamadı');
      }

      await db.initData();
      loadData();

      // Güncel eşleşmeyen kayıtları kontrol et
      const extHealth = db.getExternalHealthServices ? db.getExternalHealthServices().filter((s: any) => !s.isBilled) : [];
      const currentFirms = db.getFirms ? db.getFirms() : [];
      const remainingUnmatched = extHealth.filter((s: any) => {
        if (s.matchedFirmId === '__SKIP__' || s.matchedFirmId === 'IGNORE') return false;
        return !s.matchedFirmId || !currentFirms.some(f => f.id === s.matchedFirmId);
      });

      if (remainingUnmatched.length > 0) {
        setShowUnmatchedHealthModal(true);
      } else {
        alert(`✅ ${data.totalFound || 0} adet faturalı sevk başarıyla aktarıldı ve carilerle eşleştirildi.`);
      }
    } catch (e: any) {
      console.error('Sevk aktarım hatası:', e);
      alert('Sevk aktarımı sırasında bir hata oluştu: ' + (e.message || 'Bilinmeyen hata'));
    } finally {
      setIsSyncingSevkler(false);
    }
  };

  // Eşleştirmeleri Kalıcı Olarak Kaydet ve Sevkleri Güncelle
  const handleSaveHealthMappings = async () => {
    const entries = Object.entries(selectedHealthMapping).filter(([_, targetId]) => Boolean(targetId));
    if (entries.length === 0) {
      alert("Lütfen en az bir firma için eşleştirme seçin.");
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const mappingsPayload = entries.map(([tetkikName, targetFirmId]) => ({
        tetkikName,
        targetFirmId
      }));

      const saveRes = await fetch('/api/tetkik/save-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ mappings: mappingsPayload })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || 'Eşleştirmeler kaydedilemedi');
      }

      // Sevkleri güncel eşleştirmeyle senkronize et
      await fetch('/api/tetkik/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          startDate: tetkikStartDate,
          endDate: tetkikEndDate,
          purgeOtherUnbilled: true
        })
      });

      await db.initData();
      loadData();

      setShowUnmatchedHealthModal(false);
      alert(`✅ ${entries.length} firma eşleştirmesi kalıcı olarak kaydedildi ve sevk tutarları carilere eklendi.`);
    } catch (e: any) {
      console.error('Eşleştirme kaydetme hatası:', e);
      alert('Eşleştirme kaydedilemedi: ' + (e.message || 'Bilinmeyen hata'));
    }
  };

  const handleUpdate = (firmId: string, field: keyof PreparationItem, value: any) => {
    setItems(prev => { 
      const updated = {
        ...prev, 
        [firmId]: { 
          ...(prev[firmId] || { firmId, currentEmployeeCount: 0, extraItemAmount: 0 }), 
          [field]: typeof value === 'boolean' ? value : Number(value) 
        } 
      };
      db.savePreparationItems(Object.values(updated));
      return updated;
    });
  };

  // --- YARDIMCI: TEKİL FİRMA FİYAT HESAPLAMA ---
  // Bu fonksiyon, verilen firmanın KENDİ ayarlarını kullanarak o firmanın tutarını hesaplar.
  const calculateIndividualFirmPrice = (targetFirm: Firm, employeeCount: number) => {
      let price = Number(targetFirm.baseFee);
      const limit = Number(targetFirm.basePersonLimit);
      const extraFee = Number(targetFirm.extraPersonFee);
      const count = Number(employeeCount);

      // 1. KADEMELİ MODEL (TIERED)
      if (targetFirm.pricingModel === PricingModel.TIERED && Array.isArray(targetFirm.tiers) && targetFirm.tiers.length > 0) {
           const validTiers = targetFirm.tiers.filter(t => t && typeof t.max === 'number');
           if (validTiers.length > 0) {
               const tier = validTiers.find(t => count >= t.min && count <= t.max);
               if (tier) {
                   price = Number(tier.price);
               } else {
                   // Limit dışıysa en son tier + ekstra
                   const maxTier = validTiers.reduce((prev, curr) => (prev.max > curr.max) ? prev : curr, validTiers[0]);
                   if (count > maxTier.max) {
                       const diff = count - maxTier.max;
                       price = Number(maxTier.price) + (diff * extraFee);
                   }
               }
           }
      } 
      // 2. TOLERANSLI MODEL (TOLERANCE)
      else if (targetFirm.pricingModel === PricingModel.TOLERANCE) {
          const tolerancePct = Number(targetFirm.tolerancePercentage) || 0;
          const toleranceCount = Math.floor(limit * (tolerancePct / 100));
          const lowerBound = limit - toleranceCount;
          const upperBound = limit + toleranceCount;

          if (count > upperBound) {
              const diff = count - limit;
              price += diff * extraFee;
          } else if (count < lowerBound) {
              const diff = limit - count;
              price -= diff * extraFee;
          }
      } 
      // 3. STANDART MODEL (DEFAULT)
      else {
          if (count > limit) {
              const diff = count - limit;
              price += diff * extraFee;
          }
      }

      return Math.max(0, price || 0);
  };

  // --- ANA HESAPLAMA MOTORU ---
  const calculateFinancials = (firm: Firm, item: PreparationItem | undefined) => {
      // 1. Eğer bu firma bir ŞUBE ise (Parent ID varsa), hesaplama yapma (0 döndür).
      if (firm.parentFirmId) {
          return { grandTotal: 0, netExpertShare: 0, netDoctorShare: 0, netHealthShare: 0, contractPrice: 0, isBranch: true };
      }

      // 2. Eğer bu firma ANA FİRMA ise:
      // a) Kendi fiyatını hesapla
      const parentCount = Number(item?.currentEmployeeCount ?? firm.basePersonLimit);
      let totalContractPrice = calculateIndividualFirmPrice(firm, parentCount);
      let totalExtraAmount = Number(item?.extraItemAmount ?? 0);
      let totalPoolEmployeeCount = parentCount;

      // b) Kendine bağlı çocukları bul, onların fiyatını hesapla ve toplama ekle
      const children = firms.filter(f => f.parentFirmId === firm.id);
      
      children.forEach(child => {
          const childItem = items[child.id];
          const childCount = Number(childItem?.currentEmployeeCount ?? child.basePersonLimit);
          const childExtra = Number(childItem?.extraItemAmount ?? 0);

          // Şubenin kendi parametrelerine göre hesaplanmış fiyatı
          const childPrice = calculateIndividualFirmPrice(child, childCount);

          totalContractPrice += childPrice || 0;
          totalExtraAmount += childExtra || 0;
          totalPoolEmployeeCount += childCount || 0;
      });

      // --- HAKEDİŞ VE KDV HESABI (Toplam Tutar Üzerinden) ---
      // Fatura ana firmaya kesildiği için KDV ve Oran ayarları Ana Firma'dan alınır.
      const vatExpert = globalSettings?.vatRateExpert ?? 20;
      const vatDoctor = globalSettings?.vatRateDoctor ?? 20;
      const vatHealth = globalSettings?.vatRateHealth ?? 20;

      // HİZMET TÜRÜNE GÖRE ORANLARI AYARLA
      let finalExpertRate = 0;
      let finalDoctorRate = 0;

      if (firm.serviceType === ServiceType.EXPERT_ONLY) {
          finalExpertRate = 100;
          finalDoctorRate = 0;
      } else if (firm.serviceType === ServiceType.DOCTOR_ONLY) {
          finalExpertRate = 0;
          finalDoctorRate = 100;
      } else {
          finalExpertRate = globalSettings?.expertPercentage ?? firm.expertPercentage;
          finalDoctorRate = globalSettings?.doctorPercentage ?? firm.doctorPercentage;
      }

      let grandTotal = 0;
      let netExpertShare = 0;
      let netDoctorShare = 0;
      let netHealthShare = 0;

      // Ham Paylar (Toplam Sözleşme Fiyatı Üzerinden)
      const rawExpertPart = totalContractPrice * (finalExpertRate / 100);
      const rawDoctorPart = totalContractPrice * (finalDoctorRate / 100);
      const rawHealthPart = totalExtraAmount; 

      if (firm.isKdvExcluded) {
          // SENARYO 1: Firma "KDV HARİÇ" (Girdiler NET)
          netExpertShare = rawExpertPart;
          netDoctorShare = rawDoctorPart;
          netHealthShare = rawHealthPart;

          grandTotal = (rawExpertPart * (1 + vatExpert / 100)) +
                       (rawDoctorPart * (1 + vatDoctor / 100)) +
                       (rawHealthPart * (1 + vatHealth / 100));
      } else {
          // SENARYO 2: Firma "KDV DAHİL/STANDART" (Girdiler BRÜT)
          grandTotal = totalContractPrice + totalExtraAmount;

          netExpertShare = rawExpertPart > 0 ? rawExpertPart / (1 + vatExpert / 100) : 0;
          netDoctorShare = rawDoctorPart > 0 ? rawDoctorPart / (1 + vatDoctor / 100) : 0;
          netHealthShare = rawHealthPart > 0 ? rawHealthPart / (1 + vatHealth / 100) : 0;
      }

      return { 
          grandTotal: grandTotal || 0, 
          netExpertShare: netExpertShare || 0, 
          netDoctorShare: netDoctorShare || 0, 
          netHealthShare: netHealthShare || 0, 
          contractPrice: totalContractPrice || 0, 
          isBranch: false,
          poolDetails: {
              totalCount: totalPoolEmployeeCount,
              childCount: children.length
          }
      };
  };

  // --- FİLTRELEME MANTIĞI ---
  const filteredFirms = firms.filter(f => {
    const safeName = f.name || '';
    const matchesSearch = safeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || f.defaultInvoiceType === filterType;
    const matchesUpload = uploadedFirmIds.length > 0 ? uploadedFirmIds.includes(f.id) : true;
    const matchesGroup = selectedGroup === 'ALL'
      ? true
      : (selectedGroup === 'UNGROUPED' ? !f.group : f.group === selectedGroup);
    return matchesSearch && matchesType && matchesUpload && matchesGroup;
  });

  // --- YENİ VERİ YÜKLEME STİLİNE (İSG-KATİP) UYGUN ÖRNEK EXCEL ŞABLONU İNDİR ---
  const handleDownloadUnifiedTemplate = () => {
    let firmsToExport = firms;
    if (selectedGroup !== 'ALL') {
        if (selectedGroup === 'UNGROUPED') {
            firmsToExport = firmsToExport.filter(f => !f.group);
        } else {
            firmsToExport = firmsToExport.filter(f => f.group === selectedGroup);
        }
    }

    if (firmsToExport.length === 0) {
        alert(`${selectedGroup !== 'ALL' ? `"${selectedGroup}" grubunda ` : ''}kayıtlı firma bulunamadı.`);
        return;
    }
    const data = firmsToExport.map(f => {
        const item = items[f.id];
        const primarySgk = f.sgkNumber ? f.sgkNumber.split(',')[0].trim() : '';
        return {
            "Hizmet Alan İşyeri Unvanı": f.name,
            "Hizmet Alan İşyeri SGK/DETSİS No": primarySgk,
            "Hizmet Alan İşyeri Tehlike Sınıfı": f.dangerClass || 'Az Tehlikeli',
            "Hizmet Alan İşyeri Çalışan Sayısı": item?.currentEmployeeCount ?? f.basePersonLimit ?? 1,
            "Hizmet Alan İşyeri İli": 'BURSA',
            "Firma Grubu": f.group || 'Grupsuz',
            "Sözleşme Statüsü": 'Sözleşme Devam Ediyor',
            "Ekstra Tutar": item?.extraItemAmount || 0
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const groupSuffix = selectedGroup !== 'ALL' ? `_${selectedGroup.replace(/\s+/g, '_')}` : '';
    const fileName = `ISG_Katip_Yukleme_Sablonu${groupSuffix}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, "İSG Hizmet Sözleşme Süreçleri L");
    XLSX.writeFile(workbook, `${fileName}_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
  };

  const cleanSgk = (s?: any): string => {
    if (!s) return '';
    return String(s).replace(/\D/g, '').trim();
  };

  const matchFirmBySgk = (excelSgk: string, firmList: Firm[]): Firm | null => {
    const target = cleanSgk(excelSgk);
    if (!target || target.length < 5) return null;
    for (const f of firmList) {
      if (!f.sgkNumber) continue;
      const sList = f.sgkNumber.split(',').map(s => cleanSgk(s)).filter(Boolean);
      if (sList.includes(target)) {
        return f;
      }
    }
    return null;
  };

  const cleanCompanyName = (name: string) => {
      if (!name) return "";
      let cleaned = String(name)
          .replace(/İ/g, 'I').replace(/i/g, 'I').replace(/ı/g, 'I').replace(/I/g, 'I')
          .replace(/Ğ/g, 'G').replace(/ğ/g, 'G').replace(/Ü/g, 'U').replace(/ü/g, 'U')
          .replace(/Ş/g, 'S').replace(/ş/g, 'S').replace(/Ö/g, 'O').replace(/ö/g, 'O')
          .replace(/Ç/g, 'C').replace(/ç/g, 'C')
          .toUpperCase()
          .replace(/[^A-Z0-9 ]/g, ' ') 
          .replace(/\s+/g, ' ')
          .trim();
          
      let withoutSuffix = cleaned.replace(/\b(LTD|STI|SAN|TIC|AS|A S|VE|LIMITED|SIRKETI|TICARET|ANONIM|SANAYI)\b/g, '').replace(/\s+/g, ' ').trim();
      return withoutSuffix.length > 2 ? withoutSuffix : cleaned;
  };

  const handleUploadPrepData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            
            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            
            // KURAL 1: Dinamik Sütun Tespiti
            let headerRowIdx = -1;
            let nameColIdx = -1;
            let countColIdx = -1;
            let dangerColIdx = -1;
            let sgkColIdx = -1;
            let extraColIdx = -1;
            let idColIdx = -1; // Kendi şablonumuz için geriye dönük uyumluluk

            for (let i = 0; i < Math.min(10, rawData.length); i++) {
                const row = rawData[i];
                if (!row) continue;
                for (let j = 0; j < row.length; j++) {
                    const cell = String(row[j] || "").toLowerCase().trim();
                    if (cell.includes("firma id")) {
                        idColIdx = j;
                    } 
                    if (cell.match(/(unvan|ünvan|firma adı|şirket adı|müşteri)/) && !cell.match(/(veren|adres|tel|mail|e-posta|tarih|süre|sektör|kod|no)/)) {
                        nameColIdx = j;
                    } 
                    if (cell.match(/(çalışan|personel|sayı)/) && !cell.match(/(görevlendirilen|tc|t\.c|kimlik|no|kod|tel|vergi|il|ilçe|ad soyad|onaylayan|tanımlayan)/)) {
                        countColIdx = j;
                    } 
                    if (cell.match(/(tehlike|sınıf|hazard)/) && !cell.match(/(tarih|süre|saat|kod)/)) {
                        dangerColIdx = j;
                    }
                    if (cell.match(/(sgk|detsis|sicil)/) && !cell.match(/(veren|tehlike|sınıf|tarih|süre)/)) {
                        sgkColIdx = j;
                    }
                    if (cell.match(/(ekstra|ek tutar|ilave tutar)/) && !cell.match(/(açıklama|not|oran)/)) {
                        extraColIdx = j;
                    }
                }
                // Minimum isim ve sayı bulduysak veya bizim kendi şablonumuzsa (Farklı sütunlarda olmalılar)
                if ((nameColIdx !== -1 && countColIdx !== -1 && nameColIdx !== countColIdx) || idColIdx !== -1) {
                    headerRowIdx = i;
                    break;
                }
            }

            if (headerRowIdx === -1) {
                alert("Excel'de gerekli sütunlar (Firma Adı ve Çalışan Sayısı) bulunamadı.");
                return;
            }

            const updates: Record<string, number> = {};
            const extraUpdates: Record<string, number> = {};
            const unmapped: any[] = [];
            const newUploadedIds: string[] = [];
            let matchedCount = 0;

            // 1. Önce Excel verisini kendi içinde grupla (SGK Sicil No bazlı gruplama)
            const aggregatedExcel: Record<string, { name: string, count: number, danger: string, maxCountForDanger: number, sgk: string, cleanSgk: string, extra?: number }> = {};

            for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;

                // Eski şablonumuz
                if (idColIdx !== -1) {
                    const id = row[idColIdx];
                    const countStr = String(row[countColIdx] || "").replace(/[^0-9]/g, '');
                    const count = Number(countStr);
                    
                    if (id && !isNaN(count)) {
                        updates[id] = count;
                        newUploadedIds.push(id);
                        matchedCount++;
                    }
                    continue;
                }

                // İSG Katip Tarzı Excel
                const rawName = String(row[nameColIdx] || "").trim();
                const rawCountStr = String(row[countColIdx] || "").replace(/[^0-9]/g, '');
                const rawCount = Number(rawCountStr);
                const rawDanger = dangerColIdx !== -1 ? String(row[dangerColIdx] || "").trim() : "";
                const rawSgk = sgkColIdx !== -1 ? String(row[sgkColIdx] || "").trim() : "";
                const cSgk = cleanSgk(rawSgk);
                const rawExtraStr = extraColIdx !== -1 ? String(row[extraColIdx] || "").replace(/[^0-9.,]/g, '').replace(',', '.') : '';
                const rawExtra = rawExtraStr ? Number(rawExtraStr) : 0;

                if (!rawName || isNaN(rawCount)) continue;

                // SGK numarası varsa temiz haliyle, yoksa isimle grupla
                const groupKey = cSgk ? `SGK_${cSgk}` : `NAME_${rawName.toUpperCase().replace(/\s+/g, ' ').trim()}`;

                if (!aggregatedExcel[groupKey]) {
                    aggregatedExcel[groupKey] = { name: rawName, count: rawCount, danger: rawDanger, maxCountForDanger: rawCount, sgk: rawSgk, cleanSgk: cSgk, extra: rawExtra };
                } else {
                    const existing = aggregatedExcel[groupKey];
                    // Excel'den gelen çalışan sayısı kabul edilir ve eski sayının yerine yazılır (üstüne ekleme yapılmaz)
                    existing.count = rawCount;
                    if (rawExtra > 0) {
                        existing.extra = rawExtra;
                    }
                    if (rawCount > existing.maxCountForDanger) {
                        existing.maxCountForDanger = rawCount;
                        if (existing.danger !== rawDanger) {
                            existing.danger = rawDanger;
                            existing.name = rawName;
                        }
                    }
                }
            }

            // 2. Şimdi veritabanı ile eşleştir: KESİNLİKLE SGK Sicil No ile eşleştirme yapılır!
            if (idColIdx === -1) {
                const ignoredSgks = new Set((db.getIgnoredSgkNumbers ? db.getIgnoredSgkNumbers() : []).map(cleanSgk));
                let unmappedIdx = 0;

                Object.values(aggregatedExcel).forEach((aggrItem) => {
                    // Eğer bu SGK kara listedeyse (bir daha sorma denildiyse), tamamen atla
                    if (aggrItem.cleanSgk && ignoredSgks.has(aggrItem.cleanSgk)) {
                        return;
                    }

                    const matchedFirm = matchFirmBySgk(aggrItem.sgk, firms);
                    if (matchedFirm) {
                        updates[matchedFirm.id] = aggrItem.count;
                        if (aggrItem.extra !== undefined && aggrItem.extra > 0) {
                            extraUpdates[matchedFirm.id] = aggrItem.extra;
                        }
                        if (!newUploadedIds.includes(matchedFirm.id)) {
                            newUploadedIds.push(matchedFirm.id);
                            matchedCount++;
                        }
                    } else {
                        unmapped.push({
                            index: unmappedIdx++,
                            name: aggrItem.name,
                            count: aggrItem.count,
                            danger: aggrItem.danger,
                            sgk: aggrItem.sgk,
                            cleanSgk: aggrItem.cleanSgk
                        });
                    }
                });
            }

            // State Güncelleme (Ezme İşlemi)
            setItems(prev => {
                const newItems = { ...prev };
                Object.keys(updates).forEach(id => {
                    newItems[id] = {
                        ...(newItems[id] || { firmId: id, currentEmployeeCount: 0, extraItemAmount: 0 }),
                        currentEmployeeCount: updates[id],
                        ...(extraUpdates[id] !== undefined ? { extraItemAmount: extraUpdates[id] } : {})
                    };
                });
                db.savePreparationItems(Object.values(newItems));
                return newItems;
            });
            setUploadedFirmIds(newUploadedIds);

            // Eşleşmeyenleri Askıya Al
            if (unmapped.length > 0) {
                setUnmatchedRows(unmapped);
                setSelectedMapping({});
                setUnmatchedPage(1);
                setShowUnmatchedModal(true);
            } else {
                alert(`${matchedCount} firmanın çalışan sayıları SGK sicil no ile eşleştirilerek güncellendi.`);
            }

        } catch (err) {
            console.error(err);
            alert("Excel dosyası okunamadı veya formatı desteklenmiyor.");
        }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleClearUploadFilter = () => {
      setUploadedFirmIds([]);
      setSearchTerm('');
  };

  const handleApplyUnmatched = async () => {
    try {
      const newUploads = [...uploadedFirmIds];
      const newUpdates: Record<string, number> = {};
      const itemsToCreate: UnmatchedQueueItem[] = [];

      for (let i = 0; i < unmatchedRows.length; i++) {
        const u = unmatchedRows[i];
        const action = selectedMapping[i] || '__SKIP__';

        if (action === '__SKIP__') {
          continue;
        }

        if (action === '__NEVER_ASK__') {
          const clean = u.cleanSgk || cleanSgk(u.sgk);
          if (clean && db.addIgnoredSgkNumber) {
            db.addIgnoredSgkNumber(clean);
          }
          continue;
        }

        if (action === '__CREATE__') {
          itemsToCreate.push({
            index: i,
            name: u.name,
            sgk: u.sgk,
            danger: u.danger,
            count: u.count,
            cleanSgk: u.cleanSgk || cleanSgk(u.sgk)
          });
          continue;
        }

        // Mevcut bir firmaya bağlama: action bir firmId'dir
        const targetFirmId = action;
        const existingFirm = firms.find(f => f.id === targetFirmId);
        if (existingFirm) {
          const cleanNew = cleanSgk(u.sgk);
          if (cleanNew) {
            if (!existingFirm.sgkNumber) {
              existingFirm.sgkNumber = u.sgk;
            } else {
              const parts = existingFirm.sgkNumber.split(',').map(s => cleanSgk(s));
              if (!parts.includes(cleanNew)) {
                existingFirm.sgkNumber += `, ${u.sgk}`;
              }
            }
            db.updateFirm(existingFirm);
          }
          newUpdates[targetFirmId] = u.count;
          if (!newUploads.includes(targetFirmId)) {
            newUploads.push(targetFirmId);
          }
        }
      }

      if (Object.keys(newUpdates).length > 0) {
        setItems(prev => {
          const updated = { ...prev };
          Object.keys(newUpdates).forEach(id => {
            updated[id] = {
              ...(updated[id] || { firmId: id, currentEmployeeCount: 0, extraItemAmount: 0 }),
              currentEmployeeCount: newUpdates[id]
            };
          });
          db.savePreparationItems(Object.values(updated));
          return updated;
        });
        setUploadedFirmIds(newUploads);
        setFirms(db.getFirms());
      }

      setShowUnmatchedModal(false);
      setUnmatchedRows([]);
      setSelectedMapping({});

      if (itemsToCreate.length > 0) {
        setSequentialQueue(itemsToCreate);
        setSequentialIndex(0);
        setShowSequentialModal(true);
      } else {
        alert("Eşleştirme ve güncelleme işlemleri tamamlandı.");
      }
    } catch (err: any) {
      console.error("Eşleştirme uygulama hatası:", err);
      alert("Hata oluştu: " + (err.message || err));
    }
  };

  // --- FATURA OLUŞTURMA YARDIMCISI ---
  const createTransactionRecord = async (firm: Firm, item: PreparationItem, financials: any) => {
    const date = new Date();
    const currentMonth = date.getMonth() + 1;
    const currentYear = date.getFullYear();

    // Çoklu Kullanıcı & Çift Fatura Önleme Kontrolü
    const currentTrans = db.getTransactions ? db.getTransactions() : [];
    const hasExistingDraft = currentTrans.some((t: any) => 
        t.firmId === firm.id && 
        t.type === TransactionType.INVOICE && 
        t.month === currentMonth && 
        t.year === currentYear && 
        t.status === 'PENDING'
    );
    if (hasExistingDraft) {
        alert(`${firm.name} için ${currentMonth}/${currentYear} dönemine ait bekleyen bir fatura taslağı zaten mevcut! Çift fatura oluşturulması engellendi.`);
        return false;
    }
    
    let description = `Hizmet Bedeli - ${date.toLocaleString('tr-TR', { month: 'long' })} ${date.getFullYear()}`;
    if (firm.serviceType === ServiceType.EXPERT_ONLY) {
        description = `İş Güvenliği Uzmanlığı Hizmeti - ${date.toLocaleString('tr-TR', { month: 'long' })} ${date.getFullYear()}`;
    } else if (firm.serviceType === ServiceType.DOCTOR_ONLY) {
        description = `İşyeri Hekimliği Hizmeti - ${date.toLocaleString('tr-TR', { month: 'long' })} ${date.getFullYear()}`;
    }

    // Eğer havuz ise açıklamaya not düş
    if (financials.poolDetails && financials.poolDetails.childCount > 0) {
        description += ` (Havuz Toplam: ${financials.poolDetails.totalCount} Kişi)`;
    }

    // Ana firma ve bağlı tüm şubelerin sağlık tetkik ID'lerini topla
    const allExtIds: string[] = [];
    if (item.externalHealthRecordIds && item.externalHealthRecordIds.length > 0) {
        allExtIds.push(...item.externalHealthRecordIds);
    }
    const children = firms.filter(f => f.parentFirmId === firm.id);
    children.forEach(child => {
        const childItem = items[child.id];
        if (childItem?.externalHealthRecordIds && childItem.externalHealthRecordIds.length > 0) {
            allExtIds.push(...childItem.externalHealthRecordIds);
        }
    });

    await db.addTransaction({
        firmId: firm.id,
        date: date.toISOString(),
        type: TransactionType.INVOICE,
        invoiceType: firm.defaultInvoiceType,
        description: description,
        debt: financials.grandTotal,
        credit: 0,
        month: currentMonth,
        year: currentYear,
        status: 'PENDING',
        calculatedDetails: {
            employeeCount: financials.poolDetails ? financials.poolDetails.totalCount : item.currentEmployeeCount,
            extraItemAmount: financials.netHealthShare, 
            expertShare: financials.netExpertShare, 
            doctorShare: financials.netDoctorShare,
            externalHealthRecordIds: allExtIds
        }
    });

    if (allExtIds.length > 0 && db.markExternalHealthServicesAsBilled) {
        db.markExternalHealthServicesAsBilled(allExtIds);
        
        // Ana firma ve bağlı şubelerin ekstra tutarını sıfırla
        setItems(prev => {
            const updated = { ...prev };
            updated[firm.id] = { ...(updated[firm.id] || item), extraItemAmount: 0, externalHealthRecordIds: [] };
            children.forEach(c => {
                if (updated[c.id]) {
                    updated[c.id] = { ...updated[c.id], extraItemAmount: 0, externalHealthRecordIds: [] };
                }
            });
            db.savePreparationItems(Object.values(updated));
            return updated;
        });
    }

    return true;
  };

  const handleInvoiceSingle = async (firmId: string) => {
      const firm = firms.find(f => f.id === firmId);
      if (!firm) return;
      
      const item = items[firmId] || { firmId, currentEmployeeCount: firm.basePersonLimit, extraItemAmount: 0 };
      const financials = calculateFinancials(firm, item);

      if (financials.isBranch) return alert("Bu bir şube firmasıdır. Fatura Ana Firma üzerinden kesilmelidir.");
      if (financials.grandTotal <= 0) return alert("Tutar 0 olduğu için fatura oluşturulamaz.");
      if (!window.confirm(`${firm.name} için ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(financials.grandTotal)} tutarında taslak fatura oluşturulsun mu?`)) return;

      const success = await createTransactionRecord(firm, item, financials);
      if (success) {
          alert("Fatura taslağı oluşturuldu ve kaydedildi.");
      }
  };

  const handleInvoiceAll = async () => {
      const targetFirms = filteredFirms;
      if (targetFirms.length === 0) return alert("Listede (veya seçili grupta) faturalaştırılacak firma yok.");
      
      const groupLabel = selectedGroup === 'ALL' 
          ? 'Tüm' 
          : selectedGroup === 'UNGROUPED' 
          ? 'Grupsuz' 
          : `"${selectedGroup}" grubundaki`;

      const uploadMsg = uploadedFirmIds.length > 0 ? " (Excel ile güncellenen)" : "";
      
      if (!window.confirm(`${groupLabel} ${targetFirms.length} firma için taslak fatura oluşturulacak.${uploadMsg} Devam edilsin mi?`)) return;

      const date = new Date();
      const currentMonth = date.getMonth() + 1;
      const currentYear = date.getFullYear();

      // Çoklu Kullanıcı Çakışma Önleme: Hali hazırda bu ay için bekleyen faturası olanları atla
      const existingTransactions = db.getTransactions ? db.getTransactions() : [];
      const pendingFirmIdsThisMonth = new Set(
          existingTransactions
              .filter((t: any) => t.type === TransactionType.INVOICE && t.month === currentMonth && t.year === currentYear && t.status === 'PENDING')
              .map((t: any) => t.firmId)
      );

      const newTransactions: Omit<Transaction, 'id'>[] = [];
      const extIdsToBill: string[] = [];
      const updatedPrepItems = { ...items };
      let skippedExistingCount = 0;

      targetFirms.forEach(firm => {
          if (pendingFirmIdsThisMonth.has(firm.id)) {
              skippedExistingCount++;
              return;
          }

          const item = items[firm.id] || { firmId: firm.id, currentEmployeeCount: firm.basePersonLimit, extraItemAmount: 0 };
          const financials = calculateFinancials(firm, item);
          if (!financials.isBranch && financials.grandTotal > 0) {
              let description = `Hizmet Bedeli - ${date.toLocaleString('tr-TR', { month: 'long' })} ${date.getFullYear()}`;
              if (firm.serviceType === ServiceType.EXPERT_ONLY) {
                  description = `İş Güvenliği Uzmanlığı Hizmeti - ${date.toLocaleString('tr-TR', { month: 'long' })} ${date.getFullYear()}`;
              } else if (firm.serviceType === ServiceType.DOCTOR_ONLY) {
                  description = `İşyeri Hekimliği Hizmeti - ${date.toLocaleString('tr-TR', { month: 'long' })} ${date.getFullYear()}`;
              }

              if (financials.poolDetails && financials.poolDetails.childCount > 0) {
                  description += ` (Havuz Toplam: ${financials.poolDetails.totalCount} Kişi)`;
              }

              // Ana firma ve şubelerinin tetkik ID'lerini topla
              const firmExtIds: string[] = [];
              if (item.externalHealthRecordIds && item.externalHealthRecordIds.length > 0) {
                  firmExtIds.push(...item.externalHealthRecordIds);
              }
              const children = firms.filter(f => f.parentFirmId === firm.id);
              children.forEach(child => {
                  const childItem = items[child.id];
                  if (childItem?.externalHealthRecordIds && childItem.externalHealthRecordIds.length > 0) {
                      firmExtIds.push(...childItem.externalHealthRecordIds);
                  }
                  if (updatedPrepItems[child.id]) {
                      updatedPrepItems[child.id] = {
                          ...updatedPrepItems[child.id],
                          extraItemAmount: 0,
                          externalHealthRecordIds: []
                      };
                  }
              });

              if (firmExtIds.length > 0) {
                  extIdsToBill.push(...firmExtIds);
              }
              if (updatedPrepItems[firm.id]) {
                  updatedPrepItems[firm.id] = {
                      ...updatedPrepItems[firm.id],
                      extraItemAmount: 0,
                      externalHealthRecordIds: []
                  };
              }

              newTransactions.push({
                  firmId: firm.id,
                  date: date.toISOString(),
                  type: TransactionType.INVOICE,
                  invoiceType: firm.defaultInvoiceType,
                  description: description,
                  debt: financials.grandTotal,
                  credit: 0,
                  month: currentMonth,
                  year: currentYear,
                  status: 'PENDING',
                  calculatedDetails: {
                      employeeCount: financials.poolDetails ? financials.poolDetails.totalCount : item.currentEmployeeCount,
                      extraItemAmount: financials.netHealthShare, 
                      expertShare: financials.netExpertShare, 
                      doctorShare: financials.netDoctorShare,
                      externalHealthRecordIds: firmExtIds
                  }
              });
          }
      });

      if (newTransactions.length > 0) {
          if (extIdsToBill.length > 0 && db.markExternalHealthServicesAsBilled) {
              db.markExternalHealthServicesAsBilled(extIdsToBill);
          }
          setItems(updatedPrepItems);
          db.savePreparationItems(Object.values(updatedPrepItems));

          // Toplu olarak atomic şekilde ekle ve doğrudan sunucuya yazılmasını bekle
          await db.addTransactionsBulk(newTransactions);

          let msg = `${newTransactions.length} adet fatura taslağı oluşturuldu ve kaydedildi.`;
          if (skippedExistingCount > 0) {
              msg += `\n(${skippedExistingCount} firmanın zaten bekleyen taslağı olduğu için mükerrer fatura önlendi).`;
          }
          alert(msg);
          navigate('/invoices');
      } else {
          if (skippedExistingCount > 0) {
              alert(`Seçilen firmaların tümünün (${skippedExistingCount} firma) bu ay için zaten bekleyen fatura taslağı mevcut.`);
          } else {
              alert("Oluşturulacak (tutarı 0'dan büyük ve ana firma olan) fatura bulunamadı.");
          }
      }
  };

const formatCurrency = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-yellow-500" /> Fatura Hazırlık
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            İSG çalışan sayılarını ve sağlık sevklerini belirleyin, tek seferde birleşik faturalandırın.
          </p>
        </div>
        <div>
          <button 
            onClick={handleInvoiceAll} 
            disabled={filteredFirms.length === 0}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <Save className="w-5 h-5" /> 
            {selectedGroup !== 'ALL' && selectedGroup !== 'UNGROUPED' 
              ? `3. "${selectedGroup}" Grubunu Faturalaştır (${filteredFirms.length})` 
              : selectedGroup === 'UNGROUPED'
              ? `3. Grupsuz Firmaları Faturalaştır (${filteredFirms.length})`
              : `3. Görünenleri Faturalaştır (${filteredFirms.length})`}
          </button>
        </div>
      </header>

<>
          {/* ARAÇ ÇUBUĞU */}
          <div className="flex flex-col gap-2.5 bg-slate-800 p-2.5 rounded-xl border border-slate-700 shadow-lg">
           {/* Üst Satır: Arama + Fatura Tipi Filtresi + Şablon & Yükle Butonları */}
           <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2">
                <div className="flex flex-col gap-2 flex-[2]">
                     <div className="flex flex-col md:flex-row gap-2">
                         <div className="relative flex-1">
                                 <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                 <input type="text" placeholder="Firma Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500" />
                         </div>
                         <div className="relative w-full md:w-48">
                             <Filter className="absolute left-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                             <select 
                                 value={filterType}
                                 onChange={(e) => setFilterType(e.target.value as any)}
                                 className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500 cursor-pointer appearance-none"
                             >
                                 <option value="ALL">Tüm Fatura Tipleri</option>
                                 <option value={InvoiceType.E_FATURA}>E-Faturalar</option>
                                 <option value={InvoiceType.E_ARSIV}>E-Arşivler</option>
                             </select>
                         </div>
                     </div>

                     {uploadedFirmIds.length > 0 && (
                         <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center gap-2 text-blue-400 text-sm">
                                 <ListFilter className="w-4 h-4" />
                                 <span>Excel'den yüklenen <b>{uploadedFirmIds.length}</b> firma görüntüleniyor.</span>
                             </div>
                             <button onClick={handleClearUploadFilter} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-600 flex items-center gap-1 transition-colors">
                                 <XCircle className="w-3 h-3" /> Filtreyi Temizle
                             </button>
                         </div>
                     )}
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-2 xl:justify-end flex-1">
                     <div className="relative flex-1 w-full sm:w-auto">
                         <input type="file" ref={fileInputRef} onChange={handleUploadPrepData} accept=".xlsx, .xls" className="hidden" />
                         <button 
                             type="button" 
                             onClick={() => fileInputRef.current?.click()} 
                             className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 border border-emerald-500 transition-colors shadow-sm"
                         >
                             <Upload className="w-4 h-4" /> 
                             <span>1. Excel Verisi Yükle</span>
                         </button>
                     </div>
                     <button 
                         type="button" 
                         onClick={handleDownloadUnifiedTemplate} 
                         className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-slate-600 shadow-sm"
                         title="İSG-Katip formatında örnek veri yükleme şablonu indir"
                     >
                         <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                         <span>Örnek İSG-Katip Şablonu</span>
                     </button>
                </div>
           </div>

           {/* Alt Satır: FİRMA GRUPLARI SEÇİCİ & YÖNETİMİ (Grup 1, Grup 2, +, ⚙️) */}
           <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mr-1 shrink-0">
                    <Folder className="w-4 h-4" />
                    <span>2. Grup Seç:</span>
                </div>

                {/* Tümü Butonu */}
                <button
                    type="button"
                    onClick={() => setSelectedGroup('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 border ${
                        selectedGroup === 'ALL'
                            ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-md shadow-blue-900/30'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                    <span>Tümü</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                        {firms.length}
                    </span>
                </button>

                {/* Dinamik Grup Butonları (Grup 1, Grup 2, ...) */}
                {groups.map(groupName => {
                    const count = firms.filter(f => f.group === groupName).length;
                    const isActive = selectedGroup === groupName;
                    return (
                        <button
                            key={groupName}
                            type="button"
                            onClick={() => setSelectedGroup(groupName)}
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 border ${
                                isActive
                                    ? 'bg-amber-600 text-white border-amber-500 font-bold shadow-md shadow-amber-900/30'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                            <span>{groupName}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-amber-800 text-amber-100' : 'bg-slate-800 text-slate-400'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}

                {/* Grupsuz Firmalar Butonu */}
                {firms.some(f => !f.group) && (
                    <button
                        type="button"
                        onClick={() => setSelectedGroup('UNGROUPED')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 border ${
                            selectedGroup === 'UNGROUPED'
                                ? 'bg-slate-700 text-white border-slate-500 font-bold'
                                : 'bg-slate-900/70 text-slate-400 border-slate-750 hover:text-slate-200'
                        }`}
                        title="Henüz bir gruba atanmamış firmalar"
                    >
                        <span>Grupsuz</span>
                        <span className="text-[10px] px-1.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                            {firms.filter(f => !f.group).length}
                        </span>
                    </button>
                )}

                {/* Hızlı Yeni Grup Ekle Butonu (+) */}
                <button
                    type="button"
                    onClick={() => {
                        const name = window.prompt("Yeni oluşturulacak grup adını giriniz (Örn: Grup 3, Organize Sanayi):");
                        if (name && name.trim()) {
                            const updated = db.addFirmGroup(name.trim());
                            setGroups(updated);
                            setSelectedGroup(name.trim());
                        }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
                    title="Yeni Grup Ekle (+)"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Yeni Grup</span>
                </button>

                {/* Grupları Düzenleme Çarkı (⚙️) */}
                <button
                    type="button"
                    onClick={() => setIsGroupModalOpen(true)}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 transition-colors flex items-center gap-1.5 text-xs font-semibold ml-auto"
                    title="Grupları Düzenle ve Firmaları Yönet (⚙️)"
                >
                    <Settings className="w-4 h-4 text-amber-400" />
                    <span>Grup Yönetimi</span>
                </button>
           </div>
      </div>

      {/* SEVK / TETKİK AKTARIM VE FATURAYA BAĞLAMA BARI */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/90 border border-slate-700 p-3 rounded-xl shadow-md">
          <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 shrink-0 text-slate-200">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold tracking-wide">Sağlık Sevkleri:</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                  <input 
                      type="date"
                      value={tetkikStartDate}
                      onChange={(e) => setTetkikStartDate(e.target.value)}
                      className="bg-transparent text-xs text-white outline-none cursor-pointer"
                      title="Başlangıç Tarihi"
                  />
                  <span className="text-slate-500 text-xs px-0.5">-</span>
                  <input 
                      type="date"
                      value={tetkikEndDate}
                      onChange={(e) => setTetkikEndDate(e.target.value)}
                      className="bg-transparent text-xs text-white outline-none cursor-pointer"
                      title="Bitiş Tarihi"
                  />
              </div>

              <div className="flex items-center gap-1">
                  <button 
                      type="button"
                      onClick={() => {
                          const now = new Date();
                          const y = now.getFullYear();
                          const m = String(now.getMonth() + 1).padStart(2, '0');
                          const lastD = String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0');
                          setTetkikStartDate(`${y}-${m}-01`);
                          setTetkikEndDate(`${y}-${m}-${lastD}`);
                      }}
                      className="text-[11px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1 rounded transition-colors"
                  >
                      Bu Ay
                  </button>
                  <button 
                      type="button"
                      onClick={() => {
                          const now = new Date();
                          const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                          const y = prev.getFullYear();
                          const m = String(prev.getMonth() + 1).padStart(2, '0');
                          const lastD = String(new Date(y, prev.getMonth() + 1, 0).getDate()).padStart(2, '0');
                          setTetkikStartDate(`${y}-${m}-01`);
                          setTetkikEndDate(`${y}-${m}-${lastD}`);
                      }}
                      className="text-[11px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1 rounded transition-colors"
                  >
                      Geçen Ay
                  </button>
              </div>

              <button
                  type="button"
                  disabled={isSyncingSevkler}
                  onClick={handleSyncSevkler}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all shrink-0"
              >
                  {isSyncingSevkler ? (
                      <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Aktarılıyor...</span>
                      </>
                  ) : (
                      <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Sevkleri Getir ve Faturaya Bağla</span>
                      </>
                  )}
              </button>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              {unmatchedCompanyGroups.length > 0 ? (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">
                      <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          <b>{unmatchedCompanyGroups.length}</b> firma ({unmatchedHealthRecords.length} sevk - {formatCurrency(unmatchedHealthTotal)}) eşleşme bekliyor
                      </span>
                      <button
                          type="button"
                          onClick={() => setShowUnmatchedHealthModal(true)}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2.5 py-0.5 rounded transition-colors shadow-sm"
                      >
                          Eşleştir
                      </button>
                  </div>
              ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                          {totalActiveHealthCount > 0 
                              ? `${totalActiveHealthCount} faturalı sevk hazır (${formatCurrency(totalActiveHealthTotal)})` 
                              : 'Tüm sevkler carilerle eşleştirildi'}
                      </span>
                  </div>
              )}
          </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-hidden">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700 text-[10px] sm:text-xs uppercase tracking-wider">
                <th className="p-2 text-slate-400 font-medium">Firma</th>
                <th className="p-2 text-slate-400 font-medium w-16 sm:w-24 text-center">Çalışan</th>
                <th className="p-2 text-slate-400 font-medium w-20 sm:w-32 text-center">Tip</th>
                <th className="p-2 text-slate-400 font-medium w-16 sm:w-24 text-center">Yıllık</th>
                <th className="p-2 text-slate-400 font-medium w-16 sm:w-24 text-center">Ekstra</th>
                <th className="p-2 text-slate-400 font-medium w-24 sm:w-32 text-right">Tutar</th>
                <th className="p-2 text-slate-400 font-medium w-10 sm:w-16 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 text-sm">
              {filteredFirms.map(firm => {
                try {
                    const item = items[firm.id];
                    const currentCount = item ? item.currentEmployeeCount : firm.basePersonLimit;
                    const extraAmount = item ? item.extraItemAmount : 0;
                    
                    const financials = calculateFinancials(firm, item);
                    
                    return (
                      <tr key={firm.id} className={`hover:bg-slate-700/50 transition-colors group ${financials.isBranch ? 'bg-slate-900/30' : ''}`}>
                    <td className="p-2 font-medium text-slate-200 overflow-hidden">
                        <div className="flex items-center gap-2 truncate">
                            {financials.isBranch && <Network className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 rotate-90" />}
                            <span className="truncate text-xs sm:text-sm" title={firm.name}>{firm.name}</span>
                            {firm.group && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0 font-medium">
                                    {firm.group}
                                </span>
                            )}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-500 flex items-center gap-1 sm:ml-6 mt-0.5 truncate">
                            {financials.isBranch ? 'Şube' : (
                                <>Limit: {firm.basePersonLimit} • Taban: {formatCurrency(firm.baseFee)}</>
                            )}
                            {firm.isKdvExcluded && <span className="ml-1 text-[8px] bg-yellow-500/20 text-yellow-500 px-1 rounded">+KDV</span>}
                            {firm.serviceType === ServiceType.EXPERT_ONLY && <span className="ml-1 text-[8px] bg-blue-500/20 text-blue-500 px-1 rounded">UZMAN</span>}
                            {firm.serviceType === ServiceType.DOCTOR_ONLY && <span className="ml-1 text-[8px] bg-purple-500/20 text-purple-500 px-1 rounded">HEKİM</span>}
                        </div>
                        {financials.poolDetails && financials.poolDetails.childCount > 0 && (
                            <div className="text-[9px] sm:text-[10px] text-emerald-400 sm:ml-6 mt-0.5 font-bold truncate">
                                {financials.poolDetails.childCount} Şube Toplamı
                            </div>
                        )}
                    </td>
                    <td className="p-2 text-center">
                        <input 
                            type="number" 
                            min="0"
                            value={currentCount} 
                            onChange={(e) => handleUpdate(firm.id, 'currentEmployeeCount', e.target.value)} 
                            className={`w-16 bg-slate-900 border ${currentCount > firm.basePersonLimit ? 'border-yellow-500 text-yellow-500' : 'border-slate-600 text-white'} rounded px-1 py-1 text-center outline-none focus:border-blue-500`} 
                        />
                    </td>
                    <td className="p-2 text-center">
                        {firm.defaultInvoiceType === InvoiceType.E_FATURA ? (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded border border-indigo-500/30">E-FATURA</span>
                        ) : (
                            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-1 rounded border border-orange-500/30">E-ARŞİV</span>
                        )}
                    </td>
                    <td className="p-2 text-center"><button className="text-slate-500 hover:text-purple-400 transition-colors"><CalendarCheck className="w-4 h-4"/></button></td>
                    <td className="p-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                            <input 
                                type="number" 
                                min="0" 
                                value={extraAmount} 
                                onChange={(e) => handleUpdate(firm.id, 'extraItemAmount', e.target.value)} 
                                className="w-16 bg-slate-900 border border-slate-600 rounded px-1 py-1 text-center text-white outline-none focus:border-blue-500" 
                                placeholder="0" 
                            />
                            {item?.externalHealthRecordIds && item.externalHealthRecordIds.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const extHealth = db.getExternalHealthServices ? db.getExternalHealthServices() : [];
                                        const recs = extHealth.filter((s: any) => item.externalHealthRecordIds?.includes(s.id));
                                        setSelectedTetkikDetailFirm({ firm, records: recs, grandTotal: Number(extraAmount) || 0 });
                                    }}
                                    className="text-[9px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium transition-colors cursor-pointer flex items-center gap-0.5" 
                                    title={`${item.externalHealthRecordIds.length} adet sevk tetkik tutarı (Detayları görmek için tıklayın)`}
                                >
                                    🩺 {item.externalHealthRecordIds.length} Sevk
                                </button>
                            )}
                        </div>
                    </td>
                    <td className="p-2 text-right font-bold text-blue-400 text-lg">
                        {financials.isBranch ? (
                            <span className="text-xs text-slate-500 font-normal italic">Ana Firmada</span>
                        ) : (
                            formatCurrency(financials.grandTotal)
                        )}
                        {!financials.isBranch && firm.isKdvExcluded && <div className="text-[9px] text-slate-500">KDV Dahil</div>}
                    </td>
                    <td className="p-2 text-center">
                        {!financials.isBranch && (
                            <button 
                                onClick={() => handleInvoiceSingle(firm.id)} 
                                className="p-2 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors shadow-sm"
                                title="Bu firmayı faturalaştır"
                            >
                                <ArrowRight className="w-5 h-5"/>
                            </button>
                        )}
                    </td>
                  </tr>
                );
              } catch (e: any) {
                  return (
                      <tr key={firm.id} className="bg-rose-900/20">
                          <td colSpan={7} className="p-2 text-rose-500 font-mono text-xs">
                              <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Firma hesaplanırken hata oluştu: {firm.name} - {e.message}</div>
                          </td>
                      </tr>
                  );
              }
              })}
              {filteredFirms.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
        </>

      {/* KURAL 5: EŞLEŞMEYENLER MODALI */}
      {showUnmatchedModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden">
                  {/* Başlık */}
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
                      <div>
                          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                              <AlertCircle className="w-6 h-6 text-amber-400" />
                              <span>Eşleşmeyen SGK Sicil Numaraları ({unmatchedRows.length} Firma)</span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                              Excel'deki bu firmalar SGK sicil no ile sistemdeki kayıtlarla eşleşmedi. Her biri için işlem seçin:
                          </p>
                      </div>
                      <button 
                          onClick={() => setShowUnmatchedModal(false)}
                          className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                          <XCircle className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Hızlı İşlem Araç Çubuğu */}
                  <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-slate-400">
                          Toplam <b>{unmatchedRows.length}</b> kayıt bekliyor.
                      </div>
                      <div className="flex items-center gap-2">
                          <button
                              type="button"
                              onClick={() => {
                                  const allSkip: Record<number, string> = {};
                                  unmatchedRows.forEach((_, idx) => allSkip[idx] = '__SKIP__');
                                  setSelectedMapping(allSkip);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                          >
                              Tümünü Bu Ay Atla
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                  const allCreate: Record<number, string> = {};
                                  unmatchedRows.forEach((_, idx) => allCreate[idx] = '__CREATE__');
                                  setSelectedMapping(allCreate);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white font-medium transition-colors"
                          >
                              Tümünü Yeni Firma Olarak Ekle
                          </button>
                      </div>
                  </div>

                  {/* Satırlar */}
                  <div className="p-5 overflow-y-auto flex-1 space-y-3">
                      {unmatchedRows.slice((unmatchedPage - 1) * unmatchedItemsPerPage, unmatchedPage * unmatchedItemsPerPage).map((u, relIdx) => {
                          const idx = (unmatchedPage - 1) * unmatchedItemsPerPage + relIdx;
                          const currentAction = selectedMapping[idx] || '__SKIP__';

                          return (
                              <div 
                                  key={idx} 
                                  className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row gap-3 justify-between items-start md:items-center ${
                                      currentAction === '__CREATE__'
                                          ? 'bg-emerald-950/20 border-emerald-500/40'
                                          : currentAction === '__NEVER_ASK__'
                                          ? 'bg-rose-950/20 border-rose-500/30'
                                          : currentAction !== '__SKIP__'
                                          ? 'bg-blue-950/20 border-blue-500/40'
                                          : 'bg-slate-800/80 border-slate-700'
                                  }`}
                              >
                                  <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-slate-100 truncate flex items-center gap-2">
                                          <span>{u.name}</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                                          <span className="font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60 text-slate-300">
                                              SGK: <b>{u.sgk || 'Yok'}</b>
                                          </span>
                                          <span>Çalışan: <b className="text-blue-400 font-mono">{u.count}</b></span>
                                          <span>Sınıf: <b className="text-slate-300">{u.danger || 'Belirtilmemiş'}</b></span>
                                      </div>
                                  </div>

                                  <div className="w-full md:w-auto shrink-0 flex items-center gap-2">
                                      <select
                                          value={currentAction}
                                          onChange={(e) => setSelectedMapping(prev => ({ ...prev, [idx]: e.target.value }))}
                                          className="bg-slate-900 border border-slate-600 text-xs rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 w-full md:w-72"
                                      >
                                          <option value="__SKIP__">⏭️ Bu Ay Atla (İşlem Yapma)</option>
                                          <option value="__CREATE__">➕ Yeni Firma Ekle (Sıralı Kayıt)</option>
                                          <option value="__NEVER_ASK__">🚫 Bu Firmayı Bir Daha Sorma (Kara Liste)</option>
                                          <optgroup label="── Mevcut Firmaya Bağla ──">
                                              {firms.filter(f => !f.parentFirmId).sort((a,b) => a.name.localeCompare(b.name, 'tr')).map(f => (
                                                  <option key={f.id} value={f.id}>
                                                      🔗 {f.name} {f.sgkNumber ? `(Sicil: ${f.sgkNumber})` : '(Sicil Yok)'}
                                                  </option>
                                              ))}
                                          </optgroup>
                                      </select>
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  {/* Sayfalama */}
                  {unmatchedRows.length > unmatchedItemsPerPage && (
                      <div className="flex items-center justify-between px-5 py-3 bg-slate-950/50 border-t border-slate-800 text-xs">
                          <span className="text-slate-400">
                              Sayfa {unmatchedPage} / {Math.ceil(unmatchedRows.length / unmatchedItemsPerPage)}
                          </span>
                          <div className="flex gap-2">
                              <button
                                  type="button"
                                  onClick={() => setUnmatchedPage(p => Math.max(1, p - 1))}
                                  disabled={unmatchedPage === 1}
                                  className="px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-40"
                              >
                                  Önceki
                              </button>
                              <button
                                  type="button"
                                  onClick={() => setUnmatchedPage(p => Math.min(Math.ceil(unmatchedRows.length / unmatchedItemsPerPage), p + 1))}
                                  disabled={unmatchedPage === Math.ceil(unmatchedRows.length / unmatchedItemsPerPage)}
                                  className="px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-40"
                              >
                                  Sonraki
                              </button>
                          </div>
                      </div>
                  )}

                  {/* Alt Butonlar */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center gap-3">
                      <button
                          type="button"
                          onClick={() => setShowUnmatchedModal(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                          Kapat
                      </button>
                      <button
                          type="button"
                          onClick={handleApplyUnmatched}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-900/30 flex items-center gap-2"
                      >
                          <CheckCircle className="w-4 h-4" />
                          <span>Seçimleri Onayla ve Uygula</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* SIRALI YENİ FİRMA KAYIT MODALI */}
      <SequentialFirmModal
          isOpen={showSequentialModal}
          queue={sequentialQueue}
          currentIndex={sequentialIndex}
          firmGroups={groups}
          defaultGroup={selectedGroup !== 'ALL' && selectedGroup !== 'UNGROUPED' ? selectedGroup : undefined}
          globalSettings={globalSettings}
          onSaveCurrent={(createdFirm, employeeCount) => {
              setItems(prev => {
                  const updated = {
                      ...prev,
                      [createdFirm.id]: {
                          firmId: createdFirm.id,
                          currentEmployeeCount: employeeCount,
                          extraItemAmount: 0
                      }
                  };
                  db.savePreparationItems(Object.values(updated));
                  return updated;
              });
              setUploadedFirmIds(prev => prev.includes(createdFirm.id) ? prev : [...prev, createdFirm.id]);
              setFirms(db.getFirms());

              if (sequentialIndex + 1 < sequentialQueue.length) {
                  setSequentialIndex(sequentialIndex + 1);
              } else {
                  setShowSequentialModal(false);
                  setSequentialQueue([]);
                  alert("Tüm firmalar başarıyla sisteme kaydedildi ve çalışan sayıları hazırlandı.");
              }
          }}
          onSkipCurrent={() => {
              if (sequentialIndex + 1 < sequentialQueue.length) {
                  setSequentialIndex(sequentialIndex + 1);
              } else {
                  setShowSequentialModal(false);
                  setSequentialQueue([]);
              }
          }}
          onClose={() => {
              setShowSequentialModal(false);
              setSequentialQueue([]);
          }}
      />

      {/* SEVK / TETKİK CARİ EŞLEŞTİRME MODALI (FİRMA BAZLI) */}
      {showUnmatchedHealthModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[88vh] overflow-hidden">
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
                      <div>
                          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                              <span>Tetkik / Sevk Firma Eşleştirmesi</span>
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                              Seçilen dönemde Tetkik Takip sisteminden gelen <b>{unmatchedCompanyGroups.length}</b> firmanın ({unmatchedHealthRecords.length} sevk) Fatura Takip cari karşılığı henüz belirlenmedi. Lütfen eşleştirmeyi yapın:
                          </p>
                      </div>
                      <button 
                          onClick={() => setShowUnmatchedHealthModal(false)} 
                          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                          <XCircle className="w-5 h-5" />
                      </button>
                  </div>

                  <div className="p-5 overflow-y-auto flex-1 space-y-3">
                      {unmatchedCompanyGroups.map((group) => {
                          const isAssigned = Boolean(selectedHealthMapping[group.companyName]);
                          const isIgnored = selectedHealthMapping[group.companyName] === 'IGNORE';
                          const sampleEmployees = group.referrals.slice(0, 3).map(r => r.employeeName).filter(Boolean);

                          return (
                              <div 
                                  key={group.companyName} 
                                  className={`p-3.5 rounded-xl border transition-all ${
                                      isIgnored 
                                          ? 'bg-slate-900/50 border-slate-800 opacity-60' 
                                          : isAssigned 
                                              ? 'bg-slate-800/80 border-emerald-500/40 shadow-sm' 
                                              : 'bg-slate-800/50 border-amber-500/30'
                                  }`}
                              >
                                  <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                                      <div className="space-y-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                                              <span className="text-sm font-bold text-slate-100 truncate" title={group.companyName}>
                                                  {group.companyName}
                                              </span>
                                              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-semibold">
                                                  {formatCurrency(group.totalAmount)}
                                              </span>
                                              <span className="text-[11px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                                  {group.referrals.length} Sevk
                                              </span>
                                          </div>
                                          {sampleEmployees.length > 0 && (
                                              <div className="text-[11px] text-slate-400">
                                                  Çalışanlar: <span className="text-slate-300">{sampleEmployees.join(', ')}</span>
                                                  {group.referrals.length > 3 && ` (+${group.referrals.length - 3} kişi daha)`}
                                              </div>
                                          )}
                                      </div>

                                      <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
                                          <select 
                                              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 w-full sm:w-72"
                                              value={selectedHealthMapping[group.companyName] || ""}
                                              onChange={(e) => setSelectedHealthMapping(prev => ({ ...prev, [group.companyName]: e.target.value }))}
                                          >
                                              <option value="">-- Fatura Takip Cari Firmasını Seçin --</option>
                                              <option value="IGNORE">🚫 Bu Firmayı Atla (Faturaya Dahil Etme)</option>
                                              <optgroup label="Kayıtlı Firmalar">
                                                  {firms.filter(f => !f.parentFirmId).sort((a,b) => a.name.localeCompare(b.name, 'tr')).map(f => (
                                                      <option key={f.id} value={f.id}>{f.name}</option>
                                                  ))}
                                              </optgroup>
                                          </select>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-950/60">
                      <span className="text-xs text-slate-400 text-center sm:text-left">
                          * Yapılan eşleştirmeler kalıcı olarak kaydedilir, sonraki aylarda tekrar sorulmaz.
                      </span>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button 
                              onClick={() => setShowUnmatchedHealthModal(false)} 
                              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                          >
                              İptal
                          </button>
                          <button 
                              onClick={handleSaveHealthMappings}
                              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
                          >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Eşleştirmeleri Kaydet ve Aktar</span>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Firma Grupları Yönetim Modalı */}
      <GroupManagerModal
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          onGroupsUpdated={() => {
              setGroups(db.getFirmGroups());
              setFirms(db.getFirms());
          }}
      />

      {/* SEVK DETAYLARI MODALI */}
      {selectedTetkikDetailFirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-emerald-400" />
                  <span>{selectedTetkikDetailFirm.firm.name} - Sevk Detayları</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bu firmaya ait toplam <b>{selectedTetkikDetailFirm.records.length}</b> adet sevk kaydı listeleniyor.
                </p>
              </div>
              <button
                onClick={() => setSelectedTetkikDetailFirm(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2">
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
                {selectedTetkikDetailFirm.records.map((rec: any, idx: number) => {
                  const dateStr = rec.date ? new Date(rec.date).toLocaleDateString('tr-TR') : '-';
                  const exams = Array.isArray(rec.exams) ? rec.exams : [];

                  return (
                    <div key={rec.id || idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                          <span className="text-sm font-semibold text-slate-200">
                            {rec.employeeName || 'İsimsiz Çalışan'}
                          </span>
                          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {dateStr}
                          </span>
                        </div>
                        {exams.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {exams.map((ex: any, eIdx: number) => {
                              const name = typeof ex === 'string' ? ex : (ex.name || ex.examName || 'Tetkik');
                              return (
                                <span key={eIdx} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700/60">
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {formatCurrency(Number(rec.amount) || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Toplam: <b className="text-white font-mono">{selectedTetkikDetailFirm.records.length} Sevk</b>
                </span>
                <span className="text-xs text-slate-400">
                  Fatura Tutarı: <b className="text-emerald-400 font-mono text-base">{formatCurrency(selectedTetkikDetailFirm.grandTotal)}</b>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTetkikDetailFirm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Kapat
                </button>
                <div className="text-xs text-slate-400 italic">
                  * Bu sevkler firmanın ana faturası kesildiğinde otomatik olarak faturaya bağlanır.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Preparation;
