const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ip = require('ip');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'osgb-pro-super-secret-key-2026';

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.json');
const usersPath = path.join(dbDir, 'users.json');

// İlk kurulumda varsayılan admin kullanıcısını oluştur
if (!fs.existsSync(usersPath)) {
    const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
    const defaultUsers = [{ id: 1, username: 'admin', password: defaultPasswordHash, role: 'admin' }];
    fs.writeFileSync(usersPath, JSON.stringify(defaultUsers, null, 2));
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Erişim reddedildi. Token eksik.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
        req.user = user;
        next();
    });
};

// --- LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!fs.existsSync(usersPath)) return res.status(500).json({ error: 'Kullanıcı veritabanı bulunamadı.' });
    
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => u.username === username);
    
    if (!user) return res.status(400).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username, role: user.role });
});

// 1. API: Veritabanını Oku (GET)
app.get('/api/data', authenticateToken, (req, res) => {
    if (fs.existsSync(dbPath)) {
        try {
            const data = fs.readFileSync(dbPath, 'utf-8');
            res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: 'Veritabanı okunamadı' });
        }
    } else {
        res.json({}); // Boş DB
    }
});

// 2. API: Veritabanını Yaz (POST) - GENEL KAYIT
app.post('/api/save', authenticateToken, (req, res) => {
    try {
        const newData = req.body;
        
        // Çakışma Önleyici: Eğer sunucudaki bir fatura ONAYLANDIYSA (APPROVED), 
        // İstemciden eski (PENDING) hali gelse bile APPROVED kalmasını sağla.
        if (fs.existsSync(dbPath)) {
            const currentData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (currentData.osgb_transactions && newData.osgb_transactions) {
                const currentTrans = JSON.parse(currentData.osgb_transactions);
                let newTrans = JSON.parse(newData.osgb_transactions);
                
                const currentMap = new Map();
                currentTrans.forEach(t => currentMap.set(t.id, t));
                
                newTrans = newTrans.map(t => {
                    if (currentMap.has(t.id)) {
                        const existing = currentMap.get(t.id);
                        if (existing.status === 'APPROVED') {
                            t.status = 'APPROVED';
                        }
                    }
                    return t;
                });
                
                newData.osgb_transactions = JSON.stringify(newTrans);
            }
        }

        // ATOMİK YAZMA (Veri bozulmasını önlemek için temp dosyasına yazıp değiştiriyoruz)
        const tempPath = dbPath + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(newData, null, 2));
        fs.renameSync(tempPath, dbPath); // Kesin ve güvenli yer değiştirme

        // Herkesin ekranını güncelle
        io.emit('db_updated');
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Kayıt başarısız' });
    }
});

// 3. API: Sadece Fatura Onaylama (Çakışmaları önlemek için)
app.post('/api/transactions/approve', authenticateToken, (req, res) => {
    try {
        const { id } = req.body;
        if (fs.existsSync(dbPath)) {
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (data.osgb_transactions) {
                const transactions = JSON.parse(data.osgb_transactions);
                const tIndex = transactions.findIndex(t => t.id === id);
                if (tIndex !== -1) {
                    transactions[tIndex].status = 'APPROVED';
                    data.osgb_transactions = JSON.stringify(transactions);
                    
                    const tempPath = dbPath + '.tmp';
                    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
                    fs.renameSync(tempPath, dbPath);
                    
                    // Sadece onaylanan faturayı diğer kullanıcılara bildir
                    io.emit('transaction_approved', { id });
                    return res.json({ success: true });
                }
            }
        }
        res.status(404).json({ error: 'Bulunamadı' });
    } catch (e) {
        res.status(500).json({ error: 'Hata' });
    }
});

// 4. API: Dış Sistemden (Tetkik Takip) Gelen Sağlık Hizmetleri Webhook'u
app.post('/api/webhook/health-services', (req, res) => {
    try {
        const payload = req.body; // Array of referrals or single referral
        const referrals = Array.isArray(payload) ? payload : [payload];
        
        if (fs.existsSync(dbPath)) {
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            let externalServices = [];
            if (data.osgb_external_health) {
                externalServices = JSON.parse(data.osgb_external_health);
            }

            let addedCount = 0;
            referrals.forEach(ref => {
                // Sadece INVOICE (Cari) olanları ve daha önce eklenmemiş olanları al
                if (ref.paymentMethod === 'INVOICE') {
                    const exists = externalServices.find(s => s.referralId === ref.id);
                    if (!exists) {
                        externalServices.push({
                            id: 'ext_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            sourceCompanyName: ref.employee?.company || 'Bilinmiyor',
                            employeeName: ref.employee?.fullName || 'Bilinmiyor',
                            exams: ref.exams || [],
                            amount: ref.totalPrice || 0,
                            date: ref.referralDate || new Date().toISOString(),
                            isBilled: false,
                            referralId: ref.id
                        });
                        addedCount++;
                    }
                }
            });

            if (addedCount > 0) {
                data.osgb_external_health = JSON.stringify(externalServices);
                const tempPath = dbPath + '.tmp';
                fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
                fs.renameSync(tempPath, dbPath);
                
                io.emit('db_updated'); // Frontend'i güncelle
            }
        }
        res.json({ success: true, message: 'Webhook processed' });
    } catch (e) {
        console.error('Webhook hatası:', e);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Otomatik Sunucu Yedeği (Başlangıçta veritabanı bozulmalarına karşı)
if (fs.existsSync(dbPath)) {
    try {
        const backupPath = path.join(dbDir, `database_backup_${new Date().toISOString().split('T')[0]}.json`);
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(dbPath, backupPath);
            console.log(`Günlük sunucu yedeği alındı: ${backupPath}`);
        }
    } catch (err) {
        console.error("Yedekleme hatası:", err);
    }
}

// Statik Dosyaları Sun (React Build Dosyaları)
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    
    // React Router SPA fallback
    app.get('*', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => {
        res.send('OSGB Pro Server API Çalışıyor. UI için uygulamayı build ediniz (npm run build).');
    });
}

// Sunucuyu Başlat
server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================`);
    console.log(`OSGB Sunucusu Başlatıldı!`);
    console.log(`Yerel Ağ Adresi: http://${ip.address()}:${PORT}`);
    console.log(`Lokal Adres: http://localhost:${PORT}`);
    console.log(`===========================================`);
});
