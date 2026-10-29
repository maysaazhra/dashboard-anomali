"""Membaca dan mengolah data anomali FASIH SE2026"""
from io import BytesIO

import pandas as pd

NAMA_ANOMALI = {
    "U1": "Biaya Produksi Dominan", "U2": "Keuntungan Usaha",
    "U3": "Bukan Badan Usaha tetapi Ada Penyertaan Modal Korporasi", "U4": "Data Keuangan MBG",
    "U5": "Konsistensi Aset, Pekerja, dan Produksi Usaha", "U6": "Usaha Menengah/Besar tanpa Internet",
    "U7": "Usaha Menengah/Besar tanpa Laporan Keuangan", "U8": "Perbedaan KBLI 2 Digit Pendataan dan SBR",
    "K1": "KK dan Pasangan Berstatus Cerai/Belum Kawin", "K2": "Umur KK < 10 Tahun dan Rumah Milik Sendiri",
    "K3": "Semua Anggota Keluarga Disabilitas", "K4": "Luas Lantai per Kapita < 3 m2 atau > 200 m2",
    "K5": "Selisih Pendapatan dan Pengeluaran Negatif",
    "K6": "Listrik < Rp100rb / Daya < 900W tetapi Punya Kulkas/AC/Komputer", "K7": "Jumlah Anggota Keluarga > 10 Orang",
}
STATUS = ["Perbaikan", "Penjelasan", "Belum"]
KOLOM_WAJIB = ["No", "Kode Kec", "Nama Kecamatan", "Kode Desa", "Nama Desa/Kel", "Assignment ID", "Daftar Anomali", "Tindak Lanjut"]
KOLOM_IDENTITAS = ["Nama Usaha / Kepala Keluarga", "ID Petugas", "Email Petugas", "Link Fasih"]

# Pilihan data di halaman Statistik: id -> (judul, jenis grafik).
# Kata "kecamatan" diganti "desa" bila halaman difilter ke satu kecamatan.
PILIHAN = {
    "status": ("Status tindak lanjut anomali", "donat"),
    "kelompok": ("Kelompok anomali (usaha/keluarga)", "donat"),
    "per_assignment": ("Jumlah anomali per assignment", "donat"),
    "jenis": ("Jenis anomali", "batang"),
    "belum_jenis": ("Jenis anomali yang belum ditindaklanjuti", "batang"),
    "wilayah": ("Jumlah anomali per kecamatan", "batang"),
    "belum_wilayah": ("Belum ditindaklanjuti per kecamatan", "batang"),
    "progres_wilayah": ("Persentase sudah ditindaklanjuti per kecamatan", "batang"),
    "desa": ("10 desa dengan anomali terbanyak", "batang"),
    "belum_desa": ("10 desa dengan anomali belum ditindaklanjuti terbanyak", "batang"),
    "status_jenis": ("Status tindak lanjut per jenis anomali", "tumpuk"),
    "status_wilayah": ("Status tindak lanjut per kecamatan", "tumpuk"),
    "status_kelompok": ("Status tindak lanjut per kelompok anomali", "tumpuk"),
}


def load_data(isi: bytes) -> pd.DataFrame:
    """Bersihkan data lalu pecah menjadi 1 baris = 1 jenis anomali pada 1 assignment."""
    df = pd.read_excel(BytesIO(isi), dtype=str, engine="calamine")
    kurang = [k for k in KOLOM_WAJIB if k not in df.columns]
    if kurang:
        raise ValueError(f"Kolom tidak ditemukan: {', '.join(kurang)}. "
                         "Pastikan file adalah ekspor FASIH Mikro Anomali (Grouped).")
    df = df[df["No"] != "(1)"].drop_duplicates(subset=df.columns[:18])
    df = df.drop(columns=KOLOM_IDENTITAS, errors="ignore").replace("-", pd.NA)
    df["jenis"] = df["Daftar Anomali"].str.findall(r"Anomali ([UK])\w+ (\d+)").apply(
        lambda x: ["".join(t) for t in x] if isinstance(x, list) else [])
    data = df.explode("jenis").dropna(subset=["jenis"])
    if data.empty:
        raise ValueError("Tidak ada anomali yang terbaca dari kolom 'Daftar Anomali'.")
    data["status"] = data["Tindak Lanjut"].str.extract("(Perbaikan|Penjelasan|Belum)", expand=False)
    data["kelompok"] = data["jenis"].str[0].map({"U": "Usaha", "K": "Keluarga"})
    data["nama_jenis"] = data["jenis"] + " " + data["jenis"].map(NAMA_ANOMALI).fillna("")
    data["kecamatan"] = data["Nama Kecamatan"].str.title()
    data["nama_desa"] = data["Nama Desa/Kel"].str.title()
    data["desa"] = data["nama_desa"] + " (" + data["kecamatan"] + ")"
    return data


