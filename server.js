require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ip = require('ip');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// Sadece kendi ağından veya yerel sunuculardan gelen CORS isteklerine izin ver
const allowedOrigins = ['http://localhost:4000', 'http://localhost:5000', `http://${ip.address()}:4000`, `http://${ip.address()}:5000`];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://192.168.') || origin.startsWith('http://10.')) {
            callback(null, true);
        } else {
            callback(new Error('CORS kuralları gereği bu adresten erişim engellendi.'));
        }
    }
};

const io = new Server(server, { cors: corsOptions });
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'osgb_pro_super_secret_key_2024';

// Güvenlik Başlıkları
app.use(helmet({
    contentSecurityPolicy: false, // React uygulaması için CSP'yi şimdilik devredışı bırakıyoruz (build klasöründen çalışacağı için)
    crossOriginEmbedderPolicy: false
}));

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));

// Veritabanı Yolları
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const usersPath = path.join(dbDir, 'users.json');
const usersExamplePath = path.join(dbDir, 'users.example.json');
if (!fs.existsSync(usersPath)) {
    if (fs.existsSync(usersExamplePath)) {
        try { fs.copyFileSync(usersExamplePath, usersPath); } catch (_) {}
    } else {
        const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
        const defaultUsers = [{ id: 1, username: 'admin', password: defaultPasswordHash, role: 'admin' }];
        try { fs.writeFileSync(usersPath, JSON.stringify(defaultUsers, null, 2)); } catch (_) {}
    }
}
const sqlitePath = path.join(dbDir, 'database.sqlite');

let db;

// Akıllı Şirket İsmi Normalizasyonu (Tetkik Sevk Eşleştirme ve Çakışma Önleme)
function normalizeCompanyName(name) {
    if (!name) return "";
    let cleaned = String(name)
        .replace(/İ/g, 'I').replace(/i/g, 'I').replace(/ı/g, 'I').replace(/I/g, 'I')
        .replace(/Ğ/g, 'G').replace(/ğ/g, 'G').replace(/Ü/g, 'U').replace(/ü/g, 'U')
        .replace(/Ş/g, 'S').replace(/ş/g, 'S').replace(/Ö/g, 'O').replace(/ö/g, 'O')
        .replace(/Ç/g, 'C').replace(/ç/g, 'C')
        .toUpperCase();

    // Noktalı kısaltmaları birleştir: M.B.M. -> MBM
    cleaned = cleaned.replace(/\b([A-Z0-9])\.([A-Z0-9])\.([A-Z0-9])\./g, '$1$2$3')
                     .replace(/\b([A-Z0-9])\.([A-Z0-9])\./g, '$1$2')
                     .replace(/[^A-Z0-9 ]/g, ' ')
                     .replace(/\s+/g, ' ')
                     .trim();

    let withoutSuffix = cleaned.replace(/\b(LTD|STI|SAN|TIC|AS|A S|VE|LIMITED|SIRKETI|TICARET|ANONIM|SANAYI|TAAHHUT|AZ TEHLIKELI|COK TEHLIKELI|TEHLIKELI)\b/g, '')
                               .replace(/\s+/g, ' ')
                               .trim();
    return withoutSuffix.length >= 2 ? withoutSuffix : cleaned;
}

