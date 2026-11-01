# TODO SCM Logistik

- [x] **Pertahankan aplikasi dari ZIP dan deploy sebagai project publik baru.** Gunakan source `SCMLogistik-final.zip`, pertahankan dashboard/endpoint, dan project tetap publik tanpa login. **Selesai:** rilis awal `b852e26` dan revisi terakhir `1b3f25c` berhasil dipublikasikan.

- [x] **Pindahkan seluruh history transaksi dari situs lama.** Baca `https://scmlogistik-jaisze9y.manus.space/` saja; jangan mengubah atau menghapus data sumber. Ambil per tanggal agar tidak terkena batas 500, pertahankan `id`, `movedAt`, tipe, SKU, step, Qty, reason, `stockSource`, dan `remark`, serta buat impor idempotent. **Selesai:** 514 ID unik (14 SKU) diimpor sekali; endpoint rentang 4–18 Oktober mengembalikan seluruh 514 transaksi dan data sumber tidak diubah.

- [x] **Tambahkan perpindahan SKU pada Stock In.** Reason `Pindah SKU` menampilkan pilihan SKU asal, SKU tujuan, step, dan Qty. SKU asal harus berbeda; Qty positif dan tidak melebihi saldo; pindah direkam sebagai pasangan Stock Out/Stock In pada step yang sama dengan referensi transfer atomik. **Selesai:** implementasi server transaksional memakai lock dan validasi; field tampil saat reason dipilih.

- [x] **Tambahkan reason Stock In untuk Pindah SKU.** Saat Stock In dengan reason utama `Pindah SKU` dipilih, tampilkan field `Reason Stock In` dengan pilihan wajib `return`, `sisa jual`, atau `tambahan produksi`. Simpan pilihan pada transaksi masuk SKU tujuan; transaksi keluar tetap memiliki reason `Pindah SKU`, sementara `transferId` dan `relatedSku` tetap menghubungkan pasangan transaksi atomik. Alasan masuk terpilih terlihat di aktivitas harian dan ekspor Excel. **Selesai di source:** validasi frontend/server, TypeScript, 21 unit test, dan build lulus; belum dipublikasikan ke situs live.

- [x] **Tampilkan snapshot harian dengan saldo bawaan per step.** Pada tanggal T, `Saldo Awal` hanya berisi sisa closing stock sebelum T, terpisah untuk step 1.4, 1.5, dan 1.6; setiap nilai sama dengan `Sisa` penutupan hari sebelumnya pada SKU dan step yang sama. Stock In Logistik/Produksi, Stock Out, dan Reject hanya berisi transaksi pada T. `TOTAL IN` otomatis menjumlahkan saldo awal yang terbawa + Stock In hari T sebelum Stock Out/Reject. `Sisa` adalah `TOTAL IN` - Stock Out hari T - Reject hari T. **Selesai di source:** TypeScript, 21 unit test, dan build lulus; perubahan belum dipublikasikan ke situs live.

- [x] **Tambahkan Sales Display read-only.** Buat halaman publik `/sales` tanpa form/mutasi posting dan dengan pemilih tanggal laporan. `Total Pisang All Step` menunjukkan saldo awal + Stock In pada tanggal terpilih sebelum Out; kartu Step 1.4, 1.5, 1.6 dan `Stock Sisa Pisang` menunjukkan sisa akhir hari setelah Out/Reject. Setiap kartu dapat diklik untuk melihat SKU, Qty sesuai kartu, dan reason Stock In hari itu; stok bawaan ditandai `Saldo awal`, bukan dipecah menjadi histori hari-hari lama. **Selesai:** route, snapshot harian, kartu dan rincian diuji di Preview.

- [x] **Tambahkan tabel Stock Out pada Sales Display.** Tabel read-only berisi SKU, step, total Qty keluar untuk tanggal laporan terpilih, rincian sumber Logistik/Produksi, serta total keseluruhan. Tabel ini harian dan tidak menampilkan total histori lintas hari. **Selesai:** Preview tanggal 6 Oktober menunjukkan 101 Qty keluar (25 Logistik, 76 Produksi).

- [x] **Berikan pilihan sumber pada posting Stock Out.** Sediakan pilihan `Stock Logistik`, `Stock Produksi`, atau `Gabungan` serta tampilkan ketersediaan saat ini. Sumber tunggal tidak boleh melebihi saldonya; gabungan mengalokasikan logistik lalu produksi dan hanya dapat diposting bila saldo gabungan mencukupi. Bila saldo kurang, tolak seluruh transaksi tanpa perubahan. **Selesai:** pilihan dan saldo terlihat di Preview; alokasi/insufisiensi dilindungi unit test.

- [x] **Letakkan ekspor Excel history di Detail Laporan SKU.** Sediakan tanggal mulai dan akhir yang dapat dipilih; ekspor `.xlsx` hanya memuat seluruh transaksi dalam rentang inklusif `Asia/Jakarta`, tanpa batas 500 baris, dan tetap mencakup ID, waktu, tipe, SKU terkait/transfer bila ada, step, Qty, reason, stock source, serta remark. Aktivitas Stock di layar tetap harian. **Selesai:** rentang 4–18 Oktober menampilkan 514 transaksi dan Preview membuat `.xlsx` berisi seluruh rentang.

- [x] **Padatkan tabel dan tampilkan TOTAL IN.** Kolom `TOTAL IN` tetap terlihat dan ringkas; nilainya menunjukkan saldo awal yang terbawa + Stock In hari laporan sebelum Out/Reject. Tabel mempertahankan keterbacaan SKU/Qty dan dapat discroll pada layar kecil. **Selesai di source:** TOTAL IN per SKU dan footer memakai saldo bawaan + In hari ini.

- [x] **Publikasikan revisi sebelumnya setelah siap.** Simpan snapshot harian, Sales Display, sumber Stock Out, tabel Stock Out, SKU dinamis, dan ekspor di `main` kanonik; publikasikan project publik tanpa login dan jangan mengaktifkan auto-publish. **Selesai:** versi `1b3f25cd226156dec9b870b6560349ce3494ccbc` live di `https://scmlogistik-ykzwhi2m.manus.space`.

- [ ] **Publikasikan revisi terbaru.** Simpan reason Pindah SKU, saldo awal per step, dan rumus TOTAL IN pada project live setelah project binding yang benar tersedia; jangan mengaktifkan auto-publish.

- [x] **Samakan ukuran teks tabel laporan SKU.** SKU, angka, semua header step/kelompok, dan total memakai ukuran teks 10 px; pembedaan visual tetap menggunakan warna dan ketebalan huruf.

- [x] **Perjelas garis tabel dan kecilkan teks tanggal.** Tabel laporan SKU memakai garis kisi berkontras lebih tinggi dengan garis tepi luar; teks tanggal pada pemilih laporan dan rentang Excel berukuran 12 px.
