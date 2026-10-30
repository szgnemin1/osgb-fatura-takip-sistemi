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
const crypto = require('crypto');
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

// Tetkik Takip Eşitleme (Tarih Aralıklı & Yarı Manuel Seçim Desteği)
async function reconcileWithTetkik(startDateStr = null, endDateStr = null, purgeOtherUnbilled = false) {
    try {
        let tetkikDataPath = path.join(__dirname, 'osgb-tetkik-takip', 'global_data.json');
        if (!fs.existsSync(tetkikDataPath)) {
            tetkikDataPath = path.join(__dirname, '..', 'osgb-tetkik-takip', 'global_data.json');
        }
        if (!fs.existsSync(tetkikDataPath)) {
            tetkikDataPath = 'C:\\Users\\emins\\Downloads\\osgb-tetkik-takip\\global_data.json';
        }
        if (!fs.existsSync(tetkikDataPath)) return { success: false, reason: 'Tetkik veri dosyası bulunamadı' };
        
        const tetkikRaw = JSON.parse(fs.readFileSync(tetkikDataPath, 'utf8'));
        const referrals = tetkikRaw.referrals || [];

        let start = startDateStr ? new Date(startDateStr) : null;
        if (start && !isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
        else start = null;

        let end = endDateStr ? new Date(endDateStr) : null;
        if (end && !isNaN(end.getTime())) end.setHours(23, 59, 59, 999);
        else end = null;

        // Sadece faturalı ve seçilen tarih aralığındaki sevkleri filtrele
        const invoiceReferrals = referrals.filter(r => {
            if (!r || r.paymentMethod !== 'INVOICE' || r.isExternalRecord) return false;
            if (start || end) {
                const rDate = new Date(r.referralDate || Date.now());
                if (start && rDate < start) return false;
                if (end && rDate > end) return false;
            }
            return true;
        });

        // Eğer purgeOtherUnbilled istenmişse (veya tarih aralığı verilmişse), 
        // aralık dışındaki henüz faturalandırılmamış sevk kayıtlarını temizle
        if (purgeOtherUnbilled) {
            const allHealth = await db.all("SELECT id, data FROM external_health");
            for (const row of allHealth) {
                try {
                    const item = JSON.parse(row.data);
                    if (!item.isBilled) {
                        const itemDate = new Date(item.date || Date.now());
                        const inRange = (!start || itemDate >= start) && (!end || itemDate <= end);
                        if (!inRange) {
                            await db.run("DELETE FROM external_health WHERE id = ?", row.id);
                        }
                    }
                } catch (_) {}
            }
        }
        
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

        // Firmaları ID ve İsim bazlı eşleme için yükle
        const fRows = await db.all("SELECT id, data FROM firms");
        const firmNameMap = new Map();
        for (const fr of fRows) {
            try {
                const f = JSON.parse(fr.data);
                if (f.name) firmNameMap.set(f.name.trim().toLowerCase(), f.id);
            } catch (_) {}
        }

        // Varsa önceden kaydedilmiş özel eşleştirmeler
        const mappingRows = await db.all("SELECT tetkik_name, target_firm_id FROM tetkik_firm_mappings");
        const mappingMap = new Map();
        for (const mr of mappingRows) {
            if (mr.target_firm_id && mr.target_firm_id !== 'IGNORE') {
                mappingMap.set(mr.tetkik_name, mr.target_firm_id);
            }
        }

        let syncedCount = 0;
        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const insertStmt = await db.prepare('INSERT INTO external_health (id, data) VALUES (?, ?)');
        const updateStmt = await db.prepare('UPDATE external_health SET data = ? WHERE id = ?');

        for (const ref of invoiceReferrals) {
            const existingRow = await db.get(`SELECT id, data FROM external_health WHERE data LIKE ?`, `%"referralId":"${ref.id}"%`);
            const compName = (ref.employee?.company || '').trim();
            const matchedFirmId = ref.companyId || (ref.employee && ref.employee.companyId) || mappingMap.get(compName) || firmNameMap.get(compName.toLowerCase()) || undefined;
            const refDate = new Date(ref.referralDate || Date.now());

            // Eğer eşleşen firmanın bu sevk tarihinden sonra/eşit kesilmiş faturası varsa geçmişte faturalandırılmış sayılır
            let isBilled = false;
            if (matchedFirmId && firmLastInvoiceMap.has(matchedFirmId)) {
                const lastDate = firmLastInvoiceMap.get(matchedFirmId);
                if (lastDate && lastDate >= refDate) {
                    isBilled = true;
                }
            }

            if (!existingRow) {
                const newId = 'ext_' + Date.now() + Math.random().toString(36).substr(2, 5);
                const item = {
                    id: newId,
                    sourceCompanyName: compName || 'Bilinmiyor',
                    employeeName: ref.employee?.fullName || 'Bilinmiyor',
                    exams: ref.exams || [],
                    amount: Number(ref.totalPrice) || 0,
                    date: ref.referralDate || new Date().toISOString(),
                    isBilled: isBilled,
                    referralId: ref.id,
                    matchedFirmId: matchedFirmId
                };
                await insertStmt.run(newId, JSON.stringify(item));
                syncedCount++;
            } else {
                const existingData = JSON.parse(existingRow.data);
                let changed = false;

                if (!existingData.isBilled && Number(existingData.amount) !== Number(ref.totalPrice)) {
                    existingData.amount = Number(ref.totalPrice) || 0;
                    changed = true;
                }
                if (existingData.sourceCompanyName !== compName && compName) {
                    existingData.sourceCompanyName = compName;
                    changed = true;
                }
                // Eşleştirme tablosundaki güncel ID'yi yansıt
                if (existingData.matchedFirmId !== matchedFirmId) {
                    existingData.matchedFirmId = matchedFirmId;
                    changed = true;
                }

                if (changed) {
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
        return {
            success: true,
            totalFound: invoiceReferrals.length,
            syncedCount,
            startDate: startDateStr,
            endDate: endDateStr
        };
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('[Tetkik Eşitleme] Hata:', e);
        return { success: false, error: e.message };
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
    await db.run('CREATE TABLE IF NOT EXISTS tetkik_firm_mappings (id TEXT PRIMARY KEY, tetkik_name TEXT UNIQUE, target_firm_id TEXT, updated_at TEXT);');
    console.log("SQLite Veritabanına Bağlanıldı (Çoklu Kullanıcı WAL Modu Aktif).");
    // Sunucu başlangıcında cari ayın sevklerini senkronize et (eski aylardan çöp veri çekmez)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const currentMonthStart = `${y}-${m}-01`;
    const currentMonthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    await reconcileWithTetkik(currentMonthStart, currentMonthEnd, true);
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

// Yardımcı: Kullanıcı DB Güvenli Okuma & Yazma
function readUsers() {
    if (!fs.existsSync(usersPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    } catch (_) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
}

// --- RFC 6238 TOTP (Google Authenticator) ALTYAPISI ---
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
    return output;
}

function base32Decode(str) {
    str = String(str || '').replace(/=+$/, '').toUpperCase().replace(/[\s-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        const val = BASE32_CHARS.indexOf(str[i]);
        if (val === -1) continue;
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

function generateTOTPSecret(length = 20) {
    return base32Encode(crypto.randomBytes(length));
}

function generateHOTP(secretBuffer, counter) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secretBuffer).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % 1000000;
    return code.toString().padStart(6, '0');
}

function verifyTOTP(token, secret, window = 1) {
    if (!token || !secret) return false;
    const cleanToken = String(token).trim().replace(/\s/g, '');
    if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;
    const step = 30;
    const currentTime = Math.floor(Date.now() / 1000 / step);
    try {
        const secretBuffer = base32Decode(secret);
        for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
            const calculated = generateHOTP(secretBuffer, currentTime + errorWindow);
            if (calculated === cleanToken) return true;
        }
    } catch (_) {
        return false;
    }
    return false;
}

// --- HATALI GİRİŞ KİLİDİ (BRUTE-FORCE SALDIRI ÖNLEME) ---
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 dakika kilit
const loginAttempts = new Map();

function getAttemptKey(req, username) {
    const ipAddr = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'client';
    const cleanUser = String(username || '').trim().toLowerCase();
    return `${ipAddr}:::${cleanUser}`;
}

function checkLoginLockout(key) {
    const record = loginAttempts.get(key);
    if (!record) return { isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
        return { isLocked: true, remainingMinutes };
    }

    if (record.lockedUntil && now >= record.lockedUntil) {
        loginAttempts.delete(key);
        return { isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    return { 
        isLocked: false, 
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.count) 
    };
}

function recordFailedLogin(key) {
    const now = Date.now();
    const record = loginAttempts.get(key) || { count: 0, lockedUntil: null, lastAttempt: now };
    record.count += 1;
    record.lastAttempt = now;

    if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
        loginAttempts.set(key, record);
        return { isLocked: true, remainingMinutes: 15 };
    }

    loginAttempts.set(key, record);
    return { 
        isLocked: false, 
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - record.count) 
    };
}

function clearFailedLogin(key) {
    loginAttempts.delete(key);
}

// --- LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const cleanUser = (username || '').trim();
    const key = getAttemptKey(req, cleanUser);

    // 1. Kilit Kontrolü
    const lockout = checkLoginLockout(key);
    if (lockout.isLocked) {
        return res.status(429).json({
            error: `Çok fazla hatalı giriş denemesi yapıldı. Hesabınız ${lockout.remainingMinutes} dakika kilitlendi. Lütfen bekleyiniz.`
        });
    }

    const users = readUsers();
    if (!users || users.length === 0) return res.status(500).json({ error: 'Kullanıcı veritabanı bulunamadı.' });

    const user = users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase());
    if (!user || !bcrypt.compareSync(password || '', user.password)) {
        const failStatus = recordFailedLogin(key);
        if (failStatus.isLocked) {
            return res.status(429).json({
                error: `5 kez hatalı giriş yapıldı. Güvenliğiniz için hesabınız ${failStatus.remainingMinutes} dakika süreyle kilitlendi.`
            });
        }
        return res.status(400).json({
            error: `Hatalı kullanıcı adı veya şifre. Kalan deneme hakkı: ${failStatus.remainingAttempts}`
        });
    }

    // 2. Şifre Doğru! Eğer 2FA (Google Authenticator) Aktifse:
    if (user.twoFactorEnabled && user.twoFactorSecret) {
        const tempToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role || 'user', purpose: '2fa_login' },
            JWT_SECRET,
            { expiresIn: '5m' }
        );
        return res.json({
            require2FA: true,
            tempToken,
            username: user.username,
            message: 'Lütfen Google Authenticator uygulamanızdaki 6 haneli doğrulama kodunu giriniz.'
        });
    }

    // 2FA yoksa giriş başarılı
    clearFailedLogin(key);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username, role: user.role || 'user' });
});

