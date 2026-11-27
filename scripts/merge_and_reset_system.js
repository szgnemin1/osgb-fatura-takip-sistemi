const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

(async () => {
  console.log('====================================================');
  console.log('   OSGB FATURA & SEVK SİSTEMİ TEMİZ KURULUM MOTORU   ');
  console.log('====================================================');

  const argeDir = 'C:\\Users\\emins\\Desktop\\FATURA SİSTEMİ ARGE';
  const faturaBackupPath = path.join(argeDir, 'OSGB_Yedek_24_11_2026FATURA SİSTEMİ.json');
  const sevkBackupPath = path.join(argeDir, 'osgb_yedek_2026-11-24 SEVK SİSTEMİ.json');
  const excelPath = path.join(argeDir, '1-DEVAM EDEN SÖZLEŞMELER.xlsx');
  const extractedTaxesPath = path.join(__dirname, '..', 'extracted_invoice_taxes.json');
  const sqlitePath = path.join(__dirname, '..', 'db', 'database.sqlite');
  
  const tetkikDataPaths = [
    path.join(__dirname, '..', 'osgb-tetkik-takip', 'global_data.json'),
    'C:\\Users\\emins\\Downloads\\osgb-tetkik-takip\\global_data.json'
  ].filter(p => fs.existsSync(p));

  // --- STEP 0: BACKUP CURRENT DATABASES ---
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`\n[Adım 0] Güvenlik Yedekleri Alınıyor... (${timestamp})`);
  
  if (fs.existsSync(sqlitePath)) {
    const sqliteBak = `${sqlitePath}.bak_merge_${timestamp}`;
    fs.copyFileSync(sqlitePath, sqliteBak);
    console.log(` -> SQLite yedeği oluşturuldu: ${path.basename(sqliteBak)}`);
  }

  tetkikDataPaths.forEach(tp => {
    const tpBak = `${tp}.bak_merge_${timestamp}`;
    fs.copyFileSync(tp, tpBak);
    console.log(` -> Tetkik yedeği oluşturuldu: ${tpBak}`);
  });

  // --- STEP 1: LOAD SOURCE FILES ---
  console.log('\n[Adım 1] Kaynak Dosyalar Okunuyor...');
  const faturaBackup = JSON.parse(fs.readFileSync(faturaBackupPath, 'utf8'));
  const sevkBackup = JSON.parse(fs.readFileSync(sevkBackupPath, 'utf8'));
  const taxesData = fs.existsSync(extractedTaxesPath) ? JSON.parse(fs.readFileSync(extractedTaxesPath, 'utf8')) : {};
  
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const excelRows = xlsx.utils.sheet_to_json(sheet);

  console.log(` -> Fatura Yedeği: ${faturaBackup.firms.length} firma, ${faturaBackup.transactions.length} hareket, ${faturaBackup.expenses.length} gider`);
  console.log(` -> Sevk Yedeği: ${sevkBackup.referrals.length} sevk, ${sevkBackup.companies.length} şirket`);
  console.log(` -> PDF Faturalardan Çıkarılan Vergi Numaraları: ${Object.keys(taxesData).length} adet`);
  console.log(` -> İSG-Katip Sözleşme Satırı: ${excelRows.length} adet`);

  // --- STEP 2: BUILD EXCEL FIRMS DICTIONARY ---
  const excelFirmsMap = new Map();
  excelRows.forEach(r => {
    const name = String(r['Hizmet Alan İşyeri Unvanı'] || '').trim();
    if (!name) return;
    if (!excelFirmsMap.has(name)) {
      excelFirmsMap.set(name, {
        name,
        sgk: String(r['Hizmet Alan İşyeri SGK/DETSİS No'] || '').trim(),
        danger: String(r['Hizmet Alan İşyeri Tehlike Sınıfı'] || '').trim(),
        employees: Number(r['Hizmet Alan İşyeri Çalışan Sayısı'] || 0)
      });
    }
  });
  const excelNames = Array.from(excelFirmsMap.keys());
  console.log(` -> Benzersiz Resmi İSG-Katip Firması: ${excelNames.length}`);

  // Helpers for text normalization
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/i̇/g, 'i').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function cleanRoot(s) {
    return norm(s)
      .replace(/\b(san|sanayi|tic|ticaret|ltd|sti|sirket|sirketi|as|a s|anonim|limited|ve|ins|insaat|gida|otomotiv|muh|muhendislik|dan|danismanlik|tur|turizm|tekstil|tas|ith|ithalat|ihr|ihracat|ozel|saglik|egitim|hizm|hizmet|hizmetleri|elk|elektrik|elektronik|isletme|isletmeleri|yoneticiligi|yonetimi|sitesi|koop|kooperatifi)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  // --- STEP 3: MATCHING & DECISIONS ---
  console.log('\n[Adım 3] Firma Eşleştirme ve Vergi No / SGK Zenginleştirme...');

  // Explicit mapping based on user answers & high-confidence domain analysis
  const explicitMap = {
    // User answer 2: Özlem Aytaş is same as ÖZLEM TOPCU
    'ÖZLEM AYTAŞ': 'ÖZLEM TOPCU',
    // User answer 3: İnan Teknik Servis is same as İNAN MEKATRONİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ
    'İNAN TEKNİK SERVİS': 'İNAN MEKATRONİK SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    // Curated mappings
    'US METAL': 'US ALİMÜNYUM DÖKÜM METAL MAKİNE SANAYİ VE TİC LTD ŞTİ',
    'SENA LOKANTASI': 'SENA GRUP RESTORAN GIDA SANAYİ TİCARET LİMİTED ŞİRKETİ',
    'MERİÇ MOTORLU TAŞITLAR': 'MERİÇ MOTORLU ARAÇLAR, EMLAK, İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    'UMUT EFENDİ CAĞ DÖNER': 'UMUT EFENDİ LOKANTA GIDA HAYVANCILIK İTHALAT İHRACAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    'S.M.G. Hafriyat': 'S.M.G İNŞAAT METAL DEK.EML.MAK.OT.TEM.NAMA.İTH.İHR.TİC.LTD.Ş',
    'FCS ELİT YAPI': 'FCS ELIT İNŞAAT EMLAK ORMAN ÜRÜNLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    'YÖN ISI': 'YÖN ISITMA SOĞUTMA VE DOĞAL GAZ SİSTEMLERİ İNŞAAT GIDA OTOMOTİV GAYRİMENKUL SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    'ABANT KERESTE': 'ABANT HAYVANCILIK ENTEGRE TARIM VE ORMAN ÜRÜNLERİ SANAYİ VE TİCARET ANONİM ŞİRKETİ',
    'ÇETİNLER İNŞ. MALZ.': 'ÇETİNLER İNŞAAT MALZEMELERİ OTOMOTİV VE ORMAN ÜRÜNLERİ LİMİTED ŞİRKETİ',
    'beksa inşaat': 'TASF.HAL.BEKSA YAPI İNŞAAT GAYRİMENKUL TURİZM SANAYİ TİCARET LİMİTED ŞİRKETİ',
    'Ali Rıza ÖZKOL': 'ALİRIZA ÖZKOL',
    'DAĞMER MADENCİLİK İNŞ. MERMERCİLİK SAN. TİC. LTD. ŞTİ': 'DAĞ__MER MADENCİLİK İNŞAAT MERMERCİLİK SATİC LTD ŞTİ',
    'Erdem AJANS': 'ERDEM AJANS REKLAM İNŞAAT MEDYA HİZMETLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    'consept balat site': 'CONCEPT BALAT SİTE YÖNETİMİ',
    'İ.Erdal GEÇER': 'İBRAHİM ERDAL GEÇER',
    'S.S. Mudanya Bahçelievler': 'MUDANYA BAHÇELİEVLER İŞLETME KOOPERATİFİ',
    'SPH DANIŞMANLIK': 'SPH DANIŞMANLIK DIŞ TİCARET VE SANAYİ LİMİTED ŞİRKETİ',
    'Ş.Z Elektronik Şakir ZENGİN': 'ŞAKİR ZENGİN',
    'KAL DANIŞMANLIK': 'KAL DIŞ TİCARET VE DANIŞMANLIK HİZMETLERİ ANONİM ŞİRKETİ',
    'mehmet naci suyabakan': 'MEHMET NAC İ SUYABAKAN',
    'AY BA KESİCİ TAKIMLAR': 'AYBA KESİCİ TAKIMLAR VE MAKİNA SANAYİ TİCARET LİMİTED ŞİRKETİ',
    'ERTEN GIDA- BURŞAH YAPI İŞ ORTAKLIĞI': 'ERTEN GIDA İNŞAAT TURİZM PETROL ÜRÜNLERİ NAKLİYESANAYİ VE LİMİTED ŞİRKETİ__ BURŞAH YAPI İNŞAAT SANAYİTİCARET LİMİTED ŞİRKETİ İŞ ORTAKLIĞI',
    'ALİZE METAL': 'ALİZE ÇELİK METAL LİMİTED ŞİRKETİ',
    'ŞENOL ÇİLİNGİR İNŞ. TAAH. LTD. ŞTİ.': 'ŞENOL ÇİLİNGİR İNŞAAT TAAHHÜT OTOMOTİV GIDA SANAYİ TİCARET LİMİTED ŞİRKETİ',
    'TOROS ÇİZAKÇ ÖZALAN': 'TOROS ÇİZAKÇA ÖZALAN',
    'SAYAL MİMARLIK İNŞAAT MÜH. TAAH.TUR.SAN VE TİC. LTD.ŞTİ.': 'SAYAL MİMARLIK İNŞAAT MÜHENDİSLİK TAAHHÜT TURİZM SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
    'Bursa Tohumculuk': 'BURSA TOHUMCULUK ZİRAAT VE TİC.A.Ş.',
    'kavakdere sitesi yöneticiliği': 'KAVAKDERESİTESİ YÖNETİCİLİĞİ',
    'Güney Nautura A_B Blok yöneticiliği': 'GÜNEY NAUTURA A__B BLOK SİTE YÖNİTCİLİĞİ',
    'SÜMERLER DANIŞMANLIK İNŞAAT MİMARLIK LTD.ŞTİ.': 'SÜMERLER DANIŞMANLIK İNŞAAT MİMARLIK LİMİTED ŞİRKETİ',
    'DENT ÇAMLIK': 'DENTÇAMLIK AĞIZ VE DİŞ SAĞLIĞI HİZMETLERİ SANAYİ TİCARET LİMİTED ŞİRKETİ',
    'müberra tunger': 'MÜBERRAH TUNGER',
    'SARTEN EMEK 24/388': 'SARTEN AMBALAJ SANAYİ VE TİCARET ANONİM ŞİRKETİ'
  };

  const usedExcelFirms = new Set();
  const firmIdToUpdatedName = new Map();
  const oldNameToNewName = new Map();

  // Helper to find tax info from PDF taxes
  function findTaxInfo(firmName, officialName) {
    const nF = norm(firmName);
    const nO = norm(officialName);
    const rO = cleanRoot(officialName);

    // 1. Direct match on official name
    for (const [k, v] of Object.entries(taxesData)) {
      const nK = norm(k);
      if (nK === nO || nK === nF) return v;
    }
    // 2. Substring / Root match
    for (const [k, v] of Object.entries(taxesData)) {
      const nK = norm(k);
      const rK = cleanRoot(k);
      if (rO.length >= 4 && (rK === rO || nK.includes(nO) || nO.includes(nK))) return v;
    }
    return null;
  }

  // Process existing backup firms
  const processedFirms = [];
  const backupFirms = faturaBackup.firms || [];

  backupFirms.forEach(firm => {
    const origName = firm.name.trim();
    let matchedOfficialName = null;

    // Check user decision 1: Zeynep Çelik is NOT Zeynep Kılıç Delibaş
    if (origName.toUpperCase().includes('ZEYNEP ÇELİK')) {
      matchedOfficialName = null; // Do NOT match to Zeynep Kılıç Delibaş
    }
    // Check explicit map
    else if (explicitMap[origName]) {
      matchedOfficialName = explicitMap[origName];
    }
    // Check exact match in Excel
    else {
      const nO = norm(origName);
      const exact = excelNames.find(en => norm(en) === nO && !usedExcelFirms.has(en));
      if (exact) {
        matchedOfficialName = exact;
      } else {
        const rO = cleanRoot(origName);
        if (rO.length >= 3) {
          const rMatches = excelNames.filter(en => cleanRoot(en) === rO && !usedExcelFirms.has(en));
          if (rMatches.length === 1) {
            matchedOfficialName = rMatches[0];
          } else {
            const partials = excelNames.filter(en => {
              if (usedExcelFirms.has(en)) return false;
              const rEn = cleanRoot(en);
              return rEn && (rEn.startsWith(rO + ' ') || rO.startsWith(rEn + ' '));
            });
            if (partials.length === 1) {
              matchedOfficialName = partials[0];
            }
          }
        }
      }
    }

    // Clone firm object
    const updatedFirm = { ...firm };

    if (matchedOfficialName) {
      usedExcelFirms.add(matchedOfficialName);
      const excelInfo = excelFirmsMap.get(matchedOfficialName);

      // User decision 4: Koştular branches must remain separate!
      const isKostularBranch = origName.toUpperCase().includes('KOŞTULAR') && origName.includes('(');
      const is3ElSicil = origName.toUpperCase().includes('3 EL') && origName.includes('sicil');
      const isNalcinBranch = origName.toUpperCase().includes('NALÇIN') && (origName.includes('OFİS') || origName.includes('DIŞ CEPHE'));

      if (isKostularBranch || is3ElSicil || isNalcinBranch) {
        // Keep branch distinction in name, enrich with official metadata
        updatedFirm.officialTitle = matchedOfficialName;
        updatedFirm.sgkNumber = excelInfo.sgk || firm.sgkNumber || '';
        updatedFirm.dangerClass = excelInfo.danger || firm.dangerClass || '';
        updatedFirm.activeEmployees = excelInfo.employees || firm.activeEmployees || 0;
        updatedFirm.withSgk = 1;
        firmIdToUpdatedName.set(firm.id, updatedFirm.name);
        oldNameToNewName.set(origName, updatedFirm.name);
      } else {
        // Update name to official name
        updatedFirm.name = matchedOfficialName;
        updatedFirm.sgkNumber = excelInfo.sgk || firm.sgkNumber || '';
        updatedFirm.dangerClass = excelInfo.danger || firm.dangerClass || '';
        updatedFirm.activeEmployees = excelInfo.employees || firm.activeEmployees || 0;
        updatedFirm.withSgk = 1;
        firmIdToUpdatedName.set(firm.id, matchedOfficialName);
        oldNameToNewName.set(origName, matchedOfficialName);
      }
    } else {
      // Historical/Passive firm not in current active contracts
      firmIdToUpdatedName.set(firm.id, origName);
      oldNameToNewName.set(origName, origName);
    }

    // Enrich with Tax Number from PDFs!
    const taxInfo = findTaxInfo(origName, updatedFirm.name);
    if (taxInfo && taxInfo.taxNumber) {
      updatedFirm.taxNumber = taxInfo.taxNumber;
      if (taxInfo.taxOffice && (!updatedFirm.address || !updatedFirm.address.includes('Vergi Dairesi'))) {
        updatedFirm.address = updatedFirm.address 
          ? `${updatedFirm.address} - ${taxInfo.taxOffice}` 
          : `${taxInfo.address || ''} / ${taxInfo.taxOffice}`;
      }
    }

    processedFirms.push(updatedFirm);
  });

  // --- STEP 4: ADD MISSING ACTIVE FIRMS FROM EXCEL ---
  console.log('\n[Adım 4] İSG-Katipte Olup Sistemde Olmayan Yeni Aktif Firmalar Ekleniyor...');
  const newExcelFirms = excelNames.filter(en => !usedExcelFirms.has(en));
  console.log(` -> Yeni eklenecek aktif firma sayısı: ${newExcelFirms.length}`);

  newExcelFirms.forEach(officialName => {
    const excelInfo = excelFirmsMap.get(officialName);
    const taxInfo = findTaxInfo(officialName, officialName);
    const newId = 'firm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

    const newFirm = {
      id: newId,
      name: officialName,
      parentFirmId: '',
      basePersonLimit: 1,
      baseFee: 1000,
      extraPersonFee: 500,
      expertPercentage: 60,
      doctorPercentage: 40,
      defaultInvoiceType: 'E-Fatura',
      taxNumber: taxInfo ? taxInfo.taxNumber : '',
      address: taxInfo ? `${taxInfo.address || ''} ${taxInfo.taxOffice || ''}`.trim() : '',
      yearlyFee: 0,
      pricingModel: 'STANDART',
      tolerancePercentage: 10,
      tiers: [],
      serviceType: 'BOTH',
      isKdvExcluded: false,
      hasSecondaryModel: false,
      secondaryPricingModel: 'STANDART',
      secondaryBaseFee: 0,
      secondaryBasePersonLimit: 0,
      secondaryExtraPersonFee: 0,
      secondaryTiers: [],
      sgkNumber: excelInfo.sgk || '',
      dangerClass: excelInfo.danger || '',
      activeEmployees: excelInfo.employees || 0,
      withSgk: 1
    };

    processedFirms.push(newFirm);
    firmIdToUpdatedName.set(newId, officialName);
    oldNameToNewName.set(officialName, officialName);
  });

  // Ensure LEGA YAPI is explicitly mapped and created
  let legaFirm = processedFirms.find(f => f.name.includes('LEGA MİMARLIK') || f.name.includes('LEGA YAPI'));
  if (!legaFirm) {
    const legaId = 'firm_lega_' + Date.now().toString(36);
    legaFirm = {
      id: legaId,
      name: 'LEGA MİMARLIK İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
      parentFirmId: '',
      basePersonLimit: 1,
      baseFee: 1000,
      extraPersonFee: 500,
      expertPercentage: 60,
      doctorPercentage: 40,
      defaultInvoiceType: 'E-Fatura',
      taxNumber: '',
      address: 'Nilüfer / Bursa',
      yearlyFee: 0,
      pricingModel: 'STANDART',
      tolerancePercentage: 10,
      tiers: [],
      serviceType: 'BOTH',
      isKdvExcluded: false,
      hasSecondaryModel: false,
      secondaryPricingModel: 'STANDART',
      secondaryBaseFee: 0,
      secondaryBasePersonLimit: 0,
      secondaryExtraPersonFee: 0,
      secondaryTiers: [],
      sgkNumber: '44100010115049360161265000',
      dangerClass: 'Çok Tehlikeli',
      activeEmployees: 5,
      withSgk: 1
    };
    processedFirms.push(legaFirm);
    firmIdToUpdatedName.set(legaId, legaFirm.name);
    oldNameToNewName.set('LEGA YAPI', legaFirm.name);
  } else {
    oldNameToNewName.set('LEGA YAPI', legaFirm.name);
  }

  console.log(` -> Toplam Nihai Firma Sayısı: ${processedFirms.length}`);
  const firmsWithTax = processedFirms.filter(f => f.taxNumber && f.taxNumber.length >= 10);
  console.log(` -> Vergi Kimlik / TC No'su Bulunan Firma Sayısı: ${firmsWithTax.length} / ${processedFirms.length}`);

  // --- STEP 5: PREPARE TRANSACTIONS ---
  console.log('\n[Adım 5] Hareketler (Transactions) Senkronize Ediliyor...');
  const processedTransactions = (faturaBackup.transactions || []).map(t => {
    const updated = { ...t };
    if (firmIdToUpdatedName.has(t.firmId)) {
      // If transaction stored firmName, update it
      if (updated.firmName) {
        updated.firmName = firmIdToUpdatedName.get(t.firmId);
      }
    }
    return updated;
  });
  console.log(` -> İşlenen Hareket Sayısı: ${processedTransactions.length}`);

  // --- STEP 6: PREPARE PREPARATION ITEMS ---
  console.log('\n[Adım 6] Fatura Hazırlık (Preparation) Kalemleri Oluşturuluyor...');
  const processedPreparation = [];
  processedFirms.forEach(f => {
    const activeEmp = f.activeEmployees || f.basePersonLimit || 1;
    let fee = f.baseFee || 0;
    if (activeEmp > (f.basePersonLimit || 1) && f.extraPersonFee) {
      fee += (activeEmp - (f.basePersonLimit || 1)) * f.extraPersonFee;
    }

    processedPreparation.push({
      firmId: f.id,
      activeEmployees: activeEmp,
      calculatedFee: fee,
      notes: '',
      isProcessed: 0,
      isLocked: 0,
      excluded: 0,
      invoiceType: f.defaultInvoiceType || 'E-Fatura',
      serviceType: f.serviceType || 'BOTH',
      pricingModel: f.pricingModel || 'STANDART',
      baseFee: f.baseFee || 0,
      basePersonLimit: f.basePersonLimit || 1,
      extraPersonFee: f.extraPersonFee || 0,
      tiers: f.tiers || [],
      expertPercentage: f.expertPercentage || 60,
      doctorPercentage: f.doctorPercentage || 40,
      isKdvExcluded: f.isKdvExcluded || false,
      discountType: 'NONE',
      discountValue: 0,
      extraItems: [],
      subRecords: [],
      updatedAt: new Date().toISOString()
    });
  });
  console.log(` -> Fatura Hazırlık Kalemi Sayısı: ${processedPreparation.length}`);

  // --- STEP 7: CONNECT SEVK SYSTEM & EXTERNAL HEALTH ---
  console.log('\n[Adım 7] Sevk Sistemi & Tetkik Kayıtları Faturaya Bağlanıyor...');

  // Map each Sevk company name to a firmId
  const tetkikFirmMappings = [];
  const sevkCompanies = sevkBackup.companies || [];
  const sevkReferrals = sevkBackup.referrals || [];

  // Build name-to-firmId lookup map
  const nameToFirmId = new Map();
  processedFirms.forEach(f => {
    nameToFirmId.set(f.name.toLowerCase().trim(), f.id);
    nameToFirmId.set(cleanRoot(f.name), f.id);
  });

  function resolveFirmId(compName) {
    if (!compName) return null;
    const cNorm = compName.toLowerCase().trim();
    if (nameToFirmId.has(cNorm)) return nameToFirmId.get(cNorm);
    const cRoot = cleanRoot(compName);
    if (nameToFirmId.has(cRoot)) return nameToFirmId.get(cRoot);

    // Check oldNameToNewName
    if (oldNameToNewName.has(compName)) {
      const targetName = oldNameToNewName.get(compName);
      if (nameToFirmId.has(targetName.toLowerCase().trim())) {
        return nameToFirmId.get(targetName.toLowerCase().trim());
      }
    }

    // Fuzzy check
    for (const f of processedFirms) {
      const fNorm = f.name.toLowerCase();
      if (fNorm.includes(cNorm) || cNorm.includes(fNorm)) return f.id;
      const fRoot = cleanRoot(f.name);
      if (fRoot.length >= 4 && cRoot.length >= 4 && (fRoot.includes(cRoot) || cRoot.includes(fRoot))) return f.id;
    }
    return null;
  }

  // Update Sevk companies list with official names
  const updatedSevkCompanies = sevkCompanies.map(c => {
    const updatedComp = { ...c };
    const firmId = resolveFirmId(c.name);
    if (firmId) {
      const targetFirm = processedFirms.find(f => f.id === firmId);
      if (targetFirm) {
        // Keep alias in mapping
        const mappingId = 'tfm_' + Buffer.from(c.name).toString('base64').replace(/=/g, '');
        tetkikFirmMappings.push({
          id: mappingId,
          tetkikName: c.name,
          targetFirmId: targetFirm.id,
          updatedAt: new Date().toISOString()
        });
        // Also map official name
        const offMappingId = 'tfm_' + Buffer.from(targetFirm.name).toString('base64').replace(/=/g, '');
        tetkikFirmMappings.push({
          id: offMappingId,
          tetkikName: targetFirm.name,
          targetFirmId: targetFirm.id,
          updatedAt: new Date().toISOString()
        });
        updatedComp.name = targetFirm.name;
      }
    }
    return updatedComp;
  });

  // Explicit mapping for LEGA YAPI
  if (legaFirm) {
    tetkikFirmMappings.push({
      id: 'tfm_' + Buffer.from('LEGA YAPI').toString('base64').replace(/=/g, ''),
      tetkikName: 'LEGA YAPI',
      targetFirmId: legaFirm.id,
      updatedAt: new Date().toISOString()
    });
    tetkikFirmMappings.push({
      id: 'tfm_' + Buffer.from(legaFirm.name).toString('base64').replace(/=/g, ''),
      tetkikName: legaFirm.name,
      targetFirmId: legaFirm.id,
      updatedAt: new Date().toISOString()
    });
  }

  // Deduplicate mappings by tetkikName
  const uniqueMappingsMap = new Map();
  tetkikFirmMappings.forEach(m => {
    if (!uniqueMappingsMap.has(m.tetkikName)) {
      uniqueMappingsMap.set(m.tetkikName, m);
    }
  });
  const uniqueMappings = Array.from(uniqueMappingsMap.values());
  console.log(` -> Tetkik Firma Eşleştirme Haritası: ${uniqueMappings.length} eşleşme oluşturuldu.`);

  // Process referrals and build external_health records
  const externalHealthRecords = [];
  const updatedReferrals = sevkReferrals.map(ref => {
    const updatedRef = { ...ref };
    const compName = (ref.employee?.company || '').trim();
    const firmId = resolveFirmId(compName) || (legaFirm && compName.toUpperCase().includes('LEGA') ? legaFirm.id : null);

    if (firmId) {
      const targetFirm = processedFirms.find(f => f.id === firmId);
      if (targetFirm && updatedRef.employee) {
        updatedRef.employee.company = targetFirm.name;
      }
    }

    // Only referrals with paymentMethod === 'INVOICE' go to external_health for billing!
    if (ref.paymentMethod === 'INVOICE') {
      const extId = 'ext_' + ref.id;
      externalHealthRecords.push({
        id: extId,
        sourceCompanyName: updatedRef.employee?.company || compName || 'Bilinmiyor',
        employeeName: ref.employee?.fullName || 'Bilinmiyor',
        tcNo: ref.employee?.tcNo || '',
        exams: ref.exams || [],
        amount: Number(ref.totalPrice) || 0,
        date: ref.referralDate || new Date().toISOString(),
        isBilled: false,
        referralId: ref.id,
        matchedFirmId: firmId || undefined
      });
    }

    return updatedRef;
  });

  console.log(` -> Faturalı Sevk (External Health) Kayıt Sayısı: ${externalHealthRecords.length}`);
  const linkedHealth = externalHealthRecords.filter(h => h.matchedFirmId);
  console.log(` -> Fatura Takipteki Firmaya Başarıyla Bağlanan Sevk Sayısı: ${linkedHealth.length} / ${externalHealthRecords.length}`);

  // --- STEP 8: SAVE TO SEVK GLOBAL_DATA.JSON ---
  console.log('\n[Adım 8] Sevk Takip Sistemi (global_data.json) Güncelleniyor...');
  const newSevkData = {
    ...sevkBackup,
    companies: updatedSevkCompanies,
    referrals: updatedReferrals
  };

  tetkikDataPaths.forEach(tp => {
    fs.writeFileSync(tp, JSON.stringify(newSevkData, null, 2), 'utf8');
    console.log(` -> Güncellendi: ${tp}`);
  });

  // --- STEP 9: ATOMIC SQLITE DATABASE WIPE & INSERT ---
  console.log('\n[Adım 9] Fatura Takip SQLite Veritabanı Temizlenip Atomik Olarak Dolduruluyor...');
  const db = await open({ filename: sqlitePath, driver: sqlite3.Database });

  await db.run('BEGIN TRANSACTION;');
  try {
    // 1. Wipe old data
    await db.run('DELETE FROM firms;');
    await db.run('DELETE FROM transactions;');
    await db.run('DELETE FROM preparation;');
    await db.run('DELETE FROM expenses;');
    await db.run('DELETE FROM expense_categories;');
    await db.run('DELETE FROM external_health;');
    await db.run('DELETE FROM tetkik_firm_mappings;');

    // 2. Insert firms
    const firmStmt = await db.prepare('INSERT INTO firms (id, data) VALUES (?, ?);');
    for (const f of processedFirms) {
      await firmStmt.run(f.id, JSON.stringify(f));
    }
    await firmStmt.finalize();
    console.log(` -> ${processedFirms.length} firma kaydedildi.`);

    // 3. Insert transactions
    const txStmt = await db.prepare('INSERT INTO transactions (id, firmId, data) VALUES (?, ?, ?);');
    for (const t of processedTransactions) {
      await txStmt.run(t.id, t.firmId, JSON.stringify(t));
    }
    await txStmt.finalize();
    console.log(` -> ${processedTransactions.length} hareket kaydedildi.`);

    // 4. Insert preparation
    const prepStmt = await db.prepare('INSERT INTO preparation (firmId, data) VALUES (?, ?);');
    for (const p of processedPreparation) {
      await prepStmt.run(p.firmId, JSON.stringify(p));
    }
    await prepStmt.finalize();
    console.log(` -> ${processedPreparation.length} hazırlık kaydı oluşturuldu.`);

    // 5. Insert expense categories
    const catStmt = await db.prepare('INSERT INTO expense_categories (id, data) VALUES (?, ?);');
    for (const c of (faturaBackup.expenseCategories || [])) {
      await catStmt.run(c.id, JSON.stringify(c));
    }
    await catStmt.finalize();
    console.log(` -> ${(faturaBackup.expenseCategories || []).length} gider kategorisi kaydedildi.`);

    // 6. Insert expenses
    const expStmt = await db.prepare('INSERT INTO expenses (id, data) VALUES (?, ?);');
    for (const e of (faturaBackup.expenses || [])) {
      await expStmt.run(e.id, JSON.stringify(e));
    }
    await expStmt.finalize();
    console.log(` -> ${(faturaBackup.expenses || []).length} gider kaydedildi.`);

    // 7. Insert external health (sevkler)
    const healthStmt = await db.prepare('INSERT INTO external_health (id, data) VALUES (?, ?);');
    for (const h of externalHealthRecords) {
      await healthStmt.run(h.id, JSON.stringify(h));
    }
    await healthStmt.finalize();
    console.log(` -> ${externalHealthRecords.length} sevk tetkik kaydı external_health tablosuna bağlandı.`);

    // 8. Insert tetkik firm mappings
    const mapStmt = await db.prepare('INSERT OR REPLACE INTO tetkik_firm_mappings (id, tetkik_name, target_firm_id, updated_at) VALUES (?, ?, ?, ?);');
    for (const m of uniqueMappings) {
      await mapStmt.run(m.id, m.tetkikName, m.targetFirmId, m.updatedAt);
    }
    await mapStmt.finalize();
    console.log(` -> ${uniqueMappings.length} firma haritalaması kaydedildi.`);

    await db.run('COMMIT;');
    console.log(' -> SQLite İŞLEMİ (TRANSACTION) BAŞARIYLA TAMAMLANDI VE ONAYLANDI (COMMITTED)!');
  } catch (err) {
    await db.run('ROLLBACK;');
    console.error(' -> HATA OLUŞTU, TÜM DEĞİŞİKLİKLER GERİ ALINDI (ROLLBACK):', err);
    throw err;
  } finally {
    await db.close();
  }

  // --- STEP 10: SUMMARY REPORT ---
  console.log('\n====================================================');
  console.log('           KURULUM VE ENTEGRASYON RAPORU           ');
  console.log('====================================================');
  console.log(` Toplam Aktif & Pasif Firma:    ${processedFirms.length}`);
  console.log(` Vergi Numarası Tanımlı Firma:  ${firmsWithTax.length}`);
  console.log(` SGK Sicil & Çalışan Tanımlı:   ${processedFirms.filter(f => f.sgkNumber).length}`);
  console.log(` Finansal Hareketler:           ${processedTransactions.length}`);
  console.log(` Giderler:                      ${(faturaBackup.expenses || []).length}`);
  console.log(` Faturaya Bağlanan Sevkler:     ${externalHealthRecords.length}`);
  console.log(` Firma Eşleşme Başarı Oranı:    %${((linkedHealth.length / externalHealthRecords.length) * 100).toFixed(1)}`);
  console.log('====================================================\n');
})();
