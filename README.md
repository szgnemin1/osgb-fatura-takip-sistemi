<div align="center">

  <img src="public/logo.svg" alt="OSGB Fatura Takip Logo" width="100" height="100" />

  # 🏥 OSGB Fatura & Cari Takip Sistemi (v2.2.0)

  **OSGB ve Hizmet Sektörü İçin Gelişmiş Finans, Hakediş ve Çoklu Fatura Kesim Platformu**

  <p>
    Otomatik hakediş ayrıştırma, çoklu operatör fatura kesim portalı, akıllı tetkik eşleştirme motoru ve <br>
    <strong>SQLite WAL Modu</strong> ile güçlendirilmiş, yüksek performanslı hibrit finans yönetim çözümü.
  </p>

  <p>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React 18"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-4.9-blue?style=for-the-badge&logo=typescript" alt="TypeScript"></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js" alt="Node.js"></a>
    <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite" alt="SQLite WAL"></a>
    <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-Realtime-black?style=for-the-badge&logo=socket.io" alt="Socket.io"></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/TailwindCSS-v3-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-NonCommercial-red?style=for-the-badge" alt="License: Non-Commercial"></a>
  </p>

</div>

---

## 📋 İçindekiler
- [Öne Çıkan Özellikler](#-öne-çıkan-özellikler)
- [Mimari & Çalışma Prensibi](#-mimari--çalışma-prensibi)
- [Çoklu Fatura Kesim Portalı & 4 Haneli Dinamik Güvenlik](#-çoklu-fatura-kesim-portalı--4-haneli-dinamik-güvenlik)
- [Akıllı Tetkik & Sağlık Takip Entegrasyonu](#-akıllı-tetkik--sağlık-takip-entegrasyonu)
- [Teknoloji Yığını](#-teknoloji-yığını)
- [Kurulum & Hızlı Başlangıç](#-kurulum--hızlı-başlangıç)
- [Windows Servis ve Arka Plan Başlatıcılar](#-windows-servis-ve-arka-plan-başlatıcılar)
- [API Uç Noktaları](#-api-uç-noktaları)
- [Güvenlik & Veri Gizliliği](#-güvenlik--veri-gizliliği)

---

## 🌟 Öne Çıkan Özellikler

### 1. 👥 Çoklu Kullanıcı Fatura Kesim Portalı (`/#/kesim`)
* **İş Paylaşımı Motoru:** Ay başında kesilecek yüzlerce fatura, seçilen operatör sayısına (2, 3, 4, 5+ kişi) anında eşit ve adil şekilde paylaştırılır.
* **Tahmin Edilemeyen 4 Haneli Güvenlik Şifreleri:** Her operatöre özel rastgele ve güvenli 4 haneli PIN kodu atanır.
* **Tek Tıkla Şifre Döndürme (Rotate):** Yönetici dilediği an şifreleri tek tıkla yenileyebilir; devam eden oturumlar kesintiye uğramaz.
* **WhatsApp Formatında Paylaşım:** Tüm operatörlerin özel link ve 4 haneli şifreleri WhatsApp grubuna tek tıkla yapıştırılacak formatta kopyalanır.
* **Birebir Aynı Kompakt Masaüstü Tasarımı:** Kesim ekranı, ana sistemdeki `Kesilecek Faturalar` tablosuyla birebir aynı kullanıcı dostu tasarıma sahiptir.

### 2. ⚡ SQLite + WAL (Write-Ahead Logging) Modu
* **Eşzamanlı Okuma & Yazma:** Klasik JSON/dosya kilitleme problemlerini sıfırlayan `WAL` modu ile aynı anda onlarca kullanıcı işlem yapabilir.
* **Yüksek Güvenilirlik:** Elektrik kesintisi veya ani kapanmalarda veri bütünlüğü korunur (`PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 10000;`).

### 3. 🔬 Tetkik ve Sağlık Taraması Otomatik Eşitleme
* **Akıllı Firma İsmi Normalizasyonu:** Farklı yazılan firma ünvanlarını (LTD, ŞTİ, A.Ş. ekleri, noktalama ve Türkçe karakter farkları) akıllı algoritmalarla eşleştirir.
* **Kayıp Sevk Önleme:** Tetkik takip sistemindeki faturalandırılacak sevkler otomatik olarak Fatura Takip sistemine aktarılır, geçmiş faturalarla karşılaştırılarak mükerrer kayıtlar önlenir.

### 4. 🧮 Gelişmiş Hakediş ve Fiyatlandırma Motoru
* **Otomatik Hizmet Ayrımı:** Kesilen faturadan **Uzman Payı**, **Hekim Payı** ve **Sağlık Payı** KDV oranlarına ve sözleşme yüzdelerine göre otomatik hesaplanır.
* **Esnek Sözleşme Tipleri:**
  * **Standart Model:** Taban Ücret + ((Çalışan Sayısı - Taban Limit) × Ekstra Birim Fiyat)
  * **Toleranslı Model:** Belirli çalışan artış yüzdelerine (%10, %20) kadar fiyat koruması
  * **Kademeli (Tiered) Model:** Personel aralıklarına göre dinamik fiyatlandırma
  * **Sadece Uzman / Sadece Hekim:** Tekil hizmet veren firmalar için özel vergilendirme ve oranlama

### 5. ⚡ Hızlı Kesim ve Akıllı Kopyalama Araçları
* **Tek Tıkla Kopyalama Rozetleri:** VKN, Firma Ünvanı, Adres ve Tutar e-Fatura portalına yapıştırmak için saniyeler içinde kopyalanır.
* **`[M]` Butonları:** Resmi hizmet kalem metinlerini tek tıkla kopyalar:
  * `İŞ GÜVENLİĞİ UZMANI HİZMET BEDELİ`
  * `İŞYERİ HEKİMLİĞİ HİZMET BEDELİ`
  * `SAĞLIK HİZMETİ`
* **`[Yazı]` Butonu:** Toplam faturayı e-Fatura formatında Türkçe metne çevirir (Örn: `YALNIZ BİN BEŞ YÜZ TÜRK LİRASI DIR.`).
* **Akıllı Bakiye Paylaşımı:** Firmanın geçmiş cari borcunu ve güncel bakiyesini hesaplayarak WhatsApp şablonu üretir.

---

## 🏗️ Mimari & Çalışma Prensibi

```
┌─────────────────────────────────────────────────────────────┐
│                      İSTEMCİLER                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │     Yönetici UI       │       │    Kesim Portalı      │  │
│  │   (React Desktop)     │       │   (/#/kesim?kod=XXXX) │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
└──────────────┼───────────────────────────────┼──────────────┘
               │ HTTP / REST                   │ Socket.io
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS / EXPRESS                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • JWT & 4 Haneli PIN Doğrulama                        │  │
│  │ • İş Dağıtım Motoru (Batch Invoicing Engine)          │  │
│  │ • Tetkik Entegrasyon Servisi (Akıllı Normalizasyon)   │  │
│  │ • Socket.io Canlı Yayın Odası (batch_updated)         │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  SQLITE3 (WAL ENGINE)                       │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────────┐  │
│  │     firms      │ │  transactions  │ │ invoice_batches │  │
│  └────────────────┘ └────────────────┘ └─────────────────┘  │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────────┐  │
│  │  preparation   │ │    expenses    │ │ external_health │  │
│  └────────────────┘ └────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Çoklu Fatura Kesim Portalı & 4 Haneli Dinamik Güvenlik

1. **Yönetici Dağıtımı Başlatır:**
   * `Kesilecek Faturalar` sayfasında **`👥 Çoklu Kesim`** butonuna basar.
   * Kaç operatörün fatura keseceğini seçer (örn: 3 kişi).
   * Sistem bekleyen faturaları eşit paylaştırarak her operatör için **4 haneli rastgele bir güvenlik şifresi** üretir (`4821`, `7390`, `6104`).
2. **Operatör Portala Bağlanır:**
   * Operatör yerel ağdaki sabit linke (`http://IP:5000/#/kesim`) girip 4 haneli şifresini yazar veya doğrudan WhatsApp linkine tıklar.
   * **Admin şifresi bilmesine gerek yoktur.**
3. **Fatura Kesimi ve Anında Cariye İşleme:**
   * Operatör portalında kestiği faturanın yanındaki yeşil **"✅ Kestim (Onayla)"** butonuna basar.
   * Faturanın durumu SQLite üzerinde anında `APPROVED` olur ve firmanın cari hesabına borç kaydedilir.
   * Tüm bağlı ekranlar Socket.io üzerinden canlı olarak güncellenir.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji / Kütüphane | Kullanım Amacı |
|---|---|---|
| **Frontend** | React 18, TypeScript | Kullanıcı arayüzü ve tip güvenliği |
| **Styling** | Tailwind CSS, Lucide React | Modern koyu tema (`slate-950`), ikon seti |
| **Backend** | Node.js, Express.js | REST API, oturum yönetimi |
| **Veritabanı** | SQLite3 (`sqlite` + WAL Mode) | Sıfır kilitlenmeli, çoklu kullanıcı yerel veritabanı |
| **Canlı Senkronizasyon** | Socket.io | Anlık durum yayını ve ilerleme takibi |
| **Güvenlik** | Helmet, JWT, Bcrypt | Güvenlik başlıkları, şifreli kimlik doğrulama |
| **Raporlama** | XLSX, jsPDF, html-to-image | Excel / PDF ekstre dökümleri |

---

## 🚀 Kurulum & Hızlı Başlangıç

### Gereksinimler
* Node.js v18.0.0 veya üzeri
* npm veya yarn
* Windows / Linux / macOS (Yerel ağ bağlantısı önerilir)

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/szgnemin1/osgb-fatura-takip-sistemi.git
cd osgb-fatura-takip-sistemi
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Frontend'i Derleyin
```bash
npm run build
```

### 4. Sunucuyu Başlatın
```bash
npm start
```

Sunucu varsayılan olarak **`http://localhost:5000`** ve yerel ağ IP'niz üzerinden (Örn: `http://192.168.1.X:5000`) yayına başlayacaktır.

---

## 🖥️ Windows Servis ve Arka Plan Başlatıcılar

Projeyi Windows ortamında tek tıkla konsol penceresi olmadan arka planda başlatmak için hazır betikler mevcuttur:

* **`Sistemi_Baslat.vbs`**: Fatura Takip ve Tetkik Takip sunucularını arka planda (penceresiz) başlatır ve logları kaydeder.
* **`Sistemi_Durdur.vbs`**: Çalışan arka plan süreçlerini temiz bir şekilde sonlandırır.
* **`Start_Servers.bat`**: Geliştiriciler için her iki servisi ayrı konsol pencerelerinde canlı log akışıyla açar.

---

## 📡 API Uç Noktaları

### Kimlik Doğrulama
* `POST /api/login` - Kullanıcı adı ve şifre ile JWT token üretir.

### Veri ve Ayarlar
* `GET /api/data` - Tüm cari, fatura, hazırlık ve firma verilerini getirir.
* `POST /api/save` - SQLite veritabanına veri kaydeder veya günceller.
* `GET /api/server-info` - Sunucunun yerel IP adresini ve sabit portal bağlantısını döner.

### Çoklu Fatura Kesim (Batch Invoicing)
* `POST /api/batches/create` - Bekleyen faturaları eşit paylaştırıp 4 haneli şifreler üretir.
* `GET /api/batches/active` - Aktif paylaşımdaki operatör ilerlemelerini ve canlı istatistikleri döner.
* `POST /api/batches/rotate-codes` - 4 haneli güvenlik şifrelerini anında yeniler / döndürür.
* `POST /api/batches/cancel` - Aktif iş paylaşımını sonlandırır.
* `GET /api/batches/terminal/:code` - Operatörün 4 haneli şifresine göre atanmış faturaları döner.
* `POST /api/batches/terminal/approve` - Faturayı onaylar (`APPROVED`) ve firmanın cari hesabına işler.
* `POST /api/batches/terminal/unapprove` - Yanlışlıkla onaylanan faturayı geri alır.

---

## 🔒 Güvenlik & Veri Gizliliği

* **Veritabanı İzolasyonu:** SQLite dosyaları (`*.sqlite`, `*.sqlite-wal`) ve gerçek müşteri kayıtları varsayılan olarak `.gitignore` dosyasında tutulur; açık kaynak depolara asla sızmaz.
* **İlk Kurulum Kullanıcısı:** Depoda varsayılan olarak `db/users.example.json` yer alır. İlk çalıştırmada sistem otomatik olarak `db/users.json` oluşturur.
* **4 Haneli Güvenlik PIN'i:** Giriş kodları ardışık değildir, tahmin edilemez ve yönetici tarafından istendiğinde tek tıkla rotasyona tabi tutulabilir.

---

## 📄 Lisans & Ticari Satış Yasağı

Bu proje **[PolyForm Noncommercial License 1.0.0](LICENSE)** ile lisanslanmıştır.

> **TİCARİ SATIŞ VE ÜCRETLİ DAĞITIM YASAĞI:**  
> Bu yazılım açık kaynak kodludur; herkes tarafından serbestçe incelenebilir, öğrenilebilir, kişisel veya kurum içi operasyonlarda **ücretsiz** olarak çalıştırılabilir ve geliştirilebilir.  
> Ancak bu yazılımın, kaynak kodlarının veya bu kodlardan türetilen herhangi bir sürümün **doğrudan veya dolaylı olarak ücret karşılığı satılması, pazarlanması, lisanslanması, kiralanması (ücretli SaaS olarak sunulması dahil) veya herhangi bir bedel karşılığında dağıtılması KESİNLİKLE YASAKTIR.**

<div align="center">
  <sub>Telif Hakkı © 2026 Emin Sezgin. Tüm hakları saklıdır.</sub>
</div>
