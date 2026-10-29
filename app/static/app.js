'use strict';

/**
 * Dashboard Analisis Anomali FASIH SE2026 - BPS Kabupaten Banyumas
 * Frontend Application Script matching dashboard-anomali.vercel.app aesthetics
 */

// Modern Color System matching Reference Dashboard
const PALET = [
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
];

const STATUS = ['Perbaikan', 'Penjelasan', 'Belum'];
// Status Colors: Perbaikan (blue), Penjelasan (emerald), Belum (rose)
const WARNA_STATUS = ['#3b82f6', '#10b981', '#f43f5e'];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NF = {};
function fmt(v, d = 0) {
  if (v === null || v === undefined) return '–';
  NF[d] ??= new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  return NF[d].format(v);
}
const pct = v => `${fmt(v, 1)}%`;

async function getJSON(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { msg = (await res.json()).detail || msg; } catch (_) {}
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return res.json();
}

function showError(err, awalan = 'Gagal memuat data') {
  const el = $('error');
  if (el) {
    el.hidden = false;
    el.textContent = `${awalan}: ${err.message}`;
  }
}

// ==========================================================================
// Theme Management (Dark / Light Mode)
// ==========================================================================
function getStoredTheme() {
  return localStorage.getItem('theme-mode') || 'dark';
}

function setStoredTheme(theme) {
  localStorage.setItem('theme-mode', theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);

  const icon = $('icon-theme');
  if (icon) {
    icon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'
      : '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
  }

  // Refresh active Chart.js colors if charts are initialized
  if (typeof Chart !== 'undefined' && Object.keys(charts).length > 0) {
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Object.values(charts).forEach(c => {
      try {
        if (c.options?.scales?.x) {
          c.options.scales.x.grid.color = isDark ? '#1e293b' : '#e2e8f0';
          c.options.scales.x.ticks.color = isDark ? '#94a3b8' : '#64748b';
        }
        if (c.options?.scales?.y) {
          c.options.scales.y.ticks.color = isDark ? '#cbd5e1' : '#475569';
        }
        c.update('none');
      } catch (_) {}
    });
  }
}

function initTheme() {
  const current = getStoredTheme();
  applyTheme(current);

  const btn = $('theme-toggle');
  if (btn) {
    btn.onclick = () => {
      const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      setStoredTheme(next);
    };
  }
}

// ==========================================================================
// Modal Kamus Anomali
// ==========================================================================
function initKamusModal() {
  const modal = $('modal-kamus');
  if (!modal) return;

  const open = () => modal.classList.add('active');
  const close = () => modal.classList.remove('active');

  $('btn-buka-kamus')?.addEventListener('click', open);
  $('btn-kamus-filter')?.addEventListener('click', open);
  $('btn-kamus-mobile')?.addEventListener('click', open);
  $('card-kamus-trigger')?.addEventListener('click', e => { e.preventDefault(); open(); });
  $('btn-tutup-kamus')?.addEventListener('click', close);

  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) close();
  });
}

// ==========================================================================
// Shared Components
// ==========================================================================

// Topbar anomaly status indicator
function statusData(r) {
  const el = $('status-data');
  const txt = $('status-data-teks');
  if (!el || !txt) return;

  if (r) {
    el.hidden = false;
    txt.textContent = `${fmt(r.n_anomali)} Anomali`;
    el.title = `${r.file} (diupload ${r.waktu})`;
  } else {
    el.hidden = true;
  }
}