// Tetkik Takip Otomatik Eşitleme (Kayıp/Eksik Tetkik Önleme ve Akıllı Eşleştirme)
async function reconcileWithTetkik() {
    try {
        let tetkikDataPath = path.join(__dirname, 'osgb-tetkik-takip', 'global_data.json');
        if (!fs.existsSync(tetkikDataPath)) {
            tetkikDataPath = path.join(__dirname, '..', 'osgb-tetkik-takip', 'global_data.json');
        }
        if (!fs.existsSync(tetkikDataPath)) {
            tetkikDataPath = 'C:\\Users\\emins\\Downloads\\osgb-tetkik-takip\\global_data.json';
        }
        if (!fs.existsSync(tetkikDataPath)) return;
        
        const tetkikRaw = JSON.parse(fs.readFileSync(tetkikDataPath, 'utf8'));
        const referrals = tetkikRaw.referrals || [];
        const invoiceReferrals = referrals.filter(r => r && r.paymentMethod === 'INVOICE' && !r.isExternalRecord);
        
        // Geçmiş onaylı veya kayıtlı faturaların en son tarihini bul
        const txRows = await db.all("SELECT data FROM transactions WHERE data LIKE '%FATURA%'");
        const firmLastInvoiceMap = new Map();
        for (const tr of txRows) {
            try {
                const t = JSON.parse(tr.data);
                if (t.type === 'FATURA') {
                    const invDate = new Date(t.date);
                    const curr = firmLastInvoiceMap.get(t.firmId);
                    if (!curr || invDate > curr) {
                        firmLastInvoiceMap.set(t.firmId, invDate);
                    }
                }
            } catch (_) {}
        }

        // Firmaları akıllı eşleştirme için yükle
        const fRows = await db.all("SELECT data FROM firms");
        const firms = fRows.map(r => {
            try {
                const f = JSON.parse(r.data);
                const norm = normalizeCompanyName(f.name);
                return {
                    id: f.id,
                    name: f.name,
                    norm,
                    tokens: norm.split(' ').filter(t => t.length > 0),
                    lastInvoiceDate: firmLastInvoiceMap.get(f.id) || null
                };
            } catch (_) { return null; }
        }).filter(Boolean);

        const matchReferral = (sourceComp) => {
            if (!sourceComp) return null;
            const sNorm = normalizeCompanyName(sourceComp);
            if (!sNorm) return null;

            let found = firms.find(f => f.norm === sNorm);
            if (found) return found;

            found = firms.find(f => f.norm.startsWith(sNorm) || sNorm.startsWith(f.norm));
            if (found) return found;

            const sTokens = sNorm.split(' ').filter(t => t.length > 0);
            if (sTokens.length >= 2) {
                found = firms.find(f => f.tokens.length >= 2 && f.tokens[0] === sTokens[0] && f.tokens[1] === sTokens[1]);
                if (found) return found;

                found = firms.find(f => sTokens.every(st => f.tokens.includes(st)));
                if (found) return found;
            } else if (sTokens.length === 1 && sTokens[0].length >= 3) {
                const matches = firms.filter(f => f.tokens.includes(sTokens[0]));
                if (matches.length === 1) return matches[0];
            }
            return null;
        };

        let syncedCount = 0;
        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const insertStmt = await db.prepare('INSERT INTO external_health (id, data) VALUES (?, ?)');
        const updateStmt = await db.prepare('UPDATE external_health SET data = ? WHERE id = ?');

        for (const ref of invoiceReferrals) {
            const existingRow = await db.get(`SELECT id, data FROM external_health WHERE data LIKE ?`, `%"referralId":"${ref.id}"%`);
            if (!existingRow) {
                const matchedFirm = matchReferral(ref.employee?.company);
                const refDate = new Date(ref.referralDate || Date.now());

                // Eğer firmanın bu sevk tarihinden sonra/eşit kesilmiş faturası varsa geçmişte faturalandırılmış sayılır
                let isBilled = false;
                if (matchedFirm && matchedFirm.lastInvoiceDate && matchedFirm.lastInvoiceDate >= refDate) {
                    isBilled = true;
                }

                const newId = 'ext_' + Date.now() + Math.random().toString(36).substr(2, 5);
                const item = {
                    id: newId,
                    sourceCompanyName: ref.employee?.company || 'Bilinmiyor',
                    employeeName: ref.employee?.fullName || 'Bilinmiyor',
                    exams: ref.exams || [],
                    amount: Number(ref.totalPrice) || 0,
                    date: ref.referralDate || new Date().toISOString(),
                    isBilled: isBilled,
                    referralId: ref.id,
                    matchedFirmId: matchedFirm ? matchedFirm.id : undefined
                };
                await insertStmt.run(newId, JSON.stringify(item));
                syncedCount++;
            } else {
                const existingData = JSON.parse(existingRow.data);
                if (!existingData.isBilled && Number(existingData.amount) !== Number(ref.totalPrice)) {
                    existingData.amount = Number(ref.totalPrice) || 0;
                    existingData.sourceCompanyName = ref.employee?.company || existingData.sourceCompanyName;
                    existingData.employeeName = ref.employee?.fullName || existingData.employeeName;
                    existingData.exams = ref.exams || existingData.exams;
                    await updateStmt.run(JSON.stringify(existingData), existingRow.id);
                    syncedCount++;
                }
            }
        }
        await insertStmt.finalize();
        await updateStmt.finalize();
        await db.run('COMMIT');

        if (syncedCount > 0) {
            console.log(`[Tetkik Eşitleme] ${syncedCount} adet tetkik kaydı Fatura Takip ile güncellendi.`);
        }
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('[Tetkik Eşitleme] Hata:', e);
    }
}