// --- 2FA İLE GİRİŞİ TAMAMLAMA ENDPOINT'İ ---
app.post('/api/login/2fa', (req, res) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
        return res.status(400).json({ error: 'Doğrulama kodu ve oturum anahtarı gereklidir.' });
    }

    let payload;
    try {
        payload = jwt.verify(tempToken, JWT_SECRET);
        if (payload.purpose !== '2fa_login') {
            return res.status(401).json({ error: 'Geçersiz 2FA oturumu.' });
        }
    } catch (_) {
        return res.status(401).json({ error: 'Doğrulama oturumu zaman aşımına uğradı. Lütfen kullanıcı adı ve şifrenizle baştan giriş yapınız.' });
    }

    const key = getAttemptKey(req, payload.username);
    const lockout = checkLoginLockout(key);
    if (lockout.isLocked) {
        return res.status(429).json({
            error: `Çok fazla hatalı kod denemesi yapıldı. Hesabınız ${lockout.remainingMinutes} dakika kilitlendi.`
        });
    }

    const users = readUsers();
    const user = users.find(u => u.id === payload.id);
    if (!user || !user.twoFactorSecret) {
        return res.status(404).json({ error: 'Kullanıcı veya 2FA yapılandırması bulunamadı.' });
    }

    const isValid = verifyTOTP(code, user.twoFactorSecret, 1);
    if (!isValid) {
        const failStatus = recordFailedLogin(key);
        if (failStatus.isLocked) {
            return res.status(429).json({
                error: `5 kez hatalı kod girildi. Hesabınız ${failStatus.remainingMinutes} dakika kilitlendi.`
            });
        }
        return res.status(400).json({
            error: `Hatalı doğrulama kodu. Google Authenticator'daki güncel kodu giriniz. Kalan deneme hakkı: ${failStatus.remainingAttempts}`
        });
    }

    // 2FA Kodu Doğru!
    clearFailedLogin(key);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username, role: user.role || 'user' });
});

