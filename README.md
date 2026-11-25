# Elevate Puan

Platform bantuan pertumbuhan untuk UMKM. Pemilik usaha mengisi assessment, lalu Elevate Puan membuat diagnosis masalah usaha, menghitung kesiapan keuangan, merekomendasikan strategi, dan memandu eksperimen 7 hari lengkap dengan check-in harian, evaluasi hasil, serta Growth Insights berbasis AI.

---

## Daftar Isi

1. [Arsitektur](#arsitektur)
2. [Prasyarat](#prasyarat)
3. [Cara Menjalankan (Development)](#cara-menjalankan-development)
4. [Variabel Environment](#variabel-environment)
5. [Setup Supabase](#setup-supabase)
6. [Menjalankan Mesin Rekomendasi (Python)](#menjalankan-mesin-rekomendasi-python)
7. [Build & Production](#build--production)
8. [Testing & Lint](#testing--lint)
9. [Struktur Folder](#struktur-folder)
10. [Halaman Aplikasi](#halaman-aplikasi)
11. [Aturan Bisnis Utama](#aturan-bisnis-utama)
12. [Troubleshooting](#troubleshooting)

---

## Arsitektur

Project ini terdiri dari dua layanan yang berjalan terpisah.

| Layanan | Teknologi | Peran |
| --- | --- | --- |
| **Web + API** (root repo) | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts | Antarmuka, seluruh route `/api/*`, autentikasi, diagnosis, keuangan, eksperimen, dan Growth Insights |
| **Recommendation Engine** (`backend/`) | Python, FastAPI, Pydantic | Mesin rekomendasi deterministik. Tidak menyentuh database dan tidak memanggil AI |
| **Database & Auth** | Supabase (PostgreSQL + Auth) | Penyimpanan data dan sesi login berbasis cookie |
| **AI** | Google Gemini (`@google/genai`) | Narasi rekomendasi dan analisis Growth Insights |

Alur rekomendasi: Next.js membaca data pengguna dari Supabase, mengirimnya ke mesin Python (`POST /recommendations`), meminta Gemini menjelaskan hasilnya, lalu menyimpan hasilnya ke tabel `solution_proposals`.

```
Browser ──► Next.js (/api/*) ──► Supabase (Auth + DB)
                 │
                 ├──► Recommendation Engine (FastAPI, :8000)
                 └──► Google Gemini API
```

---

## Prasyarat

- **Node.js 20 LTS atau lebih baru** dan **npm** (repo memakai `package-lock.json`)
- **Python 3.10 atau lebih baru** (untuk mesin rekomendasi)
- **Akun dan project Supabase**
- **API key Google Gemini** (opsional untuk tampilan dasar, wajib untuk fitur AI)
- Git

---

## Cara Menjalankan (Development)

### 1. Clone repository

```bash
git clone https://github.com/anggitasherly/elevate-puan.git
cd elevate-puan
```

### 2. Install dependency frontend

```bash
npm install
```

### 3. Buat file `.env.local`

Buat file `.env.local` di root project (file `.env*` sudah masuk `.gitignore`, jadi tidak ikut ter-commit):

```env
# Supabase (wajib)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-atau-anon-key>

# Mesin rekomendasi Python (wajib untuk fitur rekomendasi)
RECOMMENDATION_ENGINE_URL=http://localhost:8000
# ENGINE_TOKEN=<opsional>

# Gemini (wajib untuk fitur AI)
GEMINI_API_KEY=<kunci-untuk-growth-insights>
GEMINI_RECOMMENDATION_API_KEY=<kunci-untuk-narasi-rekomendasi>
# GEMINI_RECOMMENDATION_MODELS=model-utama,model-cadangan
```

Penjelasan tiap variabel ada di [Variabel Environment](#variabel-environment).

### 4. Siapkan database Supabase

Ikuti [Setup Supabase](#setup-supabase). Tanpa langkah ini, login dan seluruh API yang membaca database tidak akan berjalan.

### 5. Jalankan mesin rekomendasi (terminal terpisah)

Lihat [Menjalankan Mesin Rekomendasi](#menjalankan-mesin-rekomendasi-python). Langkah ini boleh dilewati kalau kamu hanya mengerjakan halaman yang tidak memakai rekomendasi.

### 6. Jalankan aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 7. Coba alurnya

1. Buka `/signup` dan buat akun.
2. Isi `/assessment` (4 langkah), lalu kirim.
3. Lanjut ke `/business-overview` (diagnosis), `/realistic-condition`, dan `/financial-readiness`.
4. Buka `/opportunity-library` untuk melihat rekomendasi strategi, lalu mulai eksperimen 7 hari.

---

## Variabel Environment

| Variabel | Wajib | Dipakai di | Keterangan |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Ya | `lib/supabase/*` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Ya | `lib/supabase/*` | Publishable (anon) key Supabase. Jangan pakai service role key |
| `RECOMMENDATION_ENGINE_URL` | Untuk rekomendasi | `lib/recommendation/engine-client.js` | Alamat dasar mesin Python, contoh `http://localhost:8000`. Kalau kosong, `GET /api/recommendations/engine` mengembalikan 503 |
| `ENGINE_TOKEN` | Tidak | `lib/recommendation/engine-client.js` | Jika diisi, dikirim sebagai header `X-Engine-Token` ke mesin Python |
| `GEMINI_API_KEY` | Untuk Growth Insights | `lib/ai/gemini.js` | Kalau kosong, `POST /api/growth-insights/ai` mengembalikan 503 |
| `GEMINI_RECOMMENDATION_API_KEY` | Untuk narasi rekomendasi | `lib/recommendation/narrative.js` | Kunci khusus rekomendasi, terpisah dari Growth Insights. Kalau kosong, rekomendasi tetap tampil dengan teks cadangan |
| `GEMINI_RECOMMENDATION_MODELS` | Tidak | `lib/recommendation/narrative.js` | Daftar model dipisah koma. Yang pertama jadi model utama, sisanya cadangan |

> Setelah mengubah `.env.local`, restart `npm run dev`.

---

## Setup Supabase

Repository ini **tidak menyertakan file migrasi SQL**, jadi skema database harus disiapkan dari project Supabase yang sudah ada atau dari tim. Berikut yang dibutuhkan kode.

### Pengaturan Auth

- Aktifkan **Email/Password** di Authentication.
- **Matikan "Confirm email"** (Authentication → Providers → Email) untuk development. Route signup mengharapkan sesi langsung terbuat setelah daftar. Kalau konfirmasi email aktif, signup mengembalikan error 400 walaupun akun sudah terbuat.

### Tabel yang dipakai

| Tabel | Isi |
| --- | --- |
| `profiles` | Profil pengguna |
| `businesses` | Satu usaha per pengguna (`user_id`) |
| `assessment` | Jawaban assessment (`status`: `draft` / `submitted`) dan hasil diagnosis di kolom `ai_diagnosis` |
| `constraints` | Waktu per minggu, ukuran tim, kemampuan digital |
| `financial_readiness` | Hasil perhitungan kesiapan keuangan |
| `playbooks`, `problem_labels`, `playbook_problem_labels` | Katalog strategi untuk mesin rekomendasi |
| `solution_proposals`, `solution_proposal_playbooks` | Rekomendasi yang disimpan |
| `experiments`, `experiment_checkins`, `experiment_results` | Eksperimen 7 hari, check-in harian, dan hasil evaluasi |
| `growth_cycles`, `growth_cycle_experiments` | Siklus pertumbuhan |
| `growth_insights` | Hasil analisis AI (dipakai sebagai cache) |
| `next_growth_diagnoses` | Diagnosis tahap lanjutan |

Fungsi database (RPC) yang dipanggil: `create_experiment_with_growth_cycle`.

### Row Level Security

API membaca data atas nama pengguna yang login (cookie sesi, bukan service role), jadi **RLS harus diaktifkan** dengan policy `SELECT`, `INSERT`, dan `UPDATE` berdasarkan kepemilikan usaha. Jika policy `UPDATE` kurang, beberapa route (mis. `assessment/draft`) akan membalas 500 dengan pesan "belum bisa disimpan".

### Data playbook

Tabel `playbooks` harus berisi katalog strategi, kalau tidak, mesin rekomendasi akan mengembalikan `no_eligible_candidates`. Kolom yang dibaca mesin dan aturannya dijelaskan di [Aturan Bisnis Utama](#aturan-bisnis-utama): `cost_level`, `cost_estimated`, `time_needed`, `team_size`, `skill_needed`, dan label masalah. Playbook dengan format waktu yang tidak terbaca akan dibuang diam-diam oleh mesin.

---

## Menjalankan Mesin Rekomendasi (Python)

Mesin ini adalah service FastAPI yang berdiri sendiri. Modulnya diimpor sebagai `app.*`, jadi **perintah dijalankan dari folder `backend/src/recommendation`**.

```bash
# dari root project
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cd src/recommendation
uvicorn app.main:app --reload --port 8000
```

Cek bahwa service hidup:

```bash
curl http://localhost:8000/health
# {"status":"healthy","service":"recommendation-engine"}
```

Dokumentasi interaktif FastAPI tersedia di:

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

Lalu pastikan `RECOMMENDATION_ENGINE_URL=http://localhost:8000` ada di `.env.local`.

> **Catatan:** `ENGINE_TOKEN` dikirim oleh Next.js sebagai header `X-Engine-Token`, tetapi kode Python di repo ini belum memeriksa header tersebut. Kalau mesin dipasang di jaringan publik, tambahkan verifikasi token atau batasi aksesnya lewat jaringan.

Project juga menyertakan `[tool.vercel] entrypoint = "src.recommendation.app.main:app"` di `backend/pyproject.toml` untuk deploy ke Vercel.

---

## Build & Production

```bash
npm run build
npm run start
```

`npm run start` melayani hasil build di port 3000. Untuk production:

1. Isi semua variabel environment di platform hosting (misalnya Vercel).
2. Deploy mesin Python sebagai service terpisah, lalu isi `RECOMMENDATION_ENGINE_URL` dengan alamat publiknya.
3. Aktifkan kembali konfirmasi email di Supabase kalau diperlukan, dan sesuaikan alur signup.

---

## Testing & Lint

```bash
# Lint frontend
npm run lint

# Test mesin rekomendasi (dari backend/src/recommendation, venv aktif)
cd backend/src/recommendation
pytest
```

Test Python ada di `backend/src/recommendation/tests/` (API, eligibility, feasibility, normalizer, pipeline, ranking, scoring, dan schema).

---

## Struktur Folder

```
elevate-puan/
├── app/
│   ├── (public)/            Landing page
│   ├── (auth)/              /login, /signup
│   ├── (flow)/assessment/   Formulir assessment 4 langkah
│   ├── (app)/               Halaman setelah login (home, business-overview, experiments, insights, ...)
│   ├── api/                 Seluruh route API
│   └── layout.js, globals.css
├── components/              Komponen UI (ui/ = shadcn), per-fitur dikelompokkan
├── lib/
│   ├── supabase/            Client Supabase (server, config, refresh sesi)
│   ├── server/              Helper auth dan response API
│   ├── diagnosis/           Mesin diagnosis awal dan Next Growth
│   ├── recommendation/      Klien mesin Python, narasi Gemini, penyimpanan proposal
│   ├── experiments/         Helper eksperimen dan check-in
│   ├── ai/                  Klien Gemini dan Growth Insights
│   └── constants/           Daftar pertanyaan assessment
├── backend/
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── src/recommendation/
│       ├── app/             main.py, engines/, schemas/
│       └── tests/
├── proxy.js                 Penyegar sesi + proteksi halaman
├── next.config.mjs
└── package.json
```

---

## Halaman Aplikasi

Halaman yang dilindungi login (diatur di `lib/supabase/proxy.js`): `/home`, `/assessment`, `/business-overview`, `/financial-readiness`, `/opportunity-library`, `/realistic-condition`, `/experiments`, `/history`, `/insights`, `/profile`. Pengguna yang sudah login dan membuka `/login` atau `/signup` otomatis diarahkan ke `/home`.

| Path | Fungsi |
| --- | --- |
| `/` | Landing page |
| `/signup`, `/login` | Daftar dan masuk |
| `/assessment` | Assessment usaha (draft tersimpan otomatis) |
| `/business-overview` | Hasil diagnosis usaha |
| `/realistic-condition` | Waktu, tim, dan kemampuan digital |
| `/financial-readiness` | Perhitungan kesiapan keuangan |
| `/opportunity-library` | Rekomendasi strategi |
| `/experiments/rancangan_experimen`, `/experiments/daily`, `/experiments/hasil` | Rancangan, check-in harian, dan hasil eksperimen |
| `/experiments`, `/experiments/[id]` | Dialihkan ke eksperimen aktif (`/experiments/daily`), atau ke halaman Daily untuk eksperimen tertentu. Menu My Experiment membuka halaman Daily |
| `/history` | Riwayat eksperimen |
| `/insights` | Growth Insights |
| `/home`, `/profile` | Dashboard dan profil |

---

## Aturan Bisnis Utama

### Level pertumbuhan dan risk allowance

Level dihitung dan disimpan setiap pengguna menyimpan Financial Readiness (kode di `lib/growth-level.js`, kolom `growth_level` dan `risk_allowance_pct` di tabel `financial_readiness`).

| Level | Syarat | Risk allowance | Playbook yang boleh |
| --- | --- | --- | --- |
| 1 | Belum ada eksperimen selesai | 15% | Gratis |
| 2 | Minimal 1 eksperimen selesai | 20% | Gratis dan berbayar sampai Rp300.000 |
| 3 | Dua eksperimen selesai terakhir untung (net profit lebih dari 0) dan batas aman (surplus x 25%) di atas Rp300.000 | 25% | Semua, termasuk di atas Rp300.000 |

"Eksperimen selesai" hanya yang berstatus `completed`. Eksperimen yang dihentikan atau kedaluwarsa tidak dihitung, dan hasil tanpa net profit dihitung selesai tetapi bukan untung. Level dihitung ulang setiap kali Financial Readiness disimpan, jadi bisa turun kalau eksperimen terbaru rugi. Baris lama yang tersimpan sebelum aturan ini memiliki `growth_level` kosong dan dianggap Level 1.

### Level biaya playbook

`cost_level` 0 dan 1 berarti gratis (Level 1), 2 berarti sampai Rp300.000, dan 3 berarti di atas Rp300.000. Mesin hanya merekomendasikan playbook kalau level pertumbuhan pengguna sama atau lebih tinggi dari level biaya playbook, dan biayanya tidak melebihi anggaran yang direkomendasikan. Saat ini belum ada playbook Level 3 di katalog.

### Ukuran tim

Pilihan di Realistic Condition disimpan sebagai angka: Solo = 1, Tim Kecil = 2 (rentang 2 sampai 5), dan Tim Besar = 6 (lebih dari 5). Playbook menuliskan tim paling kecil yang bisa menjalankannya: playbook solo bisa dipakai semua kategori, playbook tim kecil bisa dipakai tim kecil dan tim besar, dan playbook tim besar hanya untuk tim besar.

### Format waktu playbook

Kolom `time_needed` harus bisa dibaca mesin, misalnya `1 minggu, 3 jam/minggu`, `5-10 jam/minggu`, atau `11+ jam/minggu` (tanda `+` berarti sekian atau lebih). Format yang tidak dikenali membuat playbook dibuang diam-diam.

### Eksperimen

Durasi eksperimen 7 hari. Tidak ada aturan "cakupan eksperimen" (time scope) di mesin rekomendasi: kesesuaian durasi dijaga lewat isi tabel `playbooks`.

---

## Troubleshooting

| Gejala | Penyebab dan solusi |
| --- | --- |
| Redirect terus ke `/login` | Env Supabase belum diisi atau salah, atau sesi belum terbuat. Periksa `.env.local` lalu restart server |
| Signup gagal dengan pesan konfirmasi email | Matikan "Confirm email" di Supabase (lihat [Setup Supabase](#setup-supabase)) |
| `503 Layanan rekomendasi belum dikonfigurasi` | `RECOMMENDATION_ENGINE_URL` belum diisi |
| `503 Layanan rekomendasi sedang tidak dapat dihubungi` | Mesin Python belum jalan atau alamatnya salah. Cek `curl http://localhost:8000/health` |
| `503 Layanan AI belum dikonfigurasi` | `GEMINI_API_KEY` belum diisi |
| Rekomendasi kosong (`no_eligible_candidates`) | Tabel `playbooks` kosong, atau tidak ada strategi yang cocok dengan label masalah, waktu, biaya, tim, atau level pengguna. Saat `npm run dev`, buka `/api/recommendations/engine?debug=1` (saat sudah login) untuk melihat alasan tiap playbook gugur. Mode debug tidak aktif di production |
| `ModuleNotFoundError: app` saat menjalankan uvicorn | Perintah dijalankan dari folder yang salah. Jalankan dari `backend/src/recommendation` |
| API membalas 500 "belum bisa disimpan" | Policy RLS `UPDATE` atau `INSERT` belum ada di tabel terkait |
| Perubahan `.env.local` tidak terbaca | Restart `npm run dev` |

---

## Catatan untuk Developer

- Repo ini memakai versi Next.js yang berbeda dari yang umum dikenal. Lihat `AGENTS.md` dan baca panduan di `node_modules/next/dist/docs/` sebelum mengubah konvensi routing atau konfigurasi.
- Aturan level pertumbuhan ada di satu tempat, `lib/growth-level.js`. Jangan menduplikasinya di tempat lain.
- Koreksi diagnosis dilakukan lewat alur klarifikasi terstruktur (`ClarificationPanel` dan `POST /api/diagnosis`), bukan lewat teks bebas.
- Mesin rekomendasi Python harus dijalankan terpisah dari aplikasi Next.js (lihat [Menjalankan Mesin Rekomendasi](#menjalankan-mesin-rekomendasi-python)).