// SQLite Başlat (Eşzamanlı Çoklu Kullanıcı ve WAL Modu)
(async () => {
    db = await open({ filename: sqlitePath, driver: sqlite3.Database });
    await db.run('PRAGMA journal_mode = WAL;');
    await db.run('PRAGMA busy_timeout = 10000;');
    await db.run('PRAGMA synchronous = NORMAL;');
    await db.run('PRAGMA cache_size = -64000;');
    await db.run('CREATE TABLE IF NOT EXISTS invoice_batches (id TEXT PRIMARY KEY, data TEXT);');
    console.log("SQLite Veritabanına Bağlanıldı (Çoklu Kullanıcı WAL Modu Aktif).");
    await reconcileWithTetkik();
})();

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Erişim reddedildi.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Geçersiz token.' });
        req.user = user;
        next();
    });
};

// --- LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!fs.existsSync(usersPath)) return res.status(500).json({ error: 'Kullanıcı db yok.' });
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Hatalı giriş.' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username, role: user.role });
});

// Yardımcı: SQLite tablosunu JSON array (stringified) olarak al
async function getTableAsJSON(tableName) {
    try {
        const rows = await db.all(`SELECT data FROM ${tableName}`);
        return JSON.stringify(rows.map(r => JSON.parse(r.data)));
    } catch (e) { return "[]"; }
}

// 1. API: Veritabanını Oku (GET)
app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const payload = {};
        payload.osgb_firms = await getTableAsJSON('firms');
        payload.osgb_transactions = await getTableAsJSON('transactions');
        payload.osgb_preparation = await getTableAsJSON('preparation');
        payload.osgb_expense_categories = await getTableAsJSON('expense_categories');
        payload.osgb_expenses = await getTableAsJSON('expenses');
        payload.osgb_external_health = await getTableAsJSON('external_health');
        
        const settingsRow = await db.get(`SELECT data FROM global_settings WHERE id = 1`);
        if (settingsRow) payload.osgb_global_settings = settingsRow.data;

        res.json(payload);
    } catch (e) {
        res.status(500).json({ error: 'SQLite okuma hatası' });
    }
});

// 2. API: Veritabanını Yaz (POST) - GENEL KAYIT VE YEDEK YÜKLEME KÖPRÜSÜ
app.post('/api/save', authenticateToken, async (req, res) => {
    try {
        const newData = req.body;
        
        // Eğer onaylanmış faturayı bekleyen (pending) ile ezmeye çalışıyorsa önle
        if (newData.osgb_transactions) {
            let newTrans = JSON.parse(newData.osgb_transactions);
            const approvedRows = await db.all("SELECT id FROM transactions WHERE data LIKE '%APPROVED%'");
            const approvedIds = new Set(approvedRows.map(r => r.id));
            for (let i = 0; i < newTrans.length; i++) {
                if (approvedIds.has(newTrans[i].id)) {
                    newTrans[i].status = 'APPROVED';
                }
            }
            newData.osgb_transactions = JSON.stringify(newTrans);
        }

        // Atomik ve yüksek performanslı SQLite transaction başlat
        await db.run('BEGIN IMMEDIATE TRANSACTION');

        // Helper to UPSERT data securely and delete removed items
        const upsertTable = async (key, tableName, idField = 'id', allowDelete = true) => {
            if (!newData[key]) return;
            const arr = JSON.parse(newData[key]);
            const incomingIds = [];
            
            const insertStmt = await db.prepare(`INSERT OR REPLACE INTO ${tableName} (${idField}, data) VALUES (?, ?)`);
            for (const item of arr) {
                if (item[idField]) {
                    incomingIds.push(item[idField]);
                    await insertStmt.run(item[idField], JSON.stringify(item));
                }
            }
            await insertStmt.finalize();
            
            // Gelen listede OLMAYAN kayıtları SQLite'tan sil (Çünkü frontend tüm listeyi gönderiyor)
            if (allowDelete) {
                if (incomingIds.length > 0) {
                    await db.run('CREATE TEMP TABLE IF NOT EXISTS _keep_ids (id TEXT PRIMARY KEY)');
                    await db.run('DELETE FROM _keep_ids');
                    const keepStmt = await db.prepare('INSERT OR IGNORE INTO _keep_ids (id) VALUES (?)');
                    for (const id of incomingIds) {
                        await keepStmt.run(id);
                    }
                    await keepStmt.finalize();
                    await db.run(`DELETE FROM ${tableName} WHERE ${idField} NOT IN (SELECT id FROM _keep_ids)`);
                    await db.run('DROP TABLE IF EXISTS _keep_ids');
                } else if (arr.length === 0) {
                    await db.run(`DELETE FROM ${tableName}`);
                }
            }
        };

        // SQLite Aktarımı (Çoklu kullanıcıda diğer operatörlerin verilerini ezmeyi önle)
        await upsertTable('osgb_firms', 'firms', 'id', false);
        await upsertTable('osgb_transactions', 'transactions', 'id', false);
        await upsertTable('osgb_preparation', 'preparation', 'firmId', true);
        await upsertTable('osgb_expense_categories', 'expense_categories', 'id', false);
        await upsertTable('osgb_expenses', 'expenses', 'id', false);
        await upsertTable('osgb_external_health', 'external_health', 'id', false);

        if (newData.osgb_global_settings) {
            await db.run(`INSERT OR REPLACE INTO global_settings (id, data) VALUES (1, ?)`, newData.osgb_global_settings);
        }

        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Kayıt hatası:', e);
        res.status(500).json({ error: 'Kayıt başarısız', details: e.message });
    }
});

