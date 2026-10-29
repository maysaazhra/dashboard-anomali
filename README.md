# Dashboard Monitoring Anomali SE2026 · Kab. Banyumas

Dashboard web berbasis **FastAPI** untuk admin BPS memonitor anomali hasil pendataan SE2026 dan progres tindak
lanjutnya. Data diambil dari file Excel ekspor FASIH *Mikro Anomali (Grouped)* yang diupload lewat dashboard,
lalu diolah dengan statistika deskriptif.

## Menjalankan

```powershell
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt

.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Buka <http://localhost:8000>. Dokumentasi API ada di <http://localhost:8000/docs>. Chart.js disimpan di
`app/static/vendor`, jadi dashboard tetap jalan tanpa internet.

## Alur penggunaan

1. **Beranda → Upload data.** Pilih atau seret file `.xlsx` ekspor FASIH. File dicek kolomnya; bila bukan ekspor
   FASIH Mikro Anomali, muncul pesan kesalahan. Data disimpan di memori server (hilang bila server dimatikan) dan
   bisa diganti kapan saja dengan upload file yang lebih baru.
2. **Beranda → Ringkasan.** Total anomali, assignment, % sudah/belum ditindaklanjuti, jumlah kecamatan di bawah
   rata-rata, kecamatan dengan progres terendah, dan jenis anomali terbanyak.
3. **Statistik & Monitoring.** Filter wilayah (seluruh kabupaten atau satu kecamatan; bila satu kecamatan dipilih,
   rincian wilayah berubah menjadi per desa) berlaku untuk semua grafik:

| Grafik | Pilihan data |
|---|---|
| 1 Diagram donat | status tindak lanjut, kelompok anomali (usaha/keluarga), jumlah anomali per assignment |
| 2 Diagram batang | jenis anomali, jenis yang belum ditindaklanjuti, anomali per kecamatan, belum ditindaklanjuti per kecamatan, **% sudah ditindaklanjuti per kecamatan**, 10 desa anomali terbanyak, 10 desa belum ditindaklanjuti terbanyak |
| 3 Batang bertumpuk | status tindak lanjut per jenis anomali / per kecamatan / per kelompok, diurutkan dari % belum tertinggi |
| Rekap monitoring | tabel per kecamatan (atau desa): anomali, assignment, sudah, belum, % sudah; baris di bawah angka keseluruhan ditandai merah. Tombol **Unduh rekap (Excel)** |

## Unit analisis

Satu baris file FASIH bisa memuat beberapa anomali, jadi setiap anomali dihitung sendiri:
**1 anomali = 1 jenis anomali pada 1 assignment** (file 19 Agustus 2026: 15.179 anomali pada 7.164 assignment).

Pengolahan data: buang baris nomor kolom "(1)..(63)", buang blok duplikat di akhir file, "-" dianggap kosong,
buang nama responden/ID/email petugas/tautan FASIH, lalu urai *Daftar Anomali* menjadi kode U1–U8/K1–K7.
Status tindak lanjut: Perbaikan, Penjelasan (keduanya = sudah), atau Belum.

## Struktur

| Path | Isi |
|---|---|
| `app/analisis.py` | baca & bersihkan file FASIH, tabel frekuensi, rekap monitoring, ekspor Excel |
| `app/main.py` | aplikasi FastAPI (upload dan endpoint API) |
| `app/static/` | halaman dashboard (HTML, CSS, JavaScript, Chart.js) |

## Endpoint

Endpoint data menerima `?kec=<kode 7 digit>` (mis. `3302110`); tanpa parameter berarti seluruh kabupaten.
Sebelum ada file yang diupload, endpoint data mengembalikan status 409.

| Path | Isi |
|---|---|
| `POST /api/upload` | upload file `.xlsx` (form field `file`) |
| `/api/ringkasan` | indikator utama dan info file aktif |
| `/api/kecamatan` | daftar kecamatan untuk filter |
| `/api/pilihan` | daftar pilihan data tiap grafik |
| `/api/statistik/{pilihan}` | data satu grafik beserta catatannya |
| `/api/rekap` | tabel rekap monitoring per kecamatan/desa |
| `/api/ekspor` | unduh rekap per wilayah dan per jenis anomali (.xlsx) |