// 4 Top KPI Metric Cards matching reference visual layout
function renderKpiCards(containerId, r, isStatistik = false) {
  const el = $(containerId);
  if (!el) return;

  const kec = r.nama_kec;
  const isKec = !!kec;

  el.innerHTML = `
    <!-- Card 1: Total Anomali -->
    <div class="kpi-card blue">
      <div class="kpi-card-top">
        <div>
          <p class="kpi-label">Total Record Terdata</p>
          <h3 class="kpi-value">${fmt(r.n_anomali)}</h3>
          <p class="kpi-sub">Record Anomali FASIH</p>
        </div>
        <div class="kpi-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>
        </div>
      </div>
      <div>
        <span class="kpi-badge">Dataset Acuan BPS</span>
      </div>
    </div>

    <!-- Card 2: Belum Ditindaklanjuti -->
    <div class="kpi-card rose">
      <div class="kpi-card-top">
        <div>
          <p class="kpi-label">Belum Ditindaklanjuti</p>
          <h3 class="kpi-value">${fmt(r.n_belum)}</h3>
          <p class="kpi-sub">${pct(r.persen_belum)} Membutuhkan Aksi</p>
        </div>
        <div class="kpi-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
      </div>
      <div>
        <span class="kpi-badge">Prioritas Lapangan</span>
      </div>
    </div>

    <!-- Card 3: Selesai Diverifikasi -->
    <div class="kpi-card emerald">
      <div class="kpi-card-top">
        <div>
          <p class="kpi-label">Selesai Diverifikasi</p>
          <h3 class="kpi-value">${fmt(r.n_sudah)}</h3>
          <p class="kpi-sub">${pct(r.persen_sudah)} Terkonfirmasi</p>
        </div>
        <div class="kpi-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
      </div>
      <div>
        <span class="kpi-badge">Diperbaiki / Penjelasan</span>
      </div>
    </div>

    <!-- Card 4: Cakupan Wilayah / Assignment -->
    <div class="kpi-card teal">
      <div class="kpi-card-top">
        <div>
          <p class="kpi-label">${isKec ? 'Wilayah Desa' : 'Cakupan Wilayah'}</p>
          <h3 class="kpi-value">${fmt(isKec ? r.n_desa : r.n_kecamatan)}</h3>
          <p class="kpi-sub">${isKec ? `Desa di Kec. ${esc(kec)}` : `${fmt(r.n_desa)} Desa/Kelurahan`}</p>
        </div>
        <div class="kpi-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
        </div>
      </div>
      <div>
        <span class="kpi-badge">Tahapan Validasi</span>
      </div>
    </div>
  `;
}

// Main Progress Bar Card
function renderProgres(r, wilayah) {
  const el = $('progres-utama');
  if (!el) return;

  el.innerHTML = `
    <section class="card-progres-utama">
      <div class="pu-kiri">
        <div class="pu-label">Progres Tindak Lanjut · ${esc(wilayah)}</div>
        <div class="pu-besar">${pct(r.persen_sudah)}</div>
        <div class="pu-sub">Anomali telah ditindaklanjuti melalui perbaikan data atau penjelasan petugas.</div>
      </div>
      <div class="pu-kanan">
        <div class="bar-track" role="progressbar" aria-valuenow="${r.persen_sudah}" aria-valuemin="0" aria-valuemax="100">
          <div class="bar-fill" style="width:${r.persen_sudah}%"></div>
        </div>
        <div class="pu-legend">
          <span class="legend-item">
            <span class="legend-dot sudah"></span>
            <span>Sudah Ditindaklanjuti: <strong style="color:var(--text-primary); font-family:var(--font-mono);">${fmt(r.n_sudah)}</strong> (${pct(r.persen_sudah)})</span>
          </span>
          <span class="legend-item">
            <span class="legend-dot belum"></span>
            <span>Belum Ditindaklanjuti: <strong style="color:var(--rose-500); font-family:var(--font-mono);">${fmt(r.n_belum)}</strong> (${pct(r.persen_belum)})</span>
          </span>
        </div>
      </div>
    </section>
  `;
}

// ==========================================================================
// Beranda (Homepage) Features
// ==========================================================================
function setLangkah(n) {
  document.querySelectorAll('#langkah li').forEach(li => {
    const k = +li.dataset.langkah;
    li.className = k < n ? 'selesai' : k === n ? 'aktif' : '';
  });
}