// 3.1 API: Fatura Ekleme/Güncelleme (Toplu / Atomic)
app.post('/api/transactions/bulk', authenticateToken, async (req, res) => {
    try {
        const { transactions } = req.body;
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ error: 'Liste boş' });
        }
        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const insertStmt = await db.prepare('INSERT OR REPLACE INTO transactions (id, data) VALUES (?, ?)');
        for (const t of transactions) {
            if (t.id) {
                await insertStmt.run(t.id, JSON.stringify(t));
            }
        }
        await insertStmt.finalize();
        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true, count: transactions.length });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Toplu fatura kayıt hatası:', e);
        res.status(500).json({ error: 'Fatura kayıt hatası' });
    }
});

// 3.2 API: Fatura Silme (Tekil veya Toplu)
app.post('/api/transactions/delete', authenticateToken, async (req, res) => {
    try {
        const { id, ids } = req.body;
        const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
        if (targetIds.length === 0) return res.status(400).json({ error: 'ID belirtilmedi' });

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const delStmt = await db.prepare('DELETE FROM transactions WHERE id = ?');
        for (const tId of targetIds) {
            await delStmt.run(tId);
        }
        await delStmt.finalize();
        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true, deletedCount: targetIds.length });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Fatura silme hatası:', e);
        res.status(500).json({ error: 'Silme hatası' });
    }
});

// 3.3 API: Firma Silme (Tekil veya Toplu)
app.post('/api/firms/delete', authenticateToken, async (req, res) => {
    try {
        const { id, ids } = req.body;
        const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
        if (targetIds.length === 0) return res.status(400).json({ error: 'ID belirtilmedi' });

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const delStmt = await db.prepare('DELETE FROM firms WHERE id = ?');
        for (const fId of targetIds) {
            await delStmt.run(fId);
        }
        await delStmt.finalize();
        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true, deletedCount: targetIds.length });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Firma silme hatası:', e);
        res.status(500).json({ error: 'Firma silme hatası' });
    }
});

// 3.4 API: Dış Sağlık Hizmetleri Faturalandı / Faturalanmadı Olarak İşaretle
app.post('/api/external-health/bill', authenticateToken, async (req, res) => {
    try {
        const { ids, isBilled = true } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ID listesi boş' });

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        for (const id of ids) {
            const row = await db.get('SELECT data FROM external_health WHERE id = ?', id);
            if (row) {
                const item = JSON.parse(row.data);
                item.isBilled = !!isBilled;
                await db.run('UPDATE external_health SET data = ? WHERE id = ?', JSON.stringify(item), id);
            }
        }
        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Sağlık hizmeti güncelleme hatası:', e);
        res.status(500).json({ error: 'Hata' });
    }
});

// 3. API: Sadece Fatura Onaylama (Tekil veya Toplu Destekli)
app.post('/api/transactions/approve', authenticateToken, async (req, res) => {
    try {
        const { id, ids, transaction } = req.body;
        const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
        
        if (targetIds.length === 0) {
            return res.status(400).json({ error: 'Fatura ID belirtilmedi' });
        }

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const updateStmt = await db.prepare('INSERT OR REPLACE INTO transactions (id, data) VALUES (?, ?)');

        for (const targetId of targetIds) {
            const existing = await db.get('SELECT data FROM transactions WHERE id = ?', targetId);
            let t;
            if (existing) {
                t = JSON.parse(existing.data);
                t.status = 'APPROVED';
            } else if (transaction && transaction.id === targetId) {
                t = { ...transaction, status: 'APPROVED' };
            }
            if (t) {
                await updateStmt.run(targetId, JSON.stringify(t));
                io.emit('transaction_approved', { id: targetId });
            }
        }
        await updateStmt.finalize();
        await db.run('COMMIT');

        io.emit('db_updated');
        return res.json({ success: true, approvedCount: targetIds.length });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Onay hatası:', e);
        res.status(500).json({ error: 'Hata' });
    }
});

