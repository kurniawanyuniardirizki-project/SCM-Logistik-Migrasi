# Rencana Implementasi SCM Logistik

## Ruang lingkup dan keputusan

Project memakai source `SCMLogistik-final.zip` sebagai basis serta mempertahankan tampilan, endpoint, histori, dan operasi utama. Project tetap publik tanpa login sesuai pilihan eksplisit pengguna. Seluruh 514 transaksi yang ditemukan pada URL awal tetap disimpan; histori tidak dihapus.

Aturan tampilan harian disederhanakan: untuk tanggal laporan T, `Saldo Awal` hanya menampilkan sisa closing stock dari tanggal sebelumnya, bukan total Stock In/Out historis. Di Detail Laporan SKU, saldo awal ditampilkan terpisah untuk step 1.4, 1.5, dan 1.6; setiap nilai untuk T harus sama dengan `Sisa` penutupan tanggal sebelumnya pada SKU dan step yang sama. Kolom Stock In Logistik/Produksi dan Stock Out hanya menampilkan pergerakan pada tanggal T. `TOTAL IN` adalah jumlah saldo awal yang terbawa + Stock In pada tanggal T, sebelum Stock Out/Reject. `Sisa` adalah `TOTAL IN` - Stock Out tanggal T - Reject tanggal T. Jika stok lama habis pada hari sebelumnya dan tidak ada transaksi atau saldo pada T, SKU itu tidak ditampilkan. Bila masih ada sisa, hanya jumlah sisa yang dibawa sebagai saldo awal.

Tambahkan halaman publik read-only `Sales Display` pada route `/sales`, dengan pemilih tanggal laporan. Kartu `Total Pisang All Step` menunjukkan saldo awal ditambah Stock In tanggal terpilih (stok tersedia sebelum Out hari itu); kartu Step 1.4/1.5/1.6 serta `Stock Sisa Pisang` menunjukkan sisa akhir setelah Out/Reject pada hari itu. Setiap kartu dapat dibuka untuk rincian SKU, Qty dan reason Stock In hari terpilih; stock yang dibawa dari sebelumnya diberi label `Saldo awal` saja, bukan seluruh histori reason/qty lama.

Sales Display memuat tabel Stock Out read-only berisi total Qty keluar per SKU dan step untuk tanggal terpilih, dengan rincian sumber logistik/produksi dan total keseluruhan. Kartu, tabel dan dashboard memakai batas tanggal yang sama; riwayat transaksi rinci lintas hari hanya disajikan melalui ekspor Excel berdasarkan rentang tanggal.

Pada form Stock Out dashboard operasi, sediakan pilihan `Stock Logistik`, `Stock Produksi`, atau `Gabungan` serta saldo sumber saat ini. Server memvalidasi dalam transaksi terkunci: pilihan sumber tunggal tidak melampaui saldo sumber, sedangkan gabungan memakai logistik lalu produksi; saldo gabungan tidak cukup berarti seluruh posting ditolak tanpa perubahan.

Pertahankan perpindahan SKU atomik pada Stock In. Saat reason utama `Pindah SKU` dipilih, tampilkan pilihan `Reason Stock In` (`return`, `sisa jual`, `tambahan produksi`) dan simpan pilihannya pada transaksi masuk SKU tujuan; transaksi keluar tetap beralasan `Pindah SKU`, dan kedua sisi tetap terhubung sebagai satu transfer. Fitur tarik Excel `.xlsx` dengan rentang inklusif `Asia/Jakarta` ditempatkan di Detail Laporan SKU. Daftar Aktivitas tetap hanya menampilkan transaksi pada tanggal laporan.

## Pendekatan implementasi

- Reuse React/Vite, Express, tRPC, Drizzle, MySQL terkelola, ExcelJS dan Dockerfile dari project.
- Pisahkan query saldo kumulatif internal yang dipakai untuk validasi Stock Out dari snapshot harian untuk UI. Snapshot T menggabungkan closing saldo sebelum hari T sebagai saldo awal dengan agregat transaksi Stock In/Out/Reject hanya pada T; snapshot tidak menampilkan total historis In/Out.
- Tambahkan query read-only `stock.salesDisplay` yang mengembalikan snapshot tanggal, rincian reason Stock In tanggal itu, dan Stock Out harian. `listStockBalances()` tanpa tanggal tetap menjadi sumber saldo aktual untuk form posting.
- Detail Laporan SKU menampilkan saldo awal per step (1.4/1.5/1.6) dan pergerakan hari terpilih; `TOTAL IN` menjumlahkan saldo awal terbawa dan Stock In hari itu, sedangkan `Sisa` akhir mengurangkan Stock Out/Reject dari nilai tersebut.
- Tambahkan helper alokasi Stock Out murni dan unit test terpisah dari database terkelola. Tambahkan `SalesDisplay.tsx`, route `/sales`, navigasi dari dashboard, serta manifest route.
- Bangun opsi SKU dan baris laporan dari gabungan daftar seed, laporan tersimpan, snapshot saldo, dan transaksi tanggal itu agar nama SKU pada ledger tidak terlewat. Riwayat per hari tidak dibatasi 500 baris.
- Pindahkan kontrol rentang dan ekspor ke Detail Laporan SKU; ekspor tetap mencakup riwayat transaksi penuh dalam rentang inklusif.