async function renderDualHighlights(r) {
  // 1. Render Top 5 Kecamatan Prioritas
  try {
    const rekapData = await getJSON('/api/rekap');
    const top5 = (rekapData.data || [])
      .slice()
      .sort((a, b) => b.belum - a.belum)
      .slice(0, 5);

    const listKec = $('top-kecamatan-list');
    if (listKec) {
      listKec.innerHTML = top5.map((x, i) => {
        const pctBelum = x.anomali ? Math.round((x.belum / x.anomali) * 100) : 0;
        return `
          <div class="ranking-row">
            <div class="ranking-row-top">
              <div class="ranking-name">
                <span class="ranking-num-badge">${i + 1}</span>
                <span>${esc(x.label)}</span>
              </div>
              <div class="ranking-stat">
                <b>${fmt(x.belum)} Belum</b>
                <span style="color:var(--text-muted);">/</span>
                <span>${fmt(x.anomali)} Total</span>
              </div>
            </div>
            <div class="ranking-bar">
              <div class="ranking-bar-fill" style="width:${pctBelum}%" title="${pctBelum}% Belum Ditindaklanjuti"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (_) {}

  // 2. Render Kategori Anomali Breakdown
  try {
    const katData = await getJSON('/api/statistik/jenis');
    const listKat = $('kategori-anomali-list');
    if (listKat && katData.data) {
      listKat.innerHTML = katData.data.slice(0, 6).map((x, i) => {
        const warna = PALET[i % PALET.length];
        return `
          <div class="category-row">
            <div class="category-left">
              <span class="category-dot" style="background-color:${warna}"></span>
              <span class="category-name" title="${esc(x.label)}">${esc(x.label)}</span>
            </div>
            <div class="category-stat">
              <b>${fmt(x.n)}</b>
              <span>(${pct(x.persen)})</span>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (_) {}
}

function tampilRingkasan(r) {
  statusData(r);
  setLangkah(2);

  // Show Alert Banner
  const alertBanner = $('alert-banner');
  if (alertBanner) {
    alertBanner.hidden = false;
    $('alert-banner-title').textContent = `Perhatian: ${fmt(r.n_belum)} Kasus Anomali (${pct(r.persen_belum)}) Belum Ditindaklanjuti`;
    $('alert-banner-desc').textContent = `Kecamatan ${esc(r.kec_terendah)} membutuhkan alokasi verifikasi prioritas oleh Petugas PML/PCL.`;
  }

  // Active File Card
  $('upload').hidden = true;
  $('aktif').hidden = false;
  $('aktif-file').textContent = r.file;
  $('aktif-waktu').textContent = `Diupload ${r.waktu} · klik "Ganti File" untuk mengunggah dataset baru`;

  // Render 4 KPI Cards
  renderKpiCards('kpi-grid', r);

  // Render Main Progress
  renderProgres(r, 'Kab. Banyumas');

  // Render Dual Highlights (Top 5 & Categories)
  renderDualHighlights(r);

  $('hasil').hidden = false;
}

async function initBeranda() {
  initTheme();
  initKamusModal();

  const input = $('file');
  const zone = $('dropzone');
  const teks = $('dropzone-teks');
  const teksAwal = teks ? teks.innerHTML : '';
  const ganti = $('ganti');

  setLangkah(1);

  // Smooth scroll and click bindings
  $('btn-top-upload')?.addEventListener('click', () => {
    $('upload')?.scrollIntoView({ behavior: 'smooth' });
    input?.click();
  });
  $('btn-hero-upload')?.addEventListener('click', () => {
    $('upload')?.scrollIntoView({ behavior: 'smooth' });
    input?.click();
  });

  async function upload(file) {
    $('error').hidden = true;
    zone?.classList.add('sibuk');
    $('aktif')?.classList.add('sibuk');
    if (teks) teks.textContent = `Memproses ${file.name}…`;
    if (ganti) ganti.textContent = 'Memproses…';

    const form = new FormData();
    form.append('file', file);
    try {
      tampilRingkasan(await getJSON('/api/upload', { method: 'POST', body: form }));
    } catch (err) {
      showError(err, 'Upload gagal');
    } finally {
      zone?.classList.remove('sibuk');
      $('aktif')?.classList.remove('sibuk');
      if (teks) teks.innerHTML = teksAwal;
      if (ganti) ganti.textContent = 'Ganti File';
      if (input) input.value = '';
    }
  }

  if (input) {
    input.onchange = () => input.files[0] && upload(input.files[0]);
  }

  // Drag and drop handlers
  for (const el of [zone, $('aktif')].filter(Boolean)) {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('over');
      if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
    });
  }

  try {
    tampilRingkasan(await getJSON('/api/ringkasan'));
  } catch (err) {
    if (err.status !== 409) showError(err);
    statusData(null);
  }
}

// ==========================================================================
// Statistik & Monitoring Page Charts & Logic
// ==========================================================================
const charts = {};

// Plugin: Teks total di tengah diagram donat
const teksTengah = {
  id: 'teksTengah',
  afterDraw(chart) {
    const t = chart.config.options.teksTengah;
    if (!t) return;
    const { ctx, chartArea: a } = chart;
    const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
    const isDark = document.documentElement.classList.contains('dark');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = '700 24px var(--font-sans)';
    ctx.fillText(t.value, x, y - 2);
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = '500 12px var(--font-sans)';
    ctx.fillText(t.label, x, y + 18);
    ctx.restore();
  },
};

// Plugin: Nilai di ujung batang horizontal
const labelUjung = {
  id: 'labelUjung',
  afterDatasetsDraw(chart) {
    const ds = chart.data.datasets[0];
    if (!ds.labelUjung) return;
    const { ctx } = chart;
    const isDark = document.documentElement.classList.contains('dark');
    ctx.save();
    ctx.font = '600 11px var(--font-mono)';
    ctx.fillStyle = isDark ? '#cbd5e1' : '#475569';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      if (ds.labelUjung[i]) {
        ctx.fillText(ds.labelUjung[i], bar.x + 8, bar.y);
      }
    });
    ctx.restore();
  },
};