// --- ME (Mevcut Oturum Bilgisi) ---
app.get('/api/me', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id || u.username.toLowerCase() === (req.user.username || '').toLowerCase());
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json({ 
        id: user.id, 
        username: user.username, 
        role: user.role || 'user', 
        twoFactorEnabled: !!user.twoFactorEnabled,
        createdAt: user.createdAt || null 
    });
});

// --- KULLANICI KENDİ BİLGİLERİNİ GÜNCELLEME (Kullanıcı Adı / Şifre Değiştirme) ---
app.post('/api/users/change-credentials', authenticateToken, (req, res) => {
    try {
        const { currentPassword, newUsername, newPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({ error: 'Mevcut şifrenizi girmeniz gerekmektedir.' });
        }

        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id || u.username.toLowerCase() === (req.user.username || '').toLowerCase());
        if (userIndex === -1) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const user = users[userIndex];
        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(400).json({ error: 'Mevcut şifreniz hatalı.' });
        }

        let usernameChanged = false;
        if (newUsername && newUsername.trim() && newUsername.trim() !== user.username) {
            const trimmed = newUsername.trim();
            if (trimmed.length < 3) {
                return res.status(400).json({ error: 'Yeni kullanıcı adı en az 3 karakter olmalıdır.' });
            }
            const exists = users.some(u => u.id !== user.id && u.username.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                return res.status(400).json({ error: 'Bu kullanıcı adı zaten başka bir hesap tarafından kullanılıyor.' });
            }
            user.username = trimmed;
            usernameChanged = true;
        }

        let passwordChanged = false;
        if (newPassword && newPassword.trim()) {
            const trimmedPass = newPassword.trim();
            if (trimmedPass.length < 4) {
                return res.status(400).json({ error: 'Yeni şifre en az 4 karakter olmalıdır.' });
            }
            user.password = bcrypt.hashSync(trimmedPass, 10);
            passwordChanged = true;
        }

        if (!usernameChanged && !passwordChanged) {
            return res.status(400).json({ error: 'Herhangi bir değişiklik belirtilmedi.' });
        }

        user.updatedAt = new Date().toISOString();
        users[userIndex] = user;
        writeUsers(users);

        const newToken = jwt.sign({ id: user.id, username: user.username, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '12h' });

        res.json({
            success: true,
            message: 'Bilgileriniz başarıyla güncellendi.',
            token: newToken,
            username: user.username,
            role: user.role || 'user'
        });
    } catch (e) {
        console.error('Kullanıcı güncelleme hatası:', e);
        res.status(500).json({ error: 'Kullanıcı bilgileri güncellenemedi.' });
    }
});