def angka(x: float, d: int = 0) -> str:
    """Format angka Indonesia: 15.179 / 2,12."""
    return f"{x:,.{d}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def frekuensi(s: pd.Series, urutan: list | None = None) -> list[dict]:
    c = s.value_counts()
    if urutan:
        c = c.reindex(urutan, fill_value=0)
    return [{"label": k, "n": int(n), "persen": round(100 * n / c.sum(), 1)} for k, n in c.items()]


def deskripsi(s: pd.Series, unit: str) -> str:
    d = s.describe()
    return (f"Rata-rata {angka(d['mean'], 2)} anomali per {unit} (median {angka(d['50%'])}, "
            f"simpangan baku {angka(d['std'], 2)}, minimum {angka(d['min'])}, maksimum {angka(d['max'])}).")


def rekap(data: pd.DataFrame, kolom: str) -> pd.DataFrame:
    """Tabel monitoring: jumlah anomali, sudah/belum, dan % sudah ditindaklanjuti per kategori."""
    g = data.groupby(kolom).agg(anomali=("status", "size"), assignment=("Assignment ID", "nunique"),
                                belum=("status", lambda s: int((s == "Belum").sum())))
    g["sudah"] = g["anomali"] - g["belum"]
    g["persen_sudah"] = (100 * g["sudah"] / g["anomali"]).round(1)
    return g.sort_values(["persen_sudah", "belum"], ascending=[True, False]).rename_axis("label").reset_index()


def persen_sudah(data: pd.DataFrame) -> float:
    return round(100 * (data["status"] != "Belum").mean(), 1)


def ringkasan(data: pd.DataFrame) -> dict:
    n, belum = len(data), int((data["status"] == "Belum").sum())
    kec = rekap(data, "kecamatan")
    terendah = kec.iloc[0]
    return {
        "n_anomali": n,
        "n_assignment": data["Assignment ID"].nunique(),
        "n_kecamatan": data["Kode Kec"].nunique(),
        "n_desa": data["Kode Desa"].nunique(),
        "n_sudah": n - belum,
        "persen_sudah": persen_sudah(data),
        "n_belum": belum,
        "persen_belum": round(100 * belum / n, 1),
        "rata_anomali_per_assignment": round(n / data["Assignment ID"].nunique(), 2),
        "kec_terendah": terendah["label"],
        "kode_kec_terendah": data.loc[data["kecamatan"] == terendah["label"], "Kode Kec"].iloc[0],
        "persen_kec_terendah": float(terendah["persen_sudah"]),
        "n_kec_di_bawah": int((kec["persen_sudah"] < persen_sudah(data)).sum()),
        "jenis_terbanyak": data["nama_jenis"].value_counts().index[0],
    }


def judul(pilihan: str, nama_kec: str | None = None) -> str:
    j = PILIHAN[pilihan][0]
    if nama_kec:
        j = j.replace("per kecamatan", f"per desa (Kec. {nama_kec})")
    return j


