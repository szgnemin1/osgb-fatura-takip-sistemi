
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/db';
import { Firm, PreparationItem, TransactionType, GlobalSettings, InvoiceType, PricingModel, ServiceType } from '../types';
import { Calculator, Save, ArrowRight, Upload, Search, CalendarCheck, Filter, FileSpreadsheet, XCircle, ListFilter, AlertCircle, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const Preparation = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [firms, setFirms] = useState<Firm[]>([]);
  const [items, setItems] = useState<Record<string, PreparationItem>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  
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

  useEffect(() => {
    const loadData = async () => {
        // Veri App.tsx tarafından db_updated ile zaten güncellenir. Sadece localden okuyoruz.
        const f = db.getFirms();
        setFirms(f);
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

        // Her sağlık kaydını ait olduğu firmaya ata (Sadece onaylı eşleşmeler; otomatik tahmin yapılmaz)
        const firmHealthRecordsMap: Record<string, any[]> = {};
        const unmatchedHealthList: any[] = [];

        unbilledHealthRecords.forEach((s: any) => {
            // Kullanıcı bu tetkik firmasını "Bu Firmayı Atla" (IGNORE / __SKIP__) yaptıysa faturaya dahil edilmez
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
          // Bulunan ekstra tutarları topla (Sevk Sisteminden Gelen Fatura Kesilecekler)
          const unbilledForFirm = firmHealthRecordsMap[firm.id] || [];
          const totalHealthDebt = unbilledForFirm.reduce((acc: number, curr:any) => acc + (Number(curr.amount) || 0), 0);
          const extIds = unbilledForFirm.map((s:any) => s.id);

          const existing = saved.find((s: any) => s && s.firmId === firm.id);
          
          let finalExtraAmount = 0;
          if (existing && existing.extraItemAmount !== undefined) {
              finalExtraAmount = Math.max(Number(existing.extraItemAmount) || 0, totalHealthDebt);
          } else {
              finalExtraAmount = totalHealthDebt;
          }

          initialItems[firm.id] = { 
            firmId: firm.id, 
            currentEmployeeCount: existing ? existing.currentEmployeeCount : (Number(firm.basePersonLimit) || 0), 
            extraItemAmount: finalExtraAmount, 
            addYearlyFee: existing ? existing.addYearlyFee : false,
            externalHealthRecordIds: extIds
          };
        });
        setItems(initialItems);
    };
    loadData();
    const unsubscribe = db.subscribe(() => {
        loadData();
    });
    return () => unsubscribe();
  }, []);

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
    return matchesSearch && matchesType && matchesUpload;
  });

  // --- EXCEL ŞABLON İNDİR ---
  const handleDownloadPrepTemplate = (targetType: InvoiceType) => {
    const firmsToExport = firms.filter(f => f.defaultInvoiceType === targetType);
    if (firmsToExport.length === 0) {
        alert(`Bu tipte (${targetType}) kayıtlı firma bulunamadı.`);
        return;
    }
    const data = firmsToExport.map(f => ({
        "Firma ID (DOKUNMAYIN)": f.id,
        "Firma Adı": f.name,
        "Fatura Tipi": f.defaultInvoiceType,
        "Mevcut Limit": f.basePersonLimit,
        "Çalışan Sayısı (GİRİNİZ)": items[f.id]?.currentEmployeeCount || f.basePersonLimit,
        "Ekstra Tutar (GİRİNİZ)": items[f.id]?.extraItemAmount || 0
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const fileName = targetType === InvoiceType.E_FATURA ? 'E-Fatura_Hazirlik_Sablonu' : 'E-Arsiv_Hazirlik_Sablonu';
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hazirlik_Listesi");
    XLSX.writeFile(workbook, `${fileName}_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
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

  const matchFirm = (excelName: string, excelDangerClass: string, excelSgk?: string) => {
      const hasSgk = (dbSgk: string | undefined, search: string) => {
          if (!dbSgk) return false;
          return dbSgk.split(',').map(s => s.trim()).includes(search.trim());
      };

      // 0. SGK ile Mükemmel Eşleşme
      if (excelSgk) {
          const sgkMatch = firms.find(f => hasSgk(f.sgkNumber, excelSgk));
          if (sgkMatch) return sgkMatch;
      }

      const cleanedExcel = cleanCompanyName(excelName);
      if (!cleanedExcel || cleanedExcel.length < 3) return null;

      // 1. Tam Eşleşme
      let matches = firms.filter(f => {
          const fClean = cleanCompanyName(f.name);
          if (fClean === cleanedExcel) {
              if (excelSgk && f.sgkNumber && !hasSgk(f.sgkNumber, excelSgk)) return false;
              return true;
          }
          return false;
      });
      
      // 2. Tehlike Sınıfı Filtresi
      if (matches.length > 1 && excelDangerClass) {
          const dangerFiltered = matches.filter(f => {
              const dbDanger = (f.dangerClass || '').toLowerCase();
              const xlDanger = excelDangerClass.toLowerCase();
              return dbDanger.includes(xlDanger) || xlDanger.includes(dbDanger);
          });
          if (dangerFiltered.length > 0) matches = dangerFiltered;
      }

      if (matches.length === 1) return matches[0];

      // 3. Güvenli Kısmi Eşleşme (Altküme Kesişimi)
      if (cleanedExcel.length >= 4) {
          const excelTokens = cleanedExcel.split(' ');
          let bestMatch = null;
          let maxDbTokenCount = 0;

          for (const f of firms) {
              if (excelSgk && f.sgkNumber && !hasSgk(f.sgkNumber, excelSgk)) continue;

              const fClean = cleanCompanyName(f.name);
              if (fClean.length >= 4) {
                  const dbTokens = fClean.split(' ');
                  
                  // dbTokens içindeki HER kelimenin, excelTokens içinde tam veya başlangıç olarak geçmesi gerekir
                  const isSubset = dbTokens.every(dt => 
                      dt.length >= 3 && excelTokens.some(et => et === dt || et.startsWith(dt))
                  );

                  if (isSubset) {
                      let isValid = true;
                      
                      // Eğer iki tarafın da tehlike sınıfı varsa uyuştuğundan emin ol (farklıysa eşleşme iptal)
                      if (excelDangerClass && f.dangerClass) {
                          const dbDanger = f.dangerClass.toLowerCase();
                          const xlDanger = excelDangerClass.toLowerCase();
                          if (!dbDanger.includes(xlDanger) && !xlDanger.includes(dbDanger)) {
                              isValid = false;
                          }
                      }

                      if (isValid) {
                          // Eğer birden fazla altküme eşleşmesi varsa, daha uzun kelime sayısına sahip olanı seç (daha spesifik olan)
                          if (dbTokens.length > maxDbTokenCount) {
                              maxDbTokenCount = dbTokens.length;
                              bestMatch = f;
                          }
                      }
                  }
              }
          }
          if (bestMatch) return bestMatch;
      }

      return null;
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
                    if (cell.match(/(sgk|detsis|sicil)/) && !cell.match(/(tehlike|sınıf|tarih|süre)/)) {
                        sgkColIdx = j;
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
            const unmapped: any[] = [];
            const newUploadedIds: string[] = [];
            let matchedCount = 0;

            // 1. Önce Excel verisini kendi içinde grupla (Şube Birleştirme Mantığı)
            const aggregatedExcel: Record<string, { name: string, count: number, danger: string, maxCountForDanger: number }> = {};

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

                if (!rawName || isNaN(rawCount)) continue;

                // EĞER SGK numarası varsa onunla, yoksa tam şirket isminin büyük harf haliyle grupla (Asla eksik/kırpılmış isimle gruplama!)
                const groupKey = rawSgk ? `SGK_${rawSgk}` : `NAME_${rawName.toUpperCase().replace(/\s+/g, ' ').trim()}`;

                if (!aggregatedExcel[groupKey]) {
                    aggregatedExcel[groupKey] = { name: rawName, count: rawCount, danger: rawDanger, maxCountForDanger: rawCount, sgk: rawSgk };
                } else {
                    const existing = aggregatedExcel[groupKey];
                    existing.count += rawCount; // Çalışan sayısını topla
                    
                    // Tehlike sınıfı farklıysa şube mantığı (az olanı çok olana bağla)
                    if (existing.danger !== rawDanger) {
                        if (rawCount > existing.maxCountForDanger) {
                            existing.danger = rawDanger;
                            existing.maxCountForDanger = rawCount;
                            existing.name = rawName; // Çok olanın ismini baz al
                        }
                    } else {
                        if (rawCount > existing.maxCountForDanger) {
                            existing.maxCountForDanger = rawCount;
                        }
                    }
                }
            }

            // 2. Şimdi gruplanmış ve birleştirilmiş verileri veritabanı ile eşleştir
            if (idColIdx === -1) {
                Object.values(aggregatedExcel).forEach((aggrItem, idx) => {
                    const matchedFirm = matchFirm(aggrItem.name, aggrItem.danger, aggrItem.sgk);
                    if (matchedFirm) {
                        if (updates[matchedFirm.id] === undefined) updates[matchedFirm.id] = 0;
                        updates[matchedFirm.id] += aggrItem.count;
                        if (!newUploadedIds.includes(matchedFirm.id)) {
                            newUploadedIds.push(matchedFirm.id);
                            matchedCount++;
                        }
                    } else {
                        unmapped.push({ index: idx, name: aggrItem.name, count: aggrItem.count, danger: aggrItem.danger, sgk: aggrItem.sgk });
                    }
                });
            }

            // State Güncelleme (Ezme İşlemi)
            setItems(prev => {
                const newItems = { ...prev };
                Object.keys(updates).forEach(id => {
                    newItems[id] = {
                        ...(newItems[id] || { firmId: id, currentEmployeeCount: 0, extraItemAmount: 0 }),
                        currentEmployeeCount: updates[id]
                    };
                });
                return newItems;
            });
            setUploadedFirmIds(newUploadedIds);

            // KURAL 5: Eşleşmeyenleri Askıya Al
            if (unmapped.length > 0) {
                setUnmatchedRows(unmapped);
                setUnmatchedPage(1);
                setShowUnmatchedModal(true);
            } else {
                alert(`${matchedCount} firmanın çalışan sayıları excel'den alınarak güncellendi.`);
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
      if (targetFirms.length === 0) return alert("Listede (veya filtrede) firma yok.");
      
      const filterMsg = uploadedFirmIds.length > 0 ? "EXCEL İLE GÜNCELLENEN" : (filterType === 'ALL' ? 'TÜM' : filterType);
      
      if (!window.confirm(`${targetFirms.length} adet ${filterMsg} firma için taslak fatura oluşturulacak. Devam edilsin mi?`)) return;

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
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-100 flex items-center gap-3"><Calculator className="w-8 h-8 text-yellow-500" /> Fatura Hazırlık</h2>
          <p className="text-slate-400 mt-2 text-sm">Çalışan sayılarını girin. <span className="text-blue-400 font-bold">Havuz (Şube)</span> firmaları <span className="text-yellow-400 font-bold">ayrı ayrı hesaplanıp</span> ana firmada toplanır.</p>
        </div>
        <button onClick={handleInvoiceAll} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"><Save className="w-5 h-5" /> Görünenleri Faturalaştır</button>
      </header>
      
      {/* ARAÇ ÇUBUĞU */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-lg">
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
                            <option value="ALL">Tümü</option>
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
           
           <div className="flex flex-col md:flex-row gap-2 xl:justify-end flex-1">
                <button onClick={() => handleDownloadPrepTemplate(InvoiceType.E_FATURA)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-indigo-500"><FileSpreadsheet className="w-4 h-4" /> E-Fatura Şablon</button>
                <button onClick={() => handleDownloadPrepTemplate(InvoiceType.E_ARSIV)} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-orange-500"><FileSpreadsheet className="w-4 h-4" /> E-Arşiv Şablon</button>
                <div className="relative flex-1">
                    <input type="file" ref={fileInputRef} onChange={handleUploadPrepData} accept=".xlsx, .xls" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full h-full bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 border border-slate-600 transition-colors"><Upload className="w-4 h-4" /> Veri Yükle</button>
                </div>
           </div>
      </div>

      {/* EŞLEŞMEYEN SEVK TETKİKLERİ BİLDİRİM ÇUBUĞU */}
      {unmatchedHealthRecords.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                      <b>{unmatchedHealthRecords.length}</b> adet sevk tetkiki sistemdeki firmalarla henüz eşleştirilmedi 
                      ({formatCurrency(unmatchedHealthRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}).
                  </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                  <button 
                      type="button" 
                      onClick={() => setShowUnmatchedHealthModal(true)}
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                      Firmaya Ata
                  </button>
              </div>
          </div>
      )}

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
                                <span 
                                    className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded font-mono font-medium" 
                                    title={`${item.externalHealthRecordIds.length} adet sevk tetkik tutarı`}
                                >
                                    🩺 {item.externalHealthRecordIds.length} Sevk
                                </span>
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

      {/* KURAL 5: EŞLEŞMEYENLER MODALI */}
      {showUnmatchedModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2">
              <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
                      <div>
                          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                              <AlertCircle className="w-6 h-6 text-yellow-500" /> Eşleşmeyenler Listesi
                          </h3>
                          <p className="text-sm text-slate-400 mt-1">
                              Şu {unmatchedRows.length} firmayı sistemde bulamadım, bunları sisteme yeni firma olarak mı kaydedeyim yoksa senin seçeceğin mevcut bir firmaya mı atayayım?
                          </p>
                      </div>
                      <button onClick={() => setShowUnmatchedModal(false)} className="text-slate-500 hover:text-white transition-colors">
                          <XCircle className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                      {unmatchedRows.slice((unmatchedPage - 1) * unmatchedItemsPerPage, unmatchedPage * unmatchedItemsPerPage).map((u, relativeIdx) => {
                          const idx = (unmatchedPage - 1) * unmatchedItemsPerPage + relativeIdx;
                          return (
                          <div key={idx} className="bg-slate-900 border border-slate-700 p-2 rounded-lg flex flex-col md:flex-row gap-2 justify-between items-start md:items-center">
                              <div>
                                  <div className="text-sm font-bold text-slate-200">{u.name}</div>
                                  <div className="text-xs text-slate-400 mt-1">Excel Çalışan: <span className="text-blue-400 font-bold">{u.count}</span> • Sınıf: {u.danger || 'Belirtilmemiş'}</div>
                              </div>
                              <div className="flex items-center gap-2 w-full md:w-auto">
                                  <select 
                                      className="bg-slate-800 border border-slate-600 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 w-full md:w-48"
                                      value={selectedMapping[idx] || ""}
                                      onChange={(e) => setSelectedMapping(prev => ({...prev, [idx]: e.target.value}))}
                                  >
                                      <option value="">-- Yeni Firma Oluştur --</option>
                                      {firms.map(f => (
                                          <option key={f.id} value={f.id}>{f.name}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>
                          );
                      })}
                  </div>

                  {unmatchedRows.length > unmatchedItemsPerPage && (
                      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/50 border-t border-slate-700">
                          <span className="text-sm text-slate-400">
                              Toplam {unmatchedRows.length} kayıt. Sayfa {unmatchedPage} / {Math.ceil(unmatchedRows.length / unmatchedItemsPerPage)}
                          </span>
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => setUnmatchedPage(p => Math.max(1, p - 1))}
                                  disabled={unmatchedPage === 1}
                                  className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  Önceki
                              </button>
                              <button 
                                  onClick={() => setUnmatchedPage(p => Math.min(Math.ceil(unmatchedRows.length / unmatchedItemsPerPage), p + 1))}
                                  disabled={unmatchedPage === Math.ceil(unmatchedRows.length / unmatchedItemsPerPage)}
                                  className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  Sonraki
                              </button>
                          </div>
                      </div>
                  )}

                  <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50 rounded-b-xl">
                      <button onClick={() => setShowUnmatchedModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Vazgeç & Kapat</button>
                      <button 
                          onClick={() => {
                              const newFirms: Firm[] = [];
                              const newUpdates: Record<string, number> = {};
                              const newUploads = [...uploadedFirmIds];

                              unmatchedRows.forEach((u, idx) => {
                                  const targetFirmId = selectedMapping[idx];
                                  if (targetFirmId) {
                                      // Mevcut firmaya eşleştir
                                      if (newUpdates[targetFirmId] === undefined) {
                                          newUpdates[targetFirmId] = (items[targetFirmId]?.currentEmployeeCount || 0);
                                      }
                                      newUpdates[targetFirmId] += u.count;
                                      if (!newUploads.includes(targetFirmId)) newUploads.push(targetFirmId);
                                      
                                      // SGK Numarasını firmaya ekle (Bir sonraki ay sormaması için)
                                      if (u.sgk) {
                                          const existingFirm = firms.find(f => f.id === targetFirmId);
                                          if (existingFirm) {
                                              if (!existingFirm.sgkNumber) {
                                                  existingFirm.sgkNumber = u.sgk;
                                                  db.updateFirm(existingFirm);
                                              } else {
                                                  const existingSgks = existingFirm.sgkNumber.split(',').map(s => s.trim());
                                                  if (!existingSgks.includes(u.sgk.trim())) {
                                                      existingFirm.sgkNumber += `, ${u.sgk.trim()}`;
                                                      db.updateFirm(existingFirm);
                                                  }
                                              }
                                          }
                                      }
                                  } else {
                                      // Yeni firma oluştur
                                      const newFirm = db.addFirm({
                                          name: u.name,
                                          dangerClass: u.danger,
                                          sgkNumber: u.sgk || '',
                                          basePersonLimit: u.count,
                                          baseFee: 1000, // Varsayılan ücret, kullanıcı sonra değiştirir
                                          extraPersonFee: 50,
                                          expertPercentage: globalSettings?.expertPercentage || 60,
                                          doctorPercentage: globalSettings?.doctorPercentage || 40,
                                          defaultInvoiceType: InvoiceType.E_ARSIV,
                                          pricingModel: PricingModel.STANDARD
                                      });
                                      newFirms.push(newFirm);
                                      newUpdates[newFirm.id] = u.count;
                                      newUploads.push(newFirm.id);
                                  }
                              });

                              if (newFirms.length > 0) {
                                  setFirms(db.getFirms());
                              }

                              setItems(prev => {
                                  const newItems = { ...prev };
                                  Object.keys(newUpdates).forEach(id => {
                                      newItems[id] = {
                                          ...(newItems[id] || { firmId: id, extraItemAmount: 0 }),
                                          currentEmployeeCount: newUpdates[id]
                                      };
                                  });
                                  return newItems;
                              });

                              setUploadedFirmIds(newUploads);
                              setUnmatchedRows([]);
                              setSelectedMapping({});
                              setShowUnmatchedModal(false);
                              alert("Eşleşmeyen firmalar başarıyla sisteme aktarıldı.");
                          }}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                          Seçimleri Uygula
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* EŞLEŞMEYEN SEVK TETKİKLERİ MODALI */}
      {showUnmatchedHealthModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2">
              <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
                      <div>
                          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                              <AlertCircle className="w-6 h-6 text-amber-500" /> Eşleşmeyen Sevk Tetkikleri
                          </h3>
                          <p className="text-sm text-slate-400 mt-1">
                              Aşağıdaki {unmatchedHealthRecords.length} tetkik kaydı Fatura Takip sistemindeki firmalarla otomatik eşleşmedi. İlgili firmayı seçerek faturaya dahil edebilirsiniz:
                          </p>
                      </div>
                      <button onClick={() => setShowUnmatchedHealthModal(false)} className="text-slate-500 hover:text-white transition-colors">
                          <XCircle className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 space-y-3">
                      {unmatchedHealthRecords.map((rec) => (
                          <div key={rec.id} className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
                              <div className="space-y-1">
                                  <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                      <span>{rec.sourceCompanyName || 'Bilinmiyor'}</span>
                                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                                          {formatCurrency(Number(rec.amount) || 0)}
                                      </span>
                                  </div>
                                  <div className="text-xs text-slate-400">
                                      Çalışan: <span className="text-slate-200 font-medium">{rec.employeeName}</span> • Tarih: {new Date(rec.date).toLocaleDateString('tr-TR')}
                                  </div>
                                  {rec.exams && rec.exams.length > 0 && (
                                      <div className="text-[10px] text-slate-500 truncate max-w-md">
                                          Tetkikler: {rec.exams.join(', ')}
                                      </div>
                                  )}
                              </div>
                              <div className="flex items-center gap-2 w-full md:w-auto">
                                  <select 
                                      className="bg-slate-800 border border-slate-600 text-xs rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 w-full md:w-64"
                                      value={selectedHealthMapping[rec.id] || ""}
                                      onChange={(e) => setSelectedHealthMapping(prev => ({...prev, [rec.id]: e.target.value}))}
                                  >
                                      <option value="">-- Firma Seçin --</option>
                                      {firms.filter(f => !f.parentFirmId).map(f => (
                                          <option key={f.id} value={f.id}>{f.name}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50 rounded-b-xl">
                      <button onClick={() => setShowUnmatchedHealthModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Kapat</button>
                      <button 
                          onClick={async () => {
                              const mappings = Object.entries(selectedHealthMapping).filter(([_, fId]) => Boolean(fId));
                              if (mappings.length === 0) {
                                  alert("Lütfen en az bir tetkik için firma seçin.");
                                  return;
                              }
                              
                              const extServices = db.getExternalHealthServices ? db.getExternalHealthServices() : [];
                              const updatedServices = extServices.map((s: any) => {
                                  if (selectedHealthMapping[s.id]) {
                                      return { ...s, matchedFirmId: selectedHealthMapping[s.id] };
                                  }
                                  return s;
                              });

                              localStorage.setItem('osgb_external_health', JSON.stringify(updatedServices));
                              db.forceSync();
                              setShowUnmatchedHealthModal(false);
                              setSelectedHealthMapping({});
                              alert(`${mappings.length} adet tetkik seçilen firmalara başarıyla atandı.`);
                          }}
                          className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
                      >
                          Seçimleri Uygula
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Preparation;