// --- 2FA (GOOGLE AUTHENTICATOR) KURULUMU VE YÖNETİMİ ---
app.post('/api/2fa/setup', authenticateToken, (req, res) => {
    try {
        const users = readUsers();
        const user = users.find(u => u.id === req.user.id || u.username.toLowerCase() === (req.user.username || '').toLowerCase());
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        const secret = generateTOTPSecret(20);
        const appName = 'OSGB ProFinans';
        const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(user.username)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

        res.json({
            secret,
            otpauthUrl,
            username: user.username
        });
    } catch (e) {
        console.error('2FA kurulum hatası:', e);
        res.status(500).json({ error: '2FA kurulumu başlatılamadı.' });
    }
});

app.post('/api/2fa/verify-and-enable', authenticateToken, (req, res) => {
    try {
        const { secret, code } = req.body;
        if (!secret || !code) {
            return res.status(400).json({ error: 'Gizli anahtar ve 6 haneli doğrulama kodu gereklidir.' });
        }

        const isValid = verifyTOTP(code, secret, 1);
        if (!isValid) {
            return res.status(400).json({ error: 'Doğrulama kodu hatalı. Lütfen Google Authenticator uygulamasındaki 6 haneli kodu tekrar kontrol ediniz.' });
        }

        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id || u.username.toLowerCase() === (req.user.username || '').toLowerCase());
        if (userIndex === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        users[userIndex].twoFactorEnabled = true;
        users[userIndex].twoFactorSecret = secret;
        users[userIndex].twoFactorActivatedAt = new Date().toISOString();
        writeUsers(users);

        res.json({
            success: true,
            message: 'Google Authenticator (2FA) başarıyla aktif edildi. Artık girişlerde 6 haneli kod istenecektir.'
        });
    } catch (e) {
        console.error('2FA aktif etme hatası:', e);
        res.status(500).json({ error: '2FA aktif edilemedi.' });
    }
});

