"""Dashboard statistik anomali SE2026 Kab. Banyumas."""
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .analisis import PILIHAN, ekspor_excel, judul, load_data, persen_sudah, rekap, ringkasan, statistik

STATIC = Path(__file__).resolve().parent / "static"
MAKS_UKURAN = 50 * 1024 * 1024  # 50 MB
STATE: dict = {}

app = FastAPI(title="Dashboard Statistik Anomali SE2026")
app.mount("/static", StaticFiles(directory=STATIC), name="static")


def ambil_data(kec: str | None = None):
    """Data yang sedang dipakai, difilter ke satu kecamatan bila kec diisi."""
    if "data" not in STATE:
        raise HTTPException(409, "Belum ada data. Upload file Excel FASIH terlebih dahulu di halaman Beranda.")
    data = STATE["data"]
    if not kec:
        return data, None
    data = data[data["Kode Kec"] == kec]
    if data.empty:
        raise HTTPException(404, "Kecamatan tidak ditemukan")
    return data, data["kecamatan"].iloc[0]


@app.get("/", include_in_schema=False)
def halaman_beranda():
    return FileResponse(STATIC / "index.html")


@app.get("/statistik", include_in_schema=False)
def halaman_statistik():
    return FileResponse(STATIC / "statistik.html")


@app.post("/api/upload")
def api_upload(file: UploadFile):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(400, "File harus berformat Excel (.xlsx) hasil ekspor FASIH.")
    isi = file.file.read(MAKS_UKURAN + 1)
    if len(isi) > MAKS_UKURAN:
        raise HTTPException(413, "Ukuran file melebihi 50 MB.")
    try:
        data = load_data(isi)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        raise HTTPException(400, "File tidak bisa dibaca sebagai Excel. Pastikan file tidak rusak.")
    STATE.update(data=data, file=file.filename, waktu=datetime.now().strftime("%d-%m-%Y %H:%M"))
    return api_ringkasan()


@app.get("/api/ringkasan")
def api_ringkasan(kec: str | None = None):
    data, nama_kec = ambil_data(kec)
    return {**ringkasan(data), "nama_kec": nama_kec, "file": STATE["file"], "waktu": STATE["waktu"]}


@app.get("/api/kecamatan")
def api_kecamatan():
    data, _ = ambil_data()
    kec = data.drop_duplicates("Kode Kec").sort_values("kecamatan")
    return [{"kode": k, "nama": n} for k, n in zip(kec["Kode Kec"], kec["kecamatan"])]


@app.get("/api/pilihan")
def api_pilihan(kec: str | None = None):
    _, nama_kec = ambil_data(kec)
    return [{"id": k, "judul": judul(k, nama_kec), "grafik": grafik} for k, (_, grafik) in PILIHAN.items()]


@app.get("/api/statistik/{pilihan}")
def api_statistik(pilihan: str, kec: str | None = None):
    if pilihan not in PILIHAN:
        raise HTTPException(404, "Pilihan data tidak ada")
    data, nama_kec = ambil_data(kec)
    return statistik(data, pilihan, nama_kec)


@app.get("/api/rekap")
def api_rekap(kec: str | None = None):
    data, nama_kec = ambil_data(kec)
    baris = rekap(data, "nama_desa" if nama_kec else "kecamatan").to_dict("records")
    if not nama_kec:  # kode kecamatan dipakai untuk klik drill-down ke rincian desa
        kode = dict(zip(data["kecamatan"], data["Kode Kec"]))
        for x in baris:
            x["kode"] = kode[x["label"]]
    return {"wilayah": "Desa" if nama_kec else "Kecamatan", "persen_sudah": persen_sudah(data), "data": baris}


@app.get("/api/ekspor")
def api_ekspor(kec: str | None = None):
    data, nama_kec = ambil_data(kec)
    nama = f"Rekap_Anomali_{(nama_kec or 'Banyumas').replace(' ', '_')}.xlsx"
    return Response(ekspor_excel(data, nama_kec),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{nama}"'})