def statistik(data: pd.DataFrame, pilihan: str, nama_kec: str | None = None) -> dict:
    """Data satu grafik. nama_kec diisi bila data sudah difilter ke satu kecamatan."""
    grafik = PILIHAN[pilihan][1]
    wilayah, desa = ("nama_desa", "nama_desa") if nama_kec else ("kecamatan", "desa")
    unit_wil = "desa" if nama_kec else "kecamatan"
    belum = data[data["status"] == "Belum"]
    unit, nilai, catatan = "anomali", "n", ""

    if pilihan == "status":
        hasil = frekuensi(data["status"], STATUS)
    elif pilihan == "kelompok":
        hasil = frekuensi(data["kelompok"], ["Usaha", "Keluarga"])
    elif pilihan == "per_assignment":
        per = data.groupby("Assignment ID").size()
        hasil = frekuensi(per.clip(upper=5).map({1: "1", 2: "2", 3: "3", 4: "4", 5: "5 atau lebih"}), ["1", "2", "3", "4", "5 atau lebih"])
        unit, catatan = "assignment", deskripsi(per, "assignment")
    elif pilihan == "jenis":
        hasil = frekuensi(data["nama_jenis"])
    elif pilihan == "belum_jenis":
        hasil = frekuensi(belum["nama_jenis"])
    elif pilihan == "wilayah":
        hasil = frekuensi(data[wilayah])
        catatan = deskripsi(data[wilayah].value_counts(), unit_wil)
    elif pilihan == "belum_wilayah":
        hasil = frekuensi(belum[wilayah])
    elif pilihan == "progres_wilayah":
        r = rekap(data, wilayah)
        hasil = [{"label": x.label, "n": int(x.sudah), "total": int(x.anomali), "persen": float(x.persen_sudah)}
                 for x in r.itertuples()]
        rata = persen_sudah(data)
        bawah = int((r["persen_sudah"] < rata).sum())
        nilai, catatan = "persen", (f"Secara keseluruhan {angka(rata, 1)}% anomali sudah ditindaklanjuti. "
                                    f"{bawah} dari {len(r)} {unit_wil} masih di bawah angka tersebut; "
                                    f"terendah {hasil[0]['label']} ({angka(hasil[0]['persen'], 1)}%).")
    elif pilihan == "desa":
        hasil = frekuensi(data[desa])[:10]
        catatan = deskripsi(data[desa].value_counts(), "desa")
    elif pilihan == "belum_desa":
        hasil = frekuensi(belum[desa])[:10]
        catatan = "Desa-desa ini dapat diprioritaskan untuk penyelesaian tindak lanjut anomali."
    else:  # tumpuk: status_jenis, status_wilayah, status_kelompok
        kolom = {"status_jenis": "nama_jenis", "status_wilayah": wilayah, "status_kelompok": "kelompok"}[pilihan]
        t = pd.crosstab(data[kolom], data["status"]).reindex(columns=STATUS, fill_value=0)
        t = t.loc[(t["Belum"] / t.sum(axis=1)).sort_values(ascending=False).index]
        hasil = [{"label": k, "n": int(r.sum()), "rincian": {s: int(r[s]) for s in STATUS},
                  "persen": {s: round(100 * r[s] / r.sum(), 1) for s in STATUS}} for k, r in t.iterrows()]
        top = hasil[0]
        catatan = (f"Diurutkan dari persentase belum ditindaklanjuti tertinggi. Tertinggi: {top['label']} "
                   f"({angka(top['persen']['Belum'], 1)}% dari {angka(top['n'])} anomali belum ditindaklanjuti).")

    if not hasil:
        catatan = "Tidak ada data untuk pilihan ini."
    elif not catatan:
        top = max(hasil, key=lambda x: x["n"])
        catatan = f"Terbanyak: {top['label']} ({angka(top['n'])} {unit}; {angka(top['persen'], 1)}%)."
    return {"id": pilihan, "judul": judul(pilihan, nama_kec), "grafik": grafik, "unit": unit, "nilai": nilai,
            "data": hasil, "catatan": catatan}


def ekspor_excel(data: pd.DataFrame, nama_kec: str | None = None) -> bytes:
    """Rekap monitoring per wilayah dan per jenis anomali dalam satu file Excel."""
    header = {"label": "", "anomali": "Jumlah anomali", "assignment": "Jumlah assignment",
              "sudah": "Sudah ditindaklanjuti", "belum": "Belum ditindaklanjuti", "persen_sudah": "% sudah"}
    kolom = list(header)
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        for nama, k, label in [("Rekap wilayah", "nama_desa" if nama_kec else "kecamatan", "Desa" if nama_kec else "Kecamatan"),
                               ("Rekap jenis anomali", "nama_jenis", "Jenis anomali")]:
            rekap(data, k)[kolom].rename(columns={**header, "label": label}).to_excel(w, sheet_name=nama, index=False)
            w.sheets[nama].column_dimensions["A"].width = 48
    return buf.getvalue()