// 3.5 API: Sunucu Bilgisi (Ağ IP'si ve Sabit Link İçin)
app.get('/api/server-info', (req, res) => {
    res.json({
        ip: ip.address(),
        port: PORT,
        kesimUrl: `http://${ip.address()}:${PORT}/#/kesim`
    });
});

// ==========================================
// 5. ÇOKLU KESİM & İŞ PAYLAŞIMI (BATCH INVOICING)
// ==========================================

// Güvenli ve Dinamik 4 Haneli Kod Üretici (1000 - 9999)
function generate4DigitCode(existingCodes = new Set()) {
    let code;
    let attempts = 0;
    do {
        code = String(Math.floor(1000 + Math.random() * 9000));
        attempts++;
        if (attempts > 10000) break;
    } while (existingCodes.has(code));
    existingCodes.add(code);
    return code;
}

// 5.1 Dağıtım Oluştur (Admin)
app.post('/api/batches/create', authenticateToken, async (req, res) => {
    try {
        const { operatorCount = 2, operatorNames = [] } = req.body;
        const count = Math.max(1, Math.min(20, Number(operatorCount) || 2));

        // Bekleyen faturaları transactions tablosundan al
        const txRows = await db.all("SELECT id, data FROM transactions WHERE data LIKE '%PENDING%'");
        const pendingList = [];
        for (const r of txRows) {
            try {
                const t = JSON.parse(r.data);
                if (t.status === 'PENDING' && t.type === 'FATURA') {
                    pendingList.push({ id: t.id, t });
                }
            } catch (_) {}
        }

        if (pendingList.length === 0) {
            return res.status(400).json({ error: 'Onay bekleyen fatura bulunamadı.' });
        }

        // Önceki tüm aktif dağıtımları pasife al
        const allBatches = await db.all("SELECT id, data FROM invoice_batches");
        for (const b of allBatches) {
            try {
                const parsed = JSON.parse(b.data);
                if (parsed.active) {
                    parsed.active = false;
                    await db.run("UPDATE invoice_batches SET data = ? WHERE id = ?", JSON.stringify(parsed), b.id);
                }
            } catch (_) {}
        }

        // Faturaları eşit paylaştır ve her birine dinamik 4 haneli güvenlik şifresi ata
        const operators = [];
        const baseChunk = Math.floor(pendingList.length / count);
        const remainder = pendingList.length % count;
        let startIndex = 0;
        const existingCodes = new Set();

        for (let i = 0; i < count; i++) {
            const chunkSize = baseChunk + (i < remainder ? 1 : 0);
            const chunk = pendingList.slice(startIndex, startIndex + chunkSize);
            startIndex += chunkSize;

            const code = generate4DigitCode(existingCodes);
            const name = operatorNames[i] && operatorNames[i].trim() ? operatorNames[i].trim() : `Operatör ${i + 1}`;

            operators.push({
                code: code,
                name: name,
                invoiceIds: chunk.map(c => c.id),
                previousCodes: []
            });
        }

        const batchId = 'batch_' + Date.now();
        const batchData = {
            id: batchId,
            createdAt: new Date().toISOString(),
            active: true,
            totalInvoices: pendingList.length,
            operators: operators
        };

        await db.run("INSERT OR REPLACE INTO invoice_batches (id, data) VALUES (?, ?)", batchId, JSON.stringify(batchData));

        io.emit('batch_updated');
        res.json({
            success: true,
            batchId,
            serverIp: ip.address(),
            port: PORT,
            batch: batchData
        });
    } catch (e) {
        console.error('Batch create error:', e);
        res.status(500).json({ error: 'İş paylaşımı oluşturulamadı' });
    }
});