function makeChart(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart($(id), config);
}

function tooltipLabel(d, unit) {
  return ctx => ` ${fmt(d.data[ctx.dataIndex].n)} ${unit} (${pct(d.data[ctx.dataIndex].persen)})`;
}

function pemendek(wrap) {
  const max = wrap.clientWidth < 480 ? 14 : wrap.clientWidth > 900 ? 44 : 24;
  return s => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
}

const sumbuX = (opsi = {}) => {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    beginAtZero: true,
    grid: { color: isDark ? '#1e293b' : '#e2e8f0' },
    border: { color: isDark ? '#334155' : '#cbd5e1' },
    ticks: { color: isDark ? '#94a3b8' : '#64748b', callback: v => fmt(v) },
    ...opsi,
  };
};

const sumbuY = () => {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    grid: { display: false },
    border: { color: isDark ? '#334155' : '#cbd5e1' },
    ticks: { color: isDark ? '#cbd5e1' : '#475569', autoSkip: false },
  };
};

function renderDonat(d) {
  const colors = d.id === 'status' ? WARNA_STATUS : PALET;
  const total = d.data.reduce((s, x) => s + x.n, 0);
  const isDark = document.documentElement.classList.contains('dark');

  makeChart('chart-donat', {
    type: 'doughnut',
    data: {
      labels: d.data.map(x => x.label),
      datasets: [{
        data: d.data.map(x => x.n),
        backgroundColor: colors,
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: 2,
      }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '68%',
      animation: false,
      teksTengah: { value: fmt(total), label: d.unit },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          callbacks: { label: tooltipLabel(d, d.unit) },
        },
      },
    },
  });

  $('catatan-donat').textContent = d.catatan;
  $('tabel-donat').innerHTML = `<table>
    <thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">Persentase</th></tr></thead>
    <tbody>${d.data.map((x, i) => `<tr>
      <td><i class="swatch" style="background:${colors[i % colors.length]}"></i>${esc(x.label)}</td>
      <td class="num">${fmt(x.n)}</td>
      <td class="num">${pct(x.persen)}</td>
    </tr>`).join('')}
    <tr class="total"><td>Total</td><td class="num">${fmt(total)}</td><td class="num">100,0%</td></tr>
    </tbody>
  </table>`;
}

function renderBatang(d) {
  const wrap = $('wrap-batang');
  const pendek = pemendek(wrap);
  const persen = d.nilai === 'persen';
  const isDark = document.documentElement.classList.contains('dark');

  wrap.style.height = `${d.data.length * 30 + 50}px`;

  makeChart('chart-batang', {
    type: 'bar',
    data: {
      labels: d.data.map(x => pendek(x.label)),
      datasets: [{
        data: d.data.map(x => (persen ? x.persen : x.n)),
        backgroundColor: '#06b6d4',
        hoverBackgroundColor: '#22d3ee',
        borderRadius: 6,
        borderSkipped: 'start',
        maxBarThickness: 20,
        labelUjung: d.data.map(x => (persen ? `${pct(x.persen)} (${fmt(x.n)}/${fmt(x.total)})` : `${fmt(x.n)} (${pct(x.persen)})`)),
      }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { right: 120 } },
      scales: {
        x: sumbuX(persen ? { max: 100, ticks: { callback: v => `${v}%` } } : {}),
        y: sumbuY(),
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: items => d.data[items[0].dataIndex].label,
            label: persen
              ? ctx => { const x = d.data[ctx.dataIndex]; return ` ${pct(x.persen)} sudah (${fmt(x.n)} dari ${fmt(x.total)} anomali)`; }
              : tooltipLabel(d, d.unit),
          },
        },
      },
    },
  });

  $('catatan-batang').textContent = d.catatan;
}

