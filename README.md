# DompetKu 💰
### Pengelola Keuangan Pribadi — Lamborghini Design

Aplikasi pencatatan keuangan pribadi dengan desain premium terinspirasi Lamborghini. Dilengkapi enkripsi data, grafik interaktif, dan ekspor laporan.

---

## ✨ Fitur

- 📊 **Dashboard** — 4 kotak ringkasan (Pemasukan, Pengeluaran, Uang yang Ada, Tabungan)
- 📈 **Grafik Interaktif** — Bar, Donut, dan Line chart untuk analisis keuangan
- 💾 **Ekspor PDF & Excel** — Download laporan dalam format profesional
- 🔔 **Pengingat Tagihan** — Notifikasi tagihan rutin bulanan
- 🔒 **Enkripsi AES-256-GCM** — Keamanan data dengan Web Crypto API
- 🌙 **Mode Gelap/Terang** — Toggle tema untuk kenyamanan mata
- 🎯 **Target Tabungan** — Set target dan pantau progress
- 🔍 **Filter & Pencarian** — Cari dan filter transaksi dengan mudah
- 📱 **Responsive** — Tampil sempurna di desktop dan mobile

---

## 🚀 Cara Menjalankan

### Opsi 1: Langsung Buka di Browser
```
Klik 2x pada file index.html
```
> ⚠️ Beberapa fitur mungkin terbatas karena CORS policy pada file://

### Opsi 2: Via XAMPP
1. Copy semua file ke folder `C:\xampp\htdocs\dompetku\`
2. Jalankan **XAMPP** → Start **Apache**
3. Buka browser → `http://localhost/dompetku/`

### Opsi 3: Via Command Prompt (Node.js)
```bash
# Install serve (sekali saja)
npm install -g serve

# Jalankan server
cd "path\ke\folder\ini"
serve .

# Atau tanpa install global:
npx serve .
```
Buka `http://localhost:3000`

### Opsi 4: Via Python
```bash
cd "path\ke\folder\ini"
python -m http.server 8000
```
Buka `http://localhost:8000`

### Opsi 5: Via VS Code
- Install extension **Live Server**
- Klik kanan `index.html` → **Open with Live Server**

---

## 🌐 Deploy ke Vercel

### Langkah-langkah:

1. **Push ke GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - DompetKu Finance App"
   git branch -M main
   git remote add origin https://github.com/username/dompetku.git
   git push -u origin main
   ```

2. **Deploy di Vercel**
   - Buka [vercel.com](https://vercel.com)
   - Login dengan GitHub
   - Klik **"New Project"**
   - Pilih repository **dompetku**
   - Klik **"Deploy"**
   - Selesai! 🎉

### Deploy ke cPanel:
1. Upload semua file ke folder `public_html/dompetku/`
2. Akses via `https://domain-anda.com/dompetku/`

---

## 📁 Struktur File

```
📦 dompetku/
├── 📄 index.html          # Halaman utama (SPA)
├── 🎨 style.css           # Stylesheet (Lamborghini Design)
├── ⚡ app.js              # Logic aplikasi
├── 📋 vercel.json         # Konfigurasi Vercel
├── 📖 README.md           # Dokumentasi ini
└── 🎨 DESIGN-lamborghini.md  # Referensi design system
```

---

## 🔒 Keamanan

- Data disimpan di **localStorage** browser
- Opsi enkripsi **AES-256-GCM** via Web Crypto API
- Password di-hash dengan **PBKDF2** (100.000 iterasi)
- Salt & IV unik untuk setiap enkripsi
- Tidak ada data yang dikirim ke server manapun

---

## 🛠️ Teknologi

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| HTML5 | - | Struktur |
| CSS3 | - | Styling & Animasi |
| JavaScript ES6+ | - | Logic Aplikasi |
| Chart.js | 4.4.4 | Grafik |
| jsPDF | 2.5.1 | Export PDF |
| html2canvas | 1.4.1 | Render HTML ke Canvas |
| SheetJS | 0.20.0 | Export Excel |
| Web Crypto API | - | Enkripsi AES-GCM |

---

## 📜 Lisensi

Dibuat untuk Project Yusuf — Hak Cipta Dilindungi.