app.post('/api/2fa/disable', authenticateToken, (req, res) => {
    try {
        const { currentPassword } = req.body;
        if (!currentPassword) {
            return res.status(400).json({ error: '2FA kapatmak için mevcut şifrenizi girmelisiniz.' });
        }

        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id || u.username.toLowerCase() === (req.user.username || '').toLowerCase());
        if (userIndex === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        const user = users[userIndex];
        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(400).json({ error: 'Mevcut şifreniz hatalı.' });
        }

        user.twoFactorEnabled = false;
        user.twoFactorSecret = null;
        user.twoFactorDisabledAt = new Date().toISOString();
        users[userIndex] = user;
        writeUsers(users);

        res.json({
            success: true,
            message: 'İki Adımlı Doğrulama (2FA) devre dışı bırakıldı.'
        });
    } catch (e) {
        console.error('2FA devre dışı bırakma hatası:', e);
        res.status(500).json({ error: '2FA devre dışı bırakılamadı.' });
    }
});

// --- KULLANICI LİSTESİ ---
app.get('/api/users', authenticateToken, (req, res) => {
    try {
        const users = readUsers();
        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            role: u.role || 'user',
            twoFactorEnabled: !!u.twoFactorEnabled,
            createdAt: u.createdAt || null,
            updatedAt: u.updatedAt || null
        })));
    } catch (e) {
        res.status(500).json({ error: 'Kullanıcı listesi alınamadı.' });
    }
});

// --- YENİ KULLANICI EKLEME (Admin) ---
app.post('/api/users', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Yeni kullanıcı ekleme yetkisi sadece yöneticilere aittir.' });
        }

        const { username, password, role = 'user', twoFactorEnabled = false } = req.body;
        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Kullanıcı adı gereklidir.' });
        }
        const trimmed = username.trim();
        if (trimmed.length < 3) {
            return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
        }
        if (!password || password.trim().length < 4) {
            return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır.' });
        }

        const users = readUsers();
        const exists = users.some(u => u.username.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten mevcut.' });
        }

        const secret = twoFactorEnabled ? generateTOTPSecret(20) : null;

        const newUser = {
            id: Date.now(),
            username: trimmed,
            password: bcrypt.hashSync(password.trim(), 10),
            role: role === 'admin' ? 'admin' : 'user',
            twoFactorEnabled: !!twoFactorEnabled,
            twoFactorSecret: secret,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeUsers(users);

        res.json({
            success: true,
            message: 'Yeni kullanıcı başarıyla eklendi.',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role,
                twoFactorEnabled: newUser.twoFactorEnabled,
                createdAt: newUser.createdAt
            }
        });
    } catch (e) {
        console.error('Kullanıcı ekleme hatası:', e);
        res.status(500).json({ error: 'Kullanıcı eklenemedi.' });
    }
});

// --- KULLANICI DÜZENLEME / ŞİFRE SIFIRLAMA (Admin) ---
app.put('/api/users/:id', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Kullanıcı düzenleme yetkisi sadece yöneticilere aittir.' });
        }

        const targetId = req.params.id;
        const { username, password, role, twoFactorEnabled } = req.body;
        const users = readUsers();
        const userIndex = users.findIndex(u => String(u.id) === String(targetId));
        if (userIndex === -1) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const user = users[userIndex];

        if (username && username.trim() && username.trim() !== user.username) {
            const trimmed = username.trim();
            if (trimmed.length < 3) return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
            const exists = users.some(u => String(u.id) !== String(targetId) && u.username.toLowerCase() === trimmed.toLowerCase());
            if (exists) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
            user.username = trimmed;
        }

        if (password && password.trim()) {
            if (password.trim().length < 4) return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır.' });
            user.password = bcrypt.hashSync(password.trim(), 10);
        }

        if (role) {
            if (user.role === 'admin' && role !== 'admin') {
                const adminCount = users.filter(u => u.role === 'admin').length;
                if (adminCount <= 1) {
                    return res.status(400).json({ error: 'Sistemdeki tek yönetici yetkisini kaldıramazsınız.' });
                }
            }
            user.role = role === 'admin' ? 'admin' : 'user';
        }

        if (typeof twoFactorEnabled === 'boolean') {
            if (!twoFactorEnabled) {
                user.twoFactorEnabled = false;
                user.twoFactorSecret = null;
            } else if (!user.twoFactorSecret) {
                user.twoFactorSecret = generateTOTPSecret(20);
                user.twoFactorEnabled = true;
            } else {
                user.twoFactorEnabled = true;
            }
        }

        user.updatedAt = new Date().toISOString();
        users[userIndex] = user;
        writeUsers(users);

        res.json({
            success: true,
            message: 'Kullanıcı bilgileri güncellendi.',
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role, 
                twoFactorEnabled: !!user.twoFactorEnabled, 
                updatedAt: user.updatedAt 
            }
        });
    } catch (e) {
        console.error('Kullanıcı güncelleme hatası:', e);
        res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
    }
});

