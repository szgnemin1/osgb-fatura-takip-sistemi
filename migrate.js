const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.join(__dirname, 'db');
const jsonPath = path.join(dbDir, 'database.json');
const sqlitePath = path.join(dbDir, 'database.sqlite');

if (!fs.existsSync(jsonPath)) {
    console.error("HATA: database.json bulunamadi.");
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Initialize SQLite
const db = new sqlite3.Database(sqlitePath, (err) => {
    if (err) {
        console.error("SQLite baglanti hatasi:", err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    // 1. Create Tables
    console.log("Tablolar olusturuluyor...");
    
    db.run(`CREATE TABLE IF NOT EXISTS global_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS firms (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        firmId TEXT,
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS preparation (
        firmId TEXT PRIMARY KEY,
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS external_health (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
    )`);

    console.log("Veriler JSON'dan SQLite'a aktariliyor...");

    // Helper to insert array
    const insertArray = (key, tableName) => {
        if (!rawData[key]) return;
        try {
            const arr = JSON.parse(rawData[key]);
            const stmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, ?)`);
            arr.forEach(item => {
                if (item.id) {
                    stmt.run(item.id, JSON.stringify(item));
                }
            });
            stmt.finalize();
            console.log(`${tableName}: ${arr.length} kayit aktarildi.`);
        } catch (e) {
            console.error(`Hata: ${key} aktarilamadi.`, e);
        }
    };

    // Helper for transactions
    const insertTransactions = () => {
        if (!rawData.osgb_transactions) return;
        try {
            const arr = JSON.parse(rawData.osgb_transactions);
            const stmt = db.prepare(`INSERT OR REPLACE INTO transactions (id, firmId, data) VALUES (?, ?, ?)`);
            arr.forEach(item => {
                if (item.id) {
                    stmt.run(item.id, item.firmId || '', JSON.stringify(item));
                }
            });
            stmt.finalize();
            console.log(`transactions: ${arr.length} kayit aktarildi.`);
        } catch (e) {
            console.error(`Hata: osgb_transactions aktarilamadi.`, e);
        }
    };

    // Helper for preparation (key is firmId)
    const insertPreparation = () => {
        if (!rawData.osgb_preparation) return;
        try {
            const arr = JSON.parse(rawData.osgb_preparation);
            const stmt = db.prepare(`INSERT OR REPLACE INTO preparation (firmId, data) VALUES (?, ?)`);
            arr.forEach(item => {
                if (item.firmId) {
                    stmt.run(item.firmId, JSON.stringify(item));
                }
            });
            stmt.finalize();
            console.log(`preparation: ${arr.length} kayit aktarildi.`);
        } catch (e) {
            console.error(`Hata: osgb_preparation aktarilamadi.`, e);
        }
    };

    // Global Settings (Singleton)
    if (rawData.osgb_global_settings) {
        // Zaten JSON string objesi
        db.run(`INSERT OR REPLACE INTO global_settings (id, data) VALUES (1, ?)`, rawData.osgb_global_settings, (err) => {
            if(err) console.error(err);
            else console.log("global_settings: 1 kayit aktarildi.");
        });
    }

    // Run insertions
    insertArray('osgb_firms', 'firms');
    insertTransactions();
    insertPreparation();
    insertArray('osgb_expense_categories', 'expense_categories');
    insertArray('osgb_expenses', 'expenses');
    insertArray('osgb_external_health', 'external_health');

});

db.close((err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Migration (Goc) islemi basariyla tamamlandi! database.sqlite hazir.");
    }
});
