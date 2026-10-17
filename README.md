# Finora — Modern Personal Finance Platform

Finora adalah platform web manajemen keuangan pribadi yang modern, aman, cepat, dan komprehensif, dibangun dengan arsitektur **Laravel 13 (REST API & Sanctum)** dan **React 19 + TypeScript + Vite + Tailwind CSS**.

---

## ✨ Fitur Utama

1. **Dashboard Finansial Komprehensif**
   - KPI Saldo Bersih (*Net Worth*), Pemasukan, Pengeluaran, dan Tabungan Aktif
   - Grafik interaktif Arus Kas (*Cash Flow Trend*) bulanan & harian
   - Distribusi Pengeluaran berdasarkan kategori (*Donut chart*)
   - Ringkasan rekening, target tabungan, tagihan jatuh tempo, dan transaksi terkini

2. **Pencatatan & Manajemen Transaksi Multi-Fitur**
   - Mendukung Pemasukan (*Income*), Pengeluaran (*Expense*), dan Transfer Antar-Rekening (*Transfer*)
   - Dukungan unggah dan preview bukti/lampiran struk (*Receipt Attachment*)
   - **Ekspor CSV** data transaksi dengan filter aktif
   - **Impor CSV** dengan deteksi otomatis kolom tanggal, nominal, arus, tipe, kategori, dan deskripsi
   - Pencarian real-time dan multi-filter (kategori, rekening, rentang tanggal, jenis arus)

3. **Multi-Rekening & Dompet Digital**
   - Manajemen rekening Bank (BCA, Mandiri, BRI, BNI), E-Wallet (GoPay, OVO, Dana), Kas Tunai, dan Akun Investasi
   - Pelacakan mutasi dan riwayat transaksi per-rekening
   - Penyesuaian saldo (*Balance adjustment*)

4. **Anggaran Bulanan & Smart Budgeting**
   - Penetapan batas anggaran per kategori pengeluaran
   - Pelacakan real-time persentase pemakaian dan sisa anggaran
   - Indikator visual progres (aman, mendekati batas, over-budget)

5. **Target Tabungan (*Savings Goals*)**
   - Pelacakan impian keuangan (Dana Darurat, Rumah Impian, Liburan, Gadget)
   - Pencatatan alokasi/setoran tabungan langsung dari saldo rekening
   - Progres bar persentase dan estimasi sisa waktu

6. **Utang & Piutang (*Debt & Receivable Tracking*)**
   - Pencatatan utang pinjaman dan piutang yang dipinjamkan ke orang lain
   - Pembayaran bertahap (*Partial payment*) atau pelunasan penuh
   - Tanggal jatuh tempo dan status pelunasan (*Unpaid, Partial, Paid*)

7. **Tagihan Berkala & Jatuh Tempo (*Bills & Subscriptions*)**
   - Manajemen tagihan listrik, internet/WiFi, sewa, asuransi, dan langganan bulanan
   - Status tagihan (*Upcoming, Due Soon, Overdue*)
   - Pelunasan tagihan satu-klik yang otomatis memotong saldo rekening terkait

8. **Transaksi Otomatis & Berulang (*Recurring Transactions*)**
   - Otomatisasi transaksi harian, mingguan, bulanan, atau tahunan
   - Eksekusi otomatis transaksi yang telah mencapai jadwal

9. **Laporan & Analisis Finansial Mendalam**
   - Analisis Arus Kas (*Cashflow Analysis*)
   - Perbandingan Pengeluaran vs Pemasukan
   - Tren Saldo Akumulatif
   - Ringkasan statistik keuangan per periode

10. **Kalender Keuangan (*Financial Calendar*)**
    - Tampilan kalender interaktif untuk memantau transaksi, tagihan jatuh tempo, dan jadwal rutin per tanggal

11. **Pusat Notifikasi & Pencarian Global (Ctrl+K)**
    - Modal pencarian cepat di seluruh transaksi, rekening, target, tagihan, dan utang
    - Notifikasi peringatan tagihan mendekati jatuh tempo dan anggaran

---

## 🚀 Cara Menjalankan Aplikasi

### Cara Cepat (Windows 1-Click)
Cukup jalankan file `start.bat` di root direktori dengan mengklik dua kali:
```cmd
start.bat
```
Script ini akan otomatis:
1. Memeriksa & menjalankan MySQL Server portable di `127.0.0.1:3306`
2. Menjalankan Laravel API Server di `http://127.0.0.1:8000`
3. Menjalankan Vite Frontend Server di `http://localhost:5173`
4. Membuka Finora di browser Anda

---

### Cara Manual

#### 1. Menjalankan MySQL Server
Finora menyertakan MySQL 8.4 LTS portable di dalam direktori `.tools/mysql`.
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mysql.ps1
```

#### 2. Menjalankan Backend Laravel API
```powershell
cd backend
..\.tools\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

#### 3. Menjalankan Frontend React Vite
```powershell
cd frontend
npm run dev
```
Akses aplikasi melalui browser: **`http://localhost:5173`**

---

## 🔐 Akun Demo Finora

Untuk langsung mencoba seluruh fitur lengkap dengan data finansial simulasi:
- **Email:** `demo@finora.test`
- **Password:** `password`
- Atau klik tombol **"Masuk sebagai Akun Demo"** pada halaman login untuk masuk secara instan tanpa mengetik.

---

## 🏗️ Struktur Arsitektur & Teknologi

```
d:/FINANCE APP/
├── .tools/                     # Portable Binaries Windows (PHP 8.4, Composer, MySQL 8.4)
├── backend/                    # Laravel 13 REST API
│   ├── app/Models/             # Eloquent Models (User, Transaction, Account, Budget, Goal, dll.)
│   ├── app/Http/Controllers/   # API Controllers (Auth, Transaction, Dashboard, Report, dll.)
│   ├── database/migrations/    # Skema 14 tabel database relasional
│   ├── database/seeders/       # Seeder dataset finansial demo Indonesia
│   └── routes/api.php          # 55+ endpoint API terproteksi Sanctum
├── frontend/                   # React 19 + TypeScript + Vite SPA
│   ├── src/components/         # Komponen UI (Layout, Sidebar, Header, Modals, Primitives)
│   ├── src/pages/              # 12 Halaman (Dashboard, Transactions, Accounts, Budgets, dll.)
│   ├── src/lib/                # API client (Cookie SPA auth), TanStack Query hooks, formatters
│   └── src/types/              # Definisi interface TypeScript
├── scripts/                    # Script otomatisasi startup MySQL & setup lingkungan
└── start.bat                   # Launcher satu-klik untuk Windows
```