// --- KULLANICI 2FA SIFIRLAMA (Admin) ---
app.post('/api/users/:id/reset-2fa', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Bu işlem sadece yöneticilere aittir.' });
        }

        const targetId = req.params.id;
        const users = readUsers();
        const userIndex = users.findIndex(u => String(u.id) === String(targetId));
        if (userIndex === -1) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        users[userIndex].twoFactorEnabled = false;
        users[userIndex].twoFactorSecret = null;
        users[userIndex].twoFactorResetAt = new Date().toISOString();
        writeUsers(users);

        res.json({
            success: true,
            message: `"${users[userIndex].username}" kullanıcısının 2FA doğrulaması başarıyla sıfırlandı.`
        });
    } catch (e) {
        res.status(500).json({ error: '2FA sıfırlanamadı.' });
    }
});

// --- KULLANICI SİLME (Admin) ---
app.delete('/api/users/:id', authenticateToken, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Kullanıcı silme yetkisi sadece yöneticilere aittir.' });
        }

        const targetId = req.params.id;
        const users = readUsers();
        const user = users.find(u => String(u.id) === String(targetId));
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        if (String(req.user.id) === String(user.id) || req.user.username.toLowerCase() === user.username.toLowerCase()) {
            return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
        }

        if (user.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Sistemdeki tek yöneticiyi silemezsiniz.' });
            }
        }

        const remainingUsers = users.filter(u => String(u.id) !== String(targetId));
        writeUsers(remainingUsers);

        res.json({ success: true, message: 'Kullanıcı başarıyla silindi.' });
    } catch (e) {
        console.error('Kullanıcı silme hatası:', e);
        res.status(500).json({ error: 'Kullanıcı silinemedi.' });
    }
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
                const compName = (ref.employee?.company || '').trim();
                let matchedFirmId = ref.companyId || (ref.employee && ref.employee.companyId);
                if (!matchedFirmId && compName) {
                    const firmRow = await db.get(`SELECT id FROM firms WHERE data LIKE ?`, `%"name":"${compName}"%`);
                    if (firmRow) matchedFirmId = firmRow.id;
                }

                const existingRow = await db.get(`SELECT id, data FROM external_health WHERE data LIKE ?`, `%"referralId":"${ref.id}"%`);
                if (existingRow) {
                    const existingData = JSON.parse(existingRow.data);
                    if (!existingData.isBilled) {
                        existingData.sourceCompanyName = compName || existingData.sourceCompanyName || 'Bilinmiyor';
                        existingData.employeeName = ref.employee?.fullName || existingData.employeeName || 'Bilinmiyor';
                        existingData.exams = ref.exams || existingData.exams || [];
                        existingData.amount = Number(ref.totalPrice) || 0;
                        existingData.date = ref.referralDate || existingData.date;
                        if (matchedFirmId) existingData.matchedFirmId = matchedFirmId;
                        await db.run('UPDATE external_health SET data = ? WHERE id = ?', JSON.stringify(existingData), existingRow.id);
                        changedCount++;
                    }
                } else {
                    const newId = 'ext_' + Date.now() + Math.random().toString(36).substr(2, 5);
                    const item = {
                        id: newId,
                        sourceCompanyName: compName || 'Bilinmiyor',
                        employeeName: ref.employee?.fullName || 'Bilinmiyor',
                        exams: ref.exams || [],
                        amount: Number(ref.totalPrice) || 0,
                        date: ref.referralDate || new Date().toISOString(),
                        isBilled: false,
                        referralId: ref.id,
                        matchedFirmId: matchedFirmId
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

// ==========================================
// 6. TETKİK FİRMA EŞLEŞTİRME & DÖNEMSEL SEVK ÇEKME
// ==========================================

// 6.0 Tarih Aralığına Göre Tetkik / Sevkleri Çek & Senkronize Et
app.post('/api/tetkik/sync', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, purgeOtherUnbilled = true } = req.body;
        const result = await reconcileWithTetkik(startDate, endDate, purgeOtherUnbilled);
        io.emit('db_updated');
        res.json({
            success: true,
            message: 'Sevkler seçilen tarih aralığına göre başarıyla eşitlendi.',
            ...result
        });
    } catch (e) {
        console.error('Tetkik sync error:', e);
        res.status(500).json({ error: 'Sevk senkronizasyonu başarısız oldu: ' + e.message });
    }
});

