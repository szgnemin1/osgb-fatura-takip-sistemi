# AI DEVELOPER CONTEXT & GUIDE (v2.2.0)

Bu dosya, bu proje üzerinde çalışacak Yapay Zeka modelleri ve geliştiriciler için sistemin güncel mimarisini, veritabanı yapısını, kurallarını ve iş mantığını anlatır.

---

## 1. Proje Özeti
Bu proje, OSGB (Ortak Sağlık Güvenlik Birimi) firmaları için geliştirilmiş; **React + TypeScript** frontend, **Node.js + Express** backend ve **SQLite (WAL Mode)** veritabanı üzerinde çalışan hibrit bir finans, hakediş ve çoklu fatura kesim sistemidir.

---

## 2. Mimari (Client - Server - SQLite WAL)
Sistem hem yerel masaüstünde hem de yerel ağdaki cihazlarda (Web/Tablet/Mobil) eşzamanlı çalışır.

* **Backend (`server.js`):**
  * Express.js sunucusu (Port 5000).
  * SQLite veritabanı bağlantısı (`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000;`).
  * Socket.io canlı durum yayıncısı (`batch_updated`, `transaction_approved`, `db_updated`).
  * JWT ile korunan yönetici uç noktaları ve 4 haneli PIN ile çalışan operatör terminali.
  * Tetkik Takip entegrasyonu (otomatik sevk senkronizasyonu ve şirket ismi normalizasyonu).

* **Frontend (React 18 + TypeScript):**
  * `HashRouter` mimarisi (örn: `/#/invoices`, `/#/kesim`).
  * `CuttingPortal.tsx`: Operatörlerin faturayı kestiği sade ve hızlı terminal ekranı.
  * `MultiUserCuttingModal.tsx`: Faturaları operatörlere eşit paylaştıran ve 4 haneli şifreleri yöneten modal.
  * `Invoices.tsx`: Fatura yönetimi, onaylama ve cariye işleme ana ekranı.
  * Tailwind CSS (`slate-950`, `slate-900`, `slate-800`).

---

## 3. Kritik İş Mantığı (Business Logic)

### A. Fatura Hazırlık ve Kesim Döngüsü
1. **Hazırlık (Preparation):** Kullanıcı çalışan sayılarını girer.
2. **Hesaplama (Calculation):** Firmanın fiyatlandırma modeline göre tutar hesaplanır.
3. **Bekleyen (Pending Draft):** Fatura `transactions` tablosuna `status: 'PENDING'` ve `type: 'FATURA'` olarak kaydedilir.
4. **Çoklu Kesim Dağıtımı (Batch):** Bekleyen faturalar N operatöre eşit bölünür ve her operatöre 4 haneli rastgele bir güvenlik kodu (`code`) atanır.
5. **Kesim & Onay (Approved):** Operatör portalda faturayı kestiğinde `POST /api/batches/terminal/approve` çağrılır. SQLite'ta faturanın durumu `status: 'APPROVED'` olarak güncellenir ve firmanın cari bakiyesine borç olarak yansır.

### B. Hakediş Payları
* **Uzman Payı:** Firmanın `expertPercentage` oranına ve KDV'ye göre hesaplanır.
* **Hekim Payı:** Firmanın `doctorPercentage` oranına ve KDV'ye göre hesaplanır.
* **Sağlık Payı:** Tetkik sisteminden gelen veya eklenen sağlık hizmetleri KDV'siyle faturaya dahil edilir.

### C. 4 Haneli Dinamik Güvenlik Şifresi
* Şifreler `1000 - 9999` arasında tahmin edilemez biçimde üretilir.
* Yönetici dilediği an `POST /api/batches/rotate-codes` ile şifreleri döndürebilir/yenileyebilir.
* Aktif kesim yapan operatörün faturası yarım kalmaz; yeni oturumlar yeni 4 haneli şifreyi girmek zorundadır.

---

## 4. Dosya Yapısı
```
osgb-fatura-takip/
├── db/
│   ├── users.example.json   # Varsayılan kullanıcı şablonu (admin / admin123)
│   └── database.sqlite      # SQLite veritabanı (WAL modu)
├── src/
│   ├── components/
│   │   ├── MultiUserCuttingModal.tsx  # Çoklu kesim dağıtım modalı
│   │   └── ...
│   ├── pages/
│   │   ├── CuttingPortal.tsx          # 4 haneli şifreli kesim portalı (/#/kesim)
│   │   ├── Invoices.tsx               # Kesilecek faturalar ve geçmiş
│   │   └── ...
│   ├── services/
│   │   └── db.ts                      # Frontend veri yönetim servisi
│   └── types.ts                       # TypeScript veri modelleri
├── server.js                          # Express + SQLite + Socket.io backend
├── Start_Servers.bat                  # Geliştirici başlatıcı
├── Sistemi_Baslat.vbs                 # Penceresiz Windows arka plan başlatıcı
└── package.json
```