// 5.1.1 Şifreleri Döndür / Yenile (Admin - Güvenlik İçin 4 Haneli Şifreleri Güncelleme)
app.post('/api/batches/rotate-codes', authenticateToken, async (req, res) => {
    try {
        const { operatorCode } = req.body || {};
        const rows = await db.all("SELECT id, data FROM invoice_batches ORDER BY id DESC LIMIT 5");
        let activeRow = null;
        let activeBatch = null;

        for (const r of rows) {
            try {
                const b = JSON.parse(r.data);
                if (b.active) {
                    activeRow = r;
                    activeBatch = b;
                    break;
                }
            } catch (_) {}
        }

        if (!activeBatch) {
            return res.status(404).json({ error: 'Aktif bir iş paylaşımı bulunamadı' });
        }

        const existingCodes = new Set();
        activeBatch.operators.forEach(op => {
            if (op.code) existingCodes.add(op.code);
            if (op.previousCodes) op.previousCodes.forEach(pc => existingCodes.add(pc));
        });

        activeBatch.operators.forEach(op => {
            if (!operatorCode || String(op.code) === String(operatorCode)) {
                if (!op.previousCodes) op.previousCodes = [];
                op.previousCodes.push(op.code);
                op.code = generate4DigitCode(existingCodes);
            }
        });

        await db.run("UPDATE invoice_batches SET data = ? WHERE id = ?", JSON.stringify(activeBatch), activeRow.id);

        io.emit('batch_updated');
        res.json({
            success: true,
            message: '4 Haneli güvenlik şifreleri yenilendi',
            batch: activeBatch
        });
    } catch (e) {
        console.error('Rotate codes error:', e);
        res.status(500).json({ error: 'Şifreler yenilenemedi' });
    }
});

// 5.2 Aktif Dağıtımı ve Canlı İlerlemeyi Getir (Admin & Genel)
app.get('/api/batches/active', async (req, res) => {
    try {
        const rows = await db.all("SELECT id, data FROM invoice_batches ORDER BY id DESC LIMIT 5");
        let activeBatch = null;
        for (const r of rows) {
            try {
                const parsed = JSON.parse(r.data);
                if (parsed.active) {
                    activeBatch = parsed;
                    break;
                }
            } catch (_) {}
        }

        if (!activeBatch) {
            return res.json({ active: false, batch: null });
        }

        // Canlı onay durumlarını çek
        const txRows = await db.all("SELECT id, data FROM transactions");
        const txStatusMap = new Map();
        for (const tr of txRows) {
            try {
                const t = JSON.parse(tr.data);
                txStatusMap.set(t.id, t.status);
            } catch (_) {}
        }

        const operatorsWithStats = activeBatch.operators.map(op => {
            let approved = 0;
            let pending = 0;
            for (const id of op.invoiceIds) {
                const st = txStatusMap.get(id);
                if (st === 'APPROVED') approved++;
                else pending++;
            }
            return {
                ...op,
                total: op.invoiceIds.length,
                approved,
                pending,
                progressPercent: op.invoiceIds.length > 0 ? Math.round((approved / op.invoiceIds.length) * 100) : 0,
                directLink: `http://${ip.address()}:${PORT}/#/kesim?kod=${op.code}`,
                fixedLink: `http://${ip.address()}:${PORT}/#/kesim`
            };
        });

        res.json({
            active: true,
            batchId: activeBatch.id,
            createdAt: activeBatch.createdAt,
            totalInvoices: activeBatch.totalInvoices,
            serverIp: ip.address(),
            port: PORT,
            operators: operatorsWithStats
        });
    } catch (e) {
        res.status(500).json({ error: 'Hata' });
    }
});

// 5.3 Dağıtımı Sonlandır / Sıfırla (Admin)
app.post('/api/batches/cancel', authenticateToken, async (req, res) => {
    try {
        const rows = await db.all("SELECT id, data FROM invoice_batches");
        for (const r of rows) {
            try {
                const b = JSON.parse(r.data);
                if (b.active) {
                    b.active = false;
                    await db.run("UPDATE invoice_batches SET data = ? WHERE id = ?", JSON.stringify(b), r.id);
                }
            } catch (_) {}
        }
        io.emit('batch_updated');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'İptal hatası' });
    }
});