// 6.1 Tetkik Sistemindeki Firmaları ve Eşleşme Durumlarını Getir (Tarih Filtreli)
app.get('/api/tetkik/companies', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let start = startDate ? new Date(startDate) : null;
        if (start && !isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
        else start = null;

        let end = endDate ? new Date(endDate) : null;
        if (end && !isNaN(end.getTime())) end.setHours(23, 59, 59, 999);
        else end = null;

        let tetkikDataPath = path.join(__dirname, 'osgb-tetkik-takip', 'global_data.json');
        if (!fs.existsSync(tetkikDataPath)) {
            tetkikDataPath = path.join(__dirname, '..', 'osgb-tetkik-takip', 'global_data.json');
        }
        if (!fs.existsSync(tetkikDataPath)) {
            tetkikDataPath = 'C:\\Users\\emins\\Downloads\\osgb-tetkik-takip\\global_data.json';
        }

        let tetkikCompanies = [];
        let referrals = [];
        if (fs.existsSync(tetkikDataPath)) {
            try {
                const raw = JSON.parse(fs.readFileSync(tetkikDataPath, 'utf8'));
                tetkikCompanies = raw.companies || [];
                referrals = raw.referrals || [];
            } catch (_) {}
        }

        // Mevcut eşleştirmeleri çek
        const mappingRows = await db.all("SELECT tetkik_name, target_firm_id FROM tetkik_firm_mappings");
        const mappingMap = new Map();
        for (const mr of mappingRows) {
            mappingMap.set(mr.tetkik_name, mr.target_firm_id);
        }

        // Fatura Takip firmalarını çek
        const fRows = await db.all("SELECT id, data FROM firms");
        const faturaFirms = fRows.map(r => {
            try { return JSON.parse(r.data); } catch (_) { return null; }
        }).filter(Boolean).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

        // Tetkik firmalarını topla
        const compMap = new Map();

        // 1. Tetkik sisteminde kayıtlı şirketler
        for (const c of tetkikCompanies) {
            const name = (c.name || '').trim();
            if (!name) continue;
            compMap.set(name, {
                id: c.id,
                name: name,
                hazardClass: c.hazardClass || '-',
                doctor: c.assignedDoctor || '-',
                specialist: c.assignedSpecialist || '-',
                totalReferrals: 0,
                totalAmount: 0,
                unbilledReferrals: 0,
                unbilledAmount: 0,
                matchedFirmId: mappingMap.get(name) || ''
            });
        }

        // 2. Sevklerden gelen şirketler ve istatistikler (Tarih Aralıklı)
        let totalInRange = 0;
        let totalAmountInRange = 0;

        for (const ref of referrals) {
            const compName = (ref.employee?.company || '').trim();
            if (!compName) continue;

            // Tarih filtresi uygula
            if (start || end) {
                const rDate = new Date(ref.referralDate || Date.now());
                if (start && rDate < start) continue;
                if (end && rDate > end) continue;
            }

            if (!compMap.has(compName)) {
                compMap.set(compName, {
                    id: 'ref_' + compName,
                    name: compName,
                    hazardClass: '-',
                    doctor: '-',
                    specialist: '-',
                    totalReferrals: 0,
                    totalAmount: 0,
                    unbilledReferrals: 0,
                    unbilledAmount: 0,
                    matchedFirmId: mappingMap.get(compName) || ''
                });
            }

            const item = compMap.get(compName);
            item.totalReferrals++;
            const price = Number(ref.totalPrice) || 0;
            item.totalAmount += price;

            if (ref.paymentMethod === 'INVOICE' && !ref.isExternalRecord) {
                item.unbilledReferrals++;
                item.unbilledAmount += price;
                totalInRange++;
                totalAmountInRange += price;
            }
        }

        const companiesList = Array.from(compMap.values()).sort((a, b) => {
            if (b.unbilledAmount !== a.unbilledAmount) {
                return b.unbilledAmount - a.unbilledAmount;
            }
            if (b.totalReferrals !== a.totalReferrals) {
                return b.totalReferrals - a.totalReferrals;
            }
            return a.name.localeCompare(b.name, 'tr');
        });

        res.json({
            success: true,
            tetkikCompanies: companiesList,
            faturaFirms,
            dateRange: {
                startDate: startDate || null,
                endDate: endDate || null
            },
            totalReferralsInRange: totalInRange,
            totalAmountInRange: totalAmountInRange
        });
    } catch (e) {
        console.error('Tetkik companies error:', e);
        res.status(500).json({ error: 'Tetkik firmaları yüklenemedi' });
    }
});

