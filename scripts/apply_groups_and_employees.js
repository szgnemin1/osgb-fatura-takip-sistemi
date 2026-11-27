const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

(async () => {
  console.log('====================================================');
  console.log(' FATURALARIN KESİM TARİHLERİNE GÖRE GRUPLANDIRMA   ');
  console.log('  VE EXCEL ÇALIŞAN SAYILARININ GÜNCELLENMESİ MOTORU ');
  console.log('====================================================');

  const argeDir = 'C:\\Users\\emins\\Desktop\\FATURA SİSTEMİ ARGE';
  const excelPath = path.join(argeDir, '1-DEVAM EDEN SÖZLEŞMELER.xlsx');
  const extractedTaxesPath = path.join(__dirname, '..', 'extracted_invoice_taxes.json');
  const sqlitePath = path.join(__dirname, '..', 'db', 'database.sqlite');

  // --- STEP 1: LOAD EXCEL EMPLOYEES ---
  console.log('\n[Adım 1] İSG-Katip Sözleşmelerinden Çalışan Sayıları Hesaplanıyor...');
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

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

  // Firmaya ait benzersiz SGK şubeleri bazında çalışan sayılarını topla
  const firmSgkMap = new Map();
  rows.forEach(r => {
    const name = String(r['Hizmet Alan İşyeri Unvanı'] || '').trim();
    const sgk = String(r['Hizmet Alan İşyeri SGK/DETSİS No'] || '').trim();
    const emp = Number(r['Hizmet Alan İşyeri Çalışan Sayısı'] || 0);
    if (!name) return;

    if (!firmSgkMap.has(name)) firmSgkMap.set(name, new Map());
    const m = firmSgkMap.get(name);
    const cur = m.get(sgk) || 0;
    if (emp > cur) m.set(sgk, emp);
  });

  const firmTotalEmp = new Map();
  for (const [name, m] of firmSgkMap.entries()) {
    let tot = 0;
    for (const emp of m.values()) tot += emp;
    firmTotalEmp.set(name, tot);
  }
  console.log(` -> ${firmTotalEmp.size} resmi firma için SGK bazlı çalışan toplamları çıkarıldı.`);

  // --- STEP 2: LOAD PDF INVOICE DATES ---
  console.log('\n[Adım 2] PDF Faturaların Kesim Tarihleri İnceleniyor...');
  const taxesData = fs.existsSync(extractedTaxesPath) ? JSON.parse(fs.readFileSync(extractedTaxesPath, 'utf8')) : {};
  const pdfFirmDates = new Map();
  for (const [k, v] of Object.entries(taxesData)) {
    if (v.invoiceDate) {
      pdfFirmDates.set(norm(k), v.invoiceDate);
    }
  }
  console.log(` -> ${pdfFirmDates.size} adet PDF faturadan kesim tarihi haritası oluşturuldu.`);

  // --- STEP 3: OPEN DATABASE ---
  const db = await open({ filename: sqlitePath, driver: sqlite3.Database });
  const rawFirms = await db.all('SELECT id, data FROM firms');
  const rawTxs = await db.all('SELECT data FROM transactions');
  const firms = rawFirms.map(r => JSON.parse(r.data));
  const txs = rawTxs.map(r => JSON.parse(r.data));

  // Build historical transaction invoice days
  const firmTxDays = new Map();
  txs.filter(t => t.type === 'FATURA' && t.date).forEach(t => {
    const d = new Date(t.date);
    if (!isNaN(d.getTime())) {
      if (!firmTxDays.has(t.firmId)) firmTxDays.set(t.firmId, []);
      firmTxDays.get(t.firmId).push({ date: t.date, day: d.getDate() });
    }
  });

  // Groups to define
  const group17Name = "17'si Kesilenler";
  const group24Name = "24'ü Kesilenler";
  const groupList = [group17Name, group24Name];

  // --- STEP 4: UPDATE FIRMS & PREPARATION ---
  console.log('\n[Adım 4] Gruplar Belirleniyor ve Çalışan Sayıları Eşitleniyor...');
  let count17 = 0;
  let count24 = 0;
  let countUngrouped = 0;
  let countEmpUpdated = 0;

  const updatedFirms = [];
  const updatedPreparation = [];

  for (const firm of firms) {
    const updatedFirm = { ...firm };
    const nF = norm(firm.name);
    const rF = cleanRoot(firm.name);

    // 1. Employee Count Match from Excel
    let emp = null;
    for (const [exName, tot] of firmTotalEmp.entries()) {
      const nE = norm(exName);
      const rE = cleanRoot(exName);
      if (nF === nE || (rE.length >= 4 && rF === rE) || (firm.officialTitle && norm(firm.officialTitle) === nE)) {
        emp = tot;
        break;
      }
    }

    if (emp !== null) {
      updatedFirm.activeEmployees = emp;
      updatedFirm.withSgk = 1;
      countEmpUpdated++;
    }

    // 2. Determine Invoice Cut-off Group
    let assignedGroup = null;

    // A) Check PDF invoice date
    for (const [k, invDate] of pdfFirmDates.entries()) {
      if (k === nF || k.includes(nF) || nF.includes(k)) {
        if (invDate.startsWith('17') || invDate.startsWith('16') || invDate.startsWith('18') || invDate.startsWith('19') || invDate.startsWith('11')) {
          assignedGroup = group17Name;
        } else if (invDate.startsWith('24') || invDate.startsWith('23') || invDate.startsWith('25') || invDate.startsWith('22')) {
          assignedGroup = group24Name;
        }
        break;
      }
    }

    // B) Check historical invoice transaction dates
    if (!assignedGroup && firmTxDays.has(firm.id)) {
      const history = firmTxDays.get(firm.id);
      history.sort((a,b) => b.date.localeCompare(a.date));
      const latest = history[0];
      if (latest.day >= 15 && latest.day <= 20) {
        assignedGroup = group17Name;
      } else if (latest.day >= 21 && latest.day <= 28) {
        assignedGroup = group24Name;
      } else {
        const c17 = history.filter(h => h.day >= 15 && h.day <= 20).length;
        const c24 = history.filter(h => h.day >= 21 && h.day <= 28).length;
        if (c17 >= c24 && c17 > 0) assignedGroup = group17Name;
        else if (c24 > 0) assignedGroup = group24Name;
      }
    }

    // C) Explicit case for LEGA YAPI (referrals are on Nov 5, billed on 17th)
    if (firm.name.includes('LEGA')) {
      assignedGroup = group17Name;
    }

    if (assignedGroup === group17Name) count17++;
    else if (assignedGroup === group24Name) count24++;
    else countUngrouped++;

    updatedFirm.group = assignedGroup || undefined;
    updatedFirms.push(updatedFirm);

    // 3. Build Preparation Record with exact currentEmployeeCount
    const currentCount = updatedFirm.activeEmployees || updatedFirm.basePersonLimit || 1;
    
    // Fee calculation
    let fee = updatedFirm.baseFee || 0;
    const limit = updatedFirm.basePersonLimit || 1;
    const extra = updatedFirm.extraPersonFee || 0;
    if (currentCount > limit && extra) {
      fee += (currentCount - limit) * extra;
    }

    updatedPreparation.push({
      firmId: firm.id,
      currentEmployeeCount: currentCount,
      activeEmployees: currentCount,
      calculatedFee: fee,
      extraItemAmount: 0,
      notes: '',
      isProcessed: 0,
      isLocked: 0,
      excluded: 0,
      invoiceType: updatedFirm.defaultInvoiceType || 'E-Fatura',
      serviceType: updatedFirm.serviceType || 'BOTH',
      pricingModel: updatedFirm.pricingModel || 'STANDART',
      baseFee: updatedFirm.baseFee || 0,
      basePersonLimit: limit,
      extraPersonFee: extra,
      tiers: updatedFirm.tiers || [],
      expertPercentage: updatedFirm.expertPercentage || 60,
      doctorPercentage: updatedFirm.doctorPercentage || 40,
      isKdvExcluded: updatedFirm.isKdvExcluded || false,
      discountType: 'NONE',
      discountValue: 0,
      extraItems: [],
      subRecords: [],
      updatedAt: new Date().toISOString()
    });
  }

  // --- STEP 5: SAVE TO SQLITE ---
  console.log('\n[Adım 5] Veritabanı Atomik Olarak Güncelleniyor...');
  await db.run('BEGIN TRANSACTION;');
  try {
    // 1. Update Global Settings with Firm Groups
    const settingsRow = await db.get('SELECT data FROM global_settings WHERE id = 1');
    const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
    settings.firmGroups = groupList;
    await db.run('INSERT OR REPLACE INTO global_settings (id, data) VALUES (1, ?)', JSON.stringify(settings));
    console.log(` -> Global ayarlar güncellendi: firmGroups = [${groupList.map(g => `"${g}"`).join(', ')}]`);

    // 2. Update Firms
    const updateFirmStmt = await db.prepare('UPDATE firms SET data = ? WHERE id = ?');
    for (const f of updatedFirms) {
      await updateFirmStmt.run(JSON.stringify(f), f.id);
    }
    await updateFirmStmt.finalize();
    console.log(` -> ${updatedFirms.length} firma güncellendi (grup ve çalışan sayıları işlendi).`);

    // 3. Update Preparation
    const updatePrepStmt = await db.prepare('INSERT OR REPLACE INTO preparation (firmId, data) VALUES (?, ?)');
    for (const p of updatedPreparation) {
      await updatePrepStmt.run(p.firmId, JSON.stringify(p));
    }
    await updatePrepStmt.finalize();
    console.log(` -> ${updatedPreparation.length} hazırlık kaydı güncellendi (currentEmployeeCount ve hesaplanan tutarlar işlendi).`);

    await db.run('COMMIT;');
    console.log(' -> İŞLEM BAŞARIYLA TAMAMLANDI VE VERİTABANINA YAZILDI (COMMITTED)!');
  } catch (err) {
    await db.run('ROLLBACK;');
    console.error(' -> Hata oluştu, geri alındı:', err);
    throw err;
  } finally {
    await db.close();
  }

  // --- STEP 6: SUMMARY REPORT ---
  console.log('\n====================================================');
  console.log('             İŞLEM VE DAĞILIM RAPORU                ');
  console.log('====================================================');
  console.log(` Toplam Firma:                       ${updatedFirms.length}`);
  console.log(` Excel'den Çalışan Sayısı Girilen:   ${countEmpUpdated}`);
  console.log(` "17'si Kesilenler" Grubu:           ${count17} firma`);
  console.log(` "24'ü Kesilenler" Grubu:           ${count24} firma`);
  console.log(` Grupsuz (Banka/Pasif Kayıtlar):     ${countUngrouped} firma`);
  console.log('====================================================\n');
})();