// 5.4 Terminal Ekranı: Operatör Koduna Göre Fatura Listesini Getir (Şifresiz / PIN ile Giriş)
app.get('/api/batches/terminal/:code', async (req, res) => {
    try {
        const code = String(req.params.code).trim();
        const rows = await db.all("SELECT id, data FROM invoice_batches ORDER BY id DESC LIMIT 5");
        let activeBatch = null;
        let matchedOperator = null;

        for (const r of rows) {
            try {
                const b = JSON.parse(r.data);
                if (b.active) {
                    const op = b.operators.find(o => String(o.code) === code || (o.previousCodes && o.previousCodes.map(String).includes(code)));
                    if (op) {
                        activeBatch = b;
                        matchedOperator = op;
                        break;
                    }
                }
            } catch (_) {}
        }

        if (!activeBatch || !matchedOperator) {
            return res.status(404).json({ error: 'Bu koda ait aktif bir fatura kesim görevi bulunamadı.' });
        }

        // Firmaları çek (Vergi no, adres, unvan için)
        const firmRows = await db.all("SELECT id, data FROM firms");
        const firmMap = new Map();
        for (const fr of firmRows) {
            try {
                const f = JSON.parse(fr.data);
                firmMap.set(f.id, f);
            } catch (_) {}
        }

        // Operatörün faturalarını çek
        const targetIds = matchedOperator.invoiceIds || [];
        const invoices = [];
        let approvedCount = 0;

        for (const id of targetIds) {
            const txRow = await db.get("SELECT data FROM transactions WHERE id = ?", id);
            if (txRow) {
                try {
                    const t = JSON.parse(txRow.data);
                    const firm = firmMap.get(t.firmId) || {};
                    const isApproved = t.status === 'APPROVED';
                    if (isApproved) approvedCount++;

                    invoices.push({
                        id: t.id,
                        firmId: t.firmId,
                        firmName: firm.name || 'Bilinmeyen Firma',
                        taxNumber: firm.taxNumber || firm.tcNumber || firm.sgkNumber || '',
                        taxOffice: firm.taxOffice || '',
                        address: firm.address || '',
                        invoiceType: t.invoiceType || firm.defaultInvoiceType || 'E-Arşiv',
                        debt: Number(t.debt) || 0,
                        credit: Number(t.credit) || 0,
                        date: t.date,
                        description: t.description,
                        month: t.month,
                        year: t.year,
                        status: t.status || 'PENDING',
                        calculatedDetails: t.calculatedDetails,
                        firm: {
                            id: firm.id,
                            name: firm.name,
                            taxNumber: firm.taxNumber || firm.tcNumber || firm.sgkNumber || '',
                            taxOffice: firm.taxOffice || '',
                            address: firm.address || '',
                            defaultInvoiceType: firm.defaultInvoiceType,
                            expertPercentage: firm.expertPercentage,
                            doctorPercentage: firm.doctorPercentage,
                            serviceType: firm.serviceType,
                            parentFirmId: firm.parentFirmId
                        }
                    });
                } catch (_) {}
            }
        }

        // Global settings ve cari bakiye hesapla
        const settingsRow = await db.get("SELECT data FROM global_settings WHERE id = 1");
        const globalSettings = settingsRow ? JSON.parse(settingsRow.data) : null;

        // Firma cari bakiyelerini hesapla (SmartCopy için)
        const firmIds = Array.from(new Set(invoices.map(i => i.firmId)));
        const priorBalanceMap = {};
        if (firmIds.length > 0) {
            const allTxRows = await db.all("SELECT data FROM transactions");
            for (const row of allTxRows) {
                try {
                    const t = JSON.parse(row.data);
                    if (firmIds.includes(t.firmId) && (t.status === 'APPROVED' || !t.status)) {
                        priorBalanceMap[t.firmId] = (priorBalanceMap[t.firmId] || 0) + (Number(t.debt) || 0) - (Number(t.credit) || 0);
                    }
                } catch (_) {}
            }
        }

        for (const inv of invoices) {
            inv.priorBalance = priorBalanceMap[inv.firmId] || 0;
        }

        res.json({
            success: true,
            operatorName: matchedOperator.name,
            code: matchedOperator.code,
            batchId: activeBatch.id,
            totalCount: targetIds.length,
            approvedCount,
            pendingCount: targetIds.length - approvedCount,
            globalSettings: globalSettings || { vatRateExpert: 20, vatRateDoctor: 20, simpleDebtMode: false, bankInfo: '' },
            invoices
        });
    } catch (e) {
        console.error('Terminal error:', e);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// 5.5 Terminalden "Kestim / Onayla" (Tekli veya Toplu - Anında Cariye İşleme)
app.post('/api/batches/terminal/approve', async (req, res) => {
    try {
        const { code, transactionId, transactionIds } = req.body;
        const ids = transactionIds && Array.isArray(transactionIds)
            ? transactionIds
            : (transactionId ? [transactionId] : []);

        if (!code || ids.length === 0) return res.status(400).json({ error: 'Eksik parametre' });

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        for (const id of ids) {
            const txRow = await db.get("SELECT data FROM transactions WHERE id = ?", id);
            if (txRow) {
                const t = JSON.parse(txRow.data);
                t.status = 'APPROVED';
                await db.run("UPDATE transactions SET data = ? WHERE id = ?", JSON.stringify(t), id);
            }
        }
        await db.run('COMMIT');

        io.emit('transaction_approved', { ids });
        io.emit('batch_updated');
        io.emit('db_updated');

        res.json({ success: true, count: ids.length, message: 'Fatura(lar) onaylandı ve cariye işlendi.' });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Terminal approve error:', e);
        res.status(500).json({ error: 'Onaylanamadı' });
    }
});

// 5.6 Terminalden "Onayı Geri Al / Bekleyene Al" (Yanlışlıkla Tıklanırsa)
app.post('/api/batches/terminal/unapprove', async (req, res) => {
    try {
        const { code, transactionId } = req.body;
        if (!code || !transactionId) return res.status(400).json({ error: 'Eksik parametre' });

        const txRow = await db.get("SELECT data FROM transactions WHERE id = ?", transactionId);
        if (!txRow) return res.status(404).json({ error: 'Fatura bulunamadı' });

        const t = JSON.parse(txRow.data);
        t.status = 'PENDING';
        await db.run("UPDATE transactions SET data = ? WHERE id = ?", JSON.stringify(t), transactionId);

        io.emit('batch_updated');
        io.emit('db_updated');

        res.json({ success: true, message: 'Fatura tekrar bekleyenlere alındı.' });
    } catch (e) {
        res.status(500).json({ error: 'Hata' });
    }
});

// 4. API: Dış Sistemden Gelen Webhook (Eksiksiz Tetkik Senkronizasyonu)
app.post('/api/webhook/health-services', async (req, res) => {
    try {
        const payload = req.body;
        const referrals = Array.isArray(payload) ? payload : [payload];
        
        let changedCount = 0;
        for (const ref of referrals) {
            if (ref.action === 'delete') {
                const existingRow = await db.get(`SELECT id, data FROM external_health WHERE data LIKE ?`, `%"referralId":"${ref.id}"%`);
                if (existingRow) {
                    const existingData = JSON.parse(existingRow.data);
                    if (!existingData.isBilled) {
                        await db.run('DELETE FROM external_health WHERE id = ?', existingRow.id);
                        changedCount++;
                    }
                }
                continue;
            }

            if (ref.paymentMethod === 'INVOICE') {
                const existingRow = await db.get(`SELECT id, data FROM external_health WHERE data LIKE ?`, `%"referralId":"${ref.id}"%`);
                if (existingRow) {
                    const existingData = JSON.parse(existingRow.data);
                    if (!existingData.isBilled) {
                        existingData.sourceCompanyName = ref.employee?.company || existingData.sourceCompanyName || 'Bilinmiyor';
                        existingData.employeeName = ref.employee?.fullName || existingData.employeeName || 'Bilinmiyor';
                        existingData.exams = ref.exams || existingData.exams || [];
                        existingData.amount = Number(ref.totalPrice) || 0;
                        existingData.date = ref.referralDate || existingData.date;
                        await db.run('UPDATE external_health SET data = ? WHERE id = ?', JSON.stringify(existingData), existingRow.id);
                        changedCount++;
                    }
                } else {
                    const newId = 'ext_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    const item = {
                        id: newId,
                        sourceCompanyName: ref.employee?.company || 'Bilinmiyor',
                        employeeName: ref.employee?.fullName || 'Bilinmiyor',
                        exams: ref.exams || [],
                        amount: Number(ref.totalPrice) || 0,
                        date: ref.referralDate || new Date().toISOString(),
                        isBilled: false,
                        referralId: ref.id
                    };
                    await db.run('INSERT INTO external_health (id, data) VALUES (?, ?)', newId, JSON.stringify(item));
                    changedCount++;
                }
            } else if (ref.paymentMethod && ref.paymentMethod !== 'INVOICE') {
                // Sevk ödeme yöntemi Nakit veya POS'a çevrildiyse ve henüz faturalandırılmadıysa çıkar
                const existingRow = await db.get(`SELECT id, data FROM external_health WHERE data LIKE ?`, `%"referralId":"${ref.id}"%`);
                if (existingRow) {
                    const existingData = JSON.parse(existingRow.data);
                    if (!existingData.isBilled) {
                        await db.run('DELETE FROM external_health WHERE id = ?', existingRow.id);
                        changedCount++;
                    }
                }
            }
        }

        if (changedCount > 0) io.emit('db_updated');
        res.json({ success: true, message: 'Webhook processed', changedCount });
    } catch (e) {
        console.error('Webhook hatası:', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
} else {
    app.get('*', (req, res) => res.send('UI Yok.'));
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`OSGB SQLite Server Başlatıldı!`);
    console.log(`Yerel Ağ Adresi: http://${ip.address()}:${PORT}`);
    console.log(`Lokal Adres: http://localhost:${PORT}`);
    console.log(`===========================================`);
});