## Struktur project

- `client/src/pages/Home.tsx`: dashboard operasi, posting Stock In/Out/Reject/transfer, snapshot harian SKU, aktivitas harian, dan ekspor rentang.
- `client/src/pages/SalesDisplay.tsx`: tampilan sales read-only, date selector, kartu saldo harian, detail kartu, dan tabel Stock Out harian.
- `client/src/App.tsx` serta `client/public/manus-routes.json`: routing dan manifest halaman.
- `client/src/index.css`: tema dashboard, tabel padat, kartu sales, serta layout responsif.
- `client/src/lib/`: helper tanggal bisnis dan pembuatan workbook Excel.
- `server/routers.ts`: validasi query/mutasi tRPC publik.
- `server/db.ts`: query snapshot harian, saldo aktual, breakdown Stock In harian, histori dan posting transaksi.
- `server/stock-allocation.ts`: aturan alokasi sumber yang dapat diuji tanpa database.
- `server/*.test.ts`: unit test alokasi/saldo tanpa menulis ke database terkelola.
- `drizzle/schema.ts`, `drizzle/*.sql`, `drizzle/meta/`: skema serta migrasi histori yang sudah ada.
- `scripts/`: alat impor satu-kali; snapshot mentah tidak disimpan di Git.
- `Dockerfile`, `package.json`, `pnpm-lock.yaml`: build container dan dependensi terkunci.

## Desain

- **Gerakan desain:** dashboard operasi logistik kontemporer yang padat data dan terstruktur; pertahankan bahasa visual yang telah disediakan, bukan mendesain ulang.
- **Prinsip inti:** angka mudah dipindai; tindakan posting memiliki hierarki jelas; tanggal snapshot terlihat eksplisit; tabel tidak membaurkan pergerakan harian dan histori lintas hari.
- **Filosofi warna:** hijau gelap dari identitas SCM menandakan kendali dan keandalan; kanvas terang menjaga keterbacaan; aksen amber dan merah tetap terbatas pada step/peringatan sesuai stylesheet sumber.
- **Paradigma layout:** sidebar workspace hijau gelap, topbar ringkas, lalu panel kerja di kanvas terang dengan kartu ringkasan dan tabel transaksi padat.
- **Elemen khas:** logo Sunpride SCM; kartu step stok berwarna; badge read-only; label `Saldo awal` yang membedakan stok terbawa dari Stock In hari ini.
- **Interaksi:** kartu sales dapat dibuka untuk rincian; Sales Display tidak memiliki operasi tulis; pilihan sumber Stock Out menunjukkan ketersediaan dan umpan balik saldo.
- **Animasi:** pertahankan transisi pendek yang sudah ada; tanpa animasi dekoratif pada angka atau tabel.
- **Tipografi:** pertahankan font dan hierarki CSS sumber; gunakan ukuran/padding kompak tanpa mengorbankan keterbacaan SKU/Qty.
- **Esensi brand:** workspace operasi stok untuk tim SCM/logistik agar transaksi, saldo, dan riwayat SKU terlacak; presisi, tenang, operasional.
- **Suara brand:** label langsung dan faktual. Contoh: “Saldo awal hanya menampilkan stok yang masih tersisa.” “Histori lintas tanggal tersedia di Excel.”
- **Wordmark & logo:** gunakan logo Sunpride SCM yang disertakan di ZIP bersama wordmark dashboard yang sudah ada.
- **Warna brand:** gunakan hijau utama identitas SCM dari stylesheet sumber.

## Deployment

Gunakan server/container dan database MySQL terkelola project baru. Runtime Preview memakai port yang tercatat; deployment container menggunakan `Dockerfile` dan health path `/api/health`. Project tetap publik tanpa login. Simpan revisi di repository kanonik Manus; auto-publish tetap nonaktif dan publikasi versi akhir mengikuti konfirmasi yang diminta platform.