// 6.2 Eşleştirmeleri Kaydet ve Sevkleri Güncelle
app.post('/api/tetkik/save-mappings', authenticateToken, async (req, res) => {
    try {
        const { mappings } = req.body;
        if (!Array.isArray(mappings)) return res.status(400).json({ error: 'Geçersiz veri' });

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        const stmt = await db.prepare("INSERT OR REPLACE INTO tetkik_firm_mappings (id, tetkik_name, target_firm_id, updated_at) VALUES (?, ?, ?, ?)");
        
        for (const m of mappings) {
            if (!m.tetkikName) continue;
            const id = 'tfm_' + Buffer.from(m.tetkikName).toString('base64').replace(/=/g, '');
            await stmt.run(id, m.tetkikName, m.targetFirmId || 'IGNORE', new Date().toISOString());
        }
        await stmt.finalize();

        // external_health tablosundaki sevkleri anında bu eşleştirmelere göre güncelle
        const mappingMap = new Map();
        mappings.forEach(m => mappingMap.set(m.tetkikName, m.targetFirmId));

        const healthRows = await db.all("SELECT id, data FROM external_health");
        const updateHealthStmt = await db.prepare("UPDATE external_health SET data = ? WHERE id = ?");
        let updatedCount = 0;

        for (const hr of healthRows) {
            try {
                const item = JSON.parse(hr.data);
                if (mappingMap.has(item.sourceCompanyName)) {
                    const targetId = mappingMap.get(item.sourceCompanyName);
                    const newMatched = (targetId && targetId !== 'IGNORE') ? targetId : undefined;
                    if (item.matchedFirmId !== newMatched) {
                        item.matchedFirmId = newMatched;
                        await updateHealthStmt.run(JSON.stringify(item), hr.id);
                        updatedCount++;
                    }
                }
            } catch (_) {}
        }
        await updateHealthStmt.finalize();
        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true, count: mappings.length, updatedCount });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Save mappings error:', e);
        res.status(500).json({ error: 'Eşleştirmeler kaydedilemedi' });
    }
});

// 6.3 Tetkik Firmasından Fatura Sistemine Yeni Firma Oluştur ve Eşleştir
app.post('/api/tetkik/create-firm', authenticateToken, async (req, res) => {
    try {
        const { tetkikName, hazardClass } = req.body;
        if (!tetkikName) return res.status(400).json({ error: 'Firma adı gerekli' });

        const newId = 'firm_' + Date.now() + Math.random().toString(36).substr(2, 4);
        const newFirm = {
            id: newId,
            name: tetkikName.trim(),
            hazardClass: hazardClass && hazardClass !== '-' ? hazardClass : 'Az Tehlikeli',
            pricingModel: 'STANDARD',
            baseFee: 0,
            basePersonLimit: 0,
            extraPersonFee: 0,
            defaultInvoiceType: 'E-Arşiv',
            expertPercentage: 50,
            doctorPercentage: 50,
            serviceType: 'BOTH',
            createdAt: new Date().toISOString()
        };

        await db.run('BEGIN IMMEDIATE TRANSACTION');
        await db.run("INSERT INTO firms (id, data) VALUES (?, ?)", newId, JSON.stringify(newFirm));

        const mappingId = 'tfm_' + Buffer.from(tetkikName).toString('base64').replace(/=/g, '');
        await db.run("INSERT OR REPLACE INTO tetkik_firm_mappings (id, tetkik_name, target_firm_id, updated_at) VALUES (?, ?, ?, ?)",
            mappingId, tetkikName, newId, new Date().toISOString());

        // Sevkleri güncelle
        const healthRows = await db.all("SELECT id, data FROM external_health");
        const updateHealthStmt = await db.prepare("UPDATE external_health SET data = ? WHERE id = ?");
        for (const hr of healthRows) {
            try {
                const item = JSON.parse(hr.data);
                if (item.sourceCompanyName === tetkikName) {
                    item.matchedFirmId = newId;
                    await updateHealthStmt.run(JSON.stringify(item), hr.id);
                }
            } catch (_) {}
        }
        await updateHealthStmt.finalize();
        await db.run('COMMIT');

        io.emit('db_updated');
        res.json({ success: true, firm: newFirm });
    } catch (e) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        console.error('Create firm from tetkik error:', e);
        res.status(500).json({ error: 'Firma oluşturulamadı' });
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