function renderTumpuk(d) {
  const wrap = $('wrap-tumpuk');
  const pendek = pemendek(wrap);
  const isDark = document.documentElement.classList.contains('dark');

  wrap.style.height = `${d.data.length * 30 + 80}px`;

  makeChart('chart-tumpuk', {
    type: 'bar',
    data: {
      labels: d.data.map(x => pendek(x.label)),
      datasets: STATUS.map((s, i) => ({
        label: s === 'Belum' ? 'Belum ditindaklanjuti' : `Sudah – ${s.toLowerCase()}`,
        data: d.data.map(x => x.persen[s]),
        backgroundColor: WARNA_STATUS[i],
        maxBarThickness: 20,
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: { right: 1 },
      })),
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: sumbuX({ stacked: true, max: 100, ticks: { callback: v => `${v}%` } }),
        y: { ...sumbuY(), stacked: true },
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: isDark ? '#cbd5e1' : '#475569',
            font: { weight: '600' },
          },
        },
        tooltip: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: items => `${d.data[items[0].dataIndex].label} (${fmt(d.data[items[0].dataIndex].n)} anomali)`,
            label: ctx => {
              const x = d.data[ctx.dataIndex], s = STATUS[ctx.datasetIndex];
              return ` ${ctx.dataset.label}: ${fmt(x.rincian[s])} (${pct(x.persen[s])})`;
            },
          },
        },
      },
    },
  });

  $('catatan-tumpuk').textContent = d.catatan;
}

const namaWilayah = x => (x.kode
  ? `<a href="?kec=${esc(x.kode)}" data-kec="${esc(x.kode)}" style="font-weight:700; color:var(--cyan-600);">${esc(x.label)}</a>`
  : `<span style="font-weight:600;">${esc(x.label)}</span>`);

function renderPrioritas(r) {
  const bawah = r.data.filter(x => x.persen_sudah < r.persen_sudah);
  const unit = r.wilayah.toLowerCase();

  $('prioritas-ket').textContent = bawah.length
    ? `${bawah.length} ${unit} berada di bawah rata-rata capaian (${pct(r.persen_sudah)})${r.data[0]?.kode ? ' · klik wilayah untuk rincian per desa' : ''}`
    : 'Semua wilayah telah mencapai atau berada di atas rata-rata.';

  $('prioritas').innerHTML = bawah.length
    ? bawah.slice(0, 10).map(x => {
      const isi = `${esc(x.label)} <b>${pct(x.persen_sudah)}</b><small>(${fmt(x.belum)} belum)</small>`;
      return x.kode
        ? `<a class="chip" href="?kec=${esc(x.kode)}" data-kec="${esc(x.kode)}">${isi}</a>`
        : `<span class="chip">${isi}</span>`;
    }).join('') + (bawah.length > 10 ? `<a class="chip lagi" href="#rekap">+${bawah.length - 10} lainnya</a>` : '')
    : `<p class="chart-note" style="margin:0;">Seluruh ${unit} sudah berada di atas angka capaian keseluruhan (${pct(r.persen_sudah)}).</p>`;
}

function renderRekap(r) {
  $('judul-rekap').textContent = `Rekap Monitoring Wilayah (${esc(r.wilayah)})`;
  $('catatan-rekap').textContent = `Diurutkan dari persentase penyelesaian terendah. Baris bertanda merah berada `
    + `di bawah capaian keseluruhan (${pct(r.persen_sudah)}).${r.data[0]?.kode ? ' Klik nama kecamatan untuk melihat rincian per desa.' : ''}`;

  $('tabel-rekap').innerHTML = `<table>
    <thead>
      <tr>
        <th>${esc(r.wilayah)}</th>
        <th class="num">Total Anomali</th>
        <th class="num">Assignment</th>
        <th class="num">Sudah</th>
        <th class="num">Belum</th>
        <th>% Sudah Ditindaklanjuti</th>
      </tr>
    </thead>
    <tbody>
      ${r.data.map(x => `
        <tr class="${x.persen_sudah < r.persen_sudah ? 'rendah' : ''}">
          <td>${namaWilayah(x)}</td>
          <td class="num">${fmt(x.anomali)}</td>
          <td class="num">${fmt(x.assignment)}</td>
          <td class="num" style="color:var(--emerald-600); font-weight:700;">${fmt(x.sudah)}</td>
          <td class="num" style="color:var(--rose-500); font-weight:700;">${fmt(x.belum)}</td>
          <td style="white-space:nowrap;">
            <div class="table-progress"><span class="table-progress-fill" style="width:${x.persen_sudah}%"></span></div>
            <span class="num" style="font-weight:700;">${pct(x.persen_sudah)}</span>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

async function initStatistik() {
  initTheme();
  initKamusModal();

  Chart.register(teksTengah, labelUjung);
  Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
  Chart.defaults.color = document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b';

  let kecamatan;
  try {
    kecamatan = await getJSON('/api/kecamatan');
  } catch (err) {
    if (err.status !== 409) showError(err);
    statusData(null);
    $('kosong').hidden = false;
    return;
  }

  $('konten').hidden = false;
  $('filterbar').hidden = false;

  const kec = $('pilih-kec');
  kec.innerHTML = '<option value="">Seluruh Kab. Banyumas</option>'
    + kecamatan.map(k => `<option value="${esc(k.kode)}">Kec. ${esc(k.nama)}</option>`).join('');

  const dariUrl = new URLSearchParams(location.search).get('kec');
  if (kecamatan.some(k => k.kode === dariUrl)) kec.value = dariUrl;

  const setup = (pilihan, q, grafik, selectId, render) => {
    const sel = $(selectId), dipilih = sel.value;
    sel.innerHTML = pilihan.filter(p => p.grafik === grafik).map(p => `<option value="${p.id}">${esc(p.judul)}</option>`).join('');
    if (dipilih) sel.value = dipilih;
    const load = () => getJSON(`/api/statistik/${sel.value}${q}`).then(render).catch(showError);
    sel.onchange = load;
    return load();
  };

  const muat = async () => {
    $('error').hidden = true;
    $('konten').classList.add('memuat');

    const kode = kec.value;
    const nama = kode ? kec.selectedOptions[0].textContent : '';
    const q = kode ? `?kec=${encodeURIComponent(kode)}` : '';

    history.replaceState(null, '', `/statistik${q}${location.hash}`);
    $('unduh').href = `/api/ekspor${q}`;

    $('jejak').innerHTML = kode
      ? `<a href="/statistik" data-kec="">Kab. Banyumas</a><span>›</span><b>${esc(nama)}</b>`
      : '<b>Kab. Banyumas</b><span class="petunjuk">pilih kecamatan untuk rincian per desa</span>';

    $('judul-halaman').textContent = kode ? `Monitoring ${nama}` : 'Dashboard Analisis & Visualisasi Grafik';

    const [r, pilihan] = await Promise.all([
      getJSON(`/api/ringkasan${q}`),
      getJSON(`/api/pilihan${q}`),
    ]);

    statusData(r);
    $('info-file').textContent = `Dataset: ${r.file} · diunggah ${r.waktu}`;

    // Render 4 KPI cards and Main Progress
    renderKpiCards('tiles-kpi', r, true);
    renderProgres(r, kode ? nama : 'Kab. Banyumas');

    // Quick stats badge on header
    const quickBadge = $('quick-stats-badge');
    if (quickBadge) {
      quickBadge.innerHTML = `
        <span style="padding:0.25rem 0.625rem; border-radius:6px; background:rgba(59,130,246,0.1); color:#3b82f6; font-weight:700;">Total: ${fmt(r.n_anomali)}</span>
        <span style="padding:0.25rem 0.625rem; border-radius:6px; background:rgba(244,63,94,0.1); color:#f43f5e; font-weight:700;">Belum: ${fmt(r.n_belum)} (${pct(r.persen_belum)})</span>
        <span style="padding:0.25rem 0.625rem; border-radius:6px; background:rgba(16,185,129,0.1); color:#10b981; font-weight:700;">Selesai: ${fmt(r.n_sudah)}</span>
      `;
    }

    await Promise.all([
      setup(pilihan, q, 'donat', 'pilih-donat', renderDonat),
      setup(pilihan, q, 'batang', 'pilih-batang', renderBatang),
      setup(pilihan, q, 'tumpuk', 'pilih-tumpuk', renderTumpuk),
      getJSON(`/api/rekap${q}`).then(rekap => {
        renderPrioritas(rekap);
        renderRekap(rekap);
      }),
    ]);

    $('konten').classList.remove('memuat');
  };

  const pindah = kode => {
    kec.value = kode;
    history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    muat().catch(showError);
  };

  kec.onchange = () => pindah(kec.value);

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-kec]');
    if (!a) return;
    e.preventDefault();
    pindah(a.dataset.kec);
  });

  await muat();
  if (location.hash === '#rekap') $('rekap')?.scrollIntoView({ behavior: 'smooth' });
}

// Entrypoint
document.addEventListener('DOMContentLoaded', () => {
  const isStatistik = document.body.dataset.page === 'statistik';
  (isStatistik ? initStatistik : initBeranda)().catch(showError);
});
