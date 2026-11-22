const toOptions = (pairs) => pairs.map(([value, label]) => ({ value, label }));

export const assessmentUi = {
  infoTitle: "Kenapa kami tanya ini?",
  autosave: "Jawabanmu tersimpan otomatis",
  selectPlaceholder: "Pilih salah satu",
  multiHint: "Boleh pilih lebih dari satu",
  back: "Kembali",
  saveExit: "Simpan & keluar",
  loading: "Menyiapkan assessment...",
  loadFailed: "Jawabanmu belum bisa dimuat.",
  reload: "Muat ulang",
  saveFailed: "Jawabanmu belum tersimpan. Coba lagi.",
  submitFailed: "Jawabanmu belum bisa dikirim. Coba lagi.",
};

export const storyBox = {
  title: "Ruang curhat",
  badge: "Boleh dilewati",
  description:
    "Ini bukan formulir. Ceritain aja dengan kata-katamu sendiri: apa yang sebenarnya lagi kamu rasain soal bisnismu sekarang?",
  placeholder:
    "Contoh: Aku udah capek posting tiap hari, banyak yang lihat tapi pesanan nggak naik-naik, dan aku bingung harus mulai dari mana...",
  voiceTitle: "Lebih enak ngomong?",
  voiceHint: "Tekan tombol, lalu ceritakan langsung",
};

export const assessmentSteps = [
  {
    key: "profil",
    label: "Profil usaha",
    title: "Profil usaha",
    subtitle: "Langkah 1 dari 4. Estimasi waktu: 3 menit. Seluruh pertanyaan wajib diisi.",
    why: "Jenis dan lama operasional usaha akan menentukan rekomendasi strategi yang paling tepat. Usaha yang baru berjalan perlu berfokus pada pengujian ide, sedangkan usaha yang sudah mapan memerlukan strategi pengembangan.",
    next: "Lanjut ke Pelanggan",
    questions: [
      {
        id: "business_category",
        label: "Apa kategori jenis usahamu?",
        type: "select",
        options: toOptions([
          ["kuliner", "Kuliner / Makanan & Minuman"],
          ["pakaian", "Pakaian & Aksesoris"],
          ["kerajinan", "Kerajinan Tangan"],
          ["jasa", "Jasa"],
          ["kecantikan", "Kecantikan & Perawatan Diri"],
          ["kesehatan", "Kesehatan"],
          ["perdagangan", "Perdagangan"],
        ]),
      },
      {
        id: "business_age",
        label: "Sudah berapa lama usaha ini berjalan?",
        type: "select",
        options: toOptions([
          ["lt_1y", "Kurang dari 1 tahun"],
          ["1_3y", "1–3 tahun"],
          ["gt_3y", "Lebih dari 3 tahun"],
        ]),
      },
      {
        id: "purchase_methods",
        label: "Sistem atau metode pembelian apa saja yang kamu sediakan?",
        type: "chips",
        options: toOptions([
          ["pre_order", "Pesan dulu (Pre-order)"],
          ["ready_stock", "Stok siap kirim (Ready stock)"],
          ["custom_order", "Pesanan khusus / kustom (Custom order)"],
          ["subscription_repeat", "Langganan / berkelanjutan (Subscription)"],
          ["direct_offline", "Langsung di tempat (Luring)"],
          ["consignment", "Titip jual / konsinyasi"],
        ]),
      },
      {
        id: "business_description",
        label: "Deskripsikan secara singkat tentang usahamu.",
        type: "text",
        placeholder:
          "Contoh: Saya menjual kue kering rumahan lewat WhatsApp dan Instagram sejak dua tahun lalu.",
      },
    ],
  },
  {
    key: "pelanggan",
    label: "Pelanggan",
    title: "Pelanggan",
    subtitle: "Langkah 2 dari 4. Estimasi waktu: 3 menit. Seluruh pertanyaan wajib diisi.",
    why: "Cara pelanggan menemukan dan membeli dari kamu menunjukkan di mana peluang terbesar usahamu.",
    next: "Lanjut ke Operasional",
    questions: [
      {
        id: "main_customers",
        label: "Siapa profil pelanggan utamamu saat ini?",
        type: "chips",
        options: toOptions([
          ["friends_family", "Teman & keluarga"],
          ["neighbors", "Tetangga"],
          ["local_buyers", "Pelanggan lokal / sekitar wilayah"],
          ["online_customers", "Pelanggan online / digital"],
          ["subscribers", "Pelanggan tetap / langganan"],
          ["reseller", "Reseller / Mitra"],
          ["business_org", "Bisnis lain (B2B)"],
          ["organisations", "Organisasi / Komunitas / Instansi"],
        ]),
      },
      {
        id: "repeat_frequency",
        label: "Seberapa sering pelanggan melakukan pembelian ulang (repeat order)?",
        type: "select",
        options: toOptions([
          ["almost_always", "Hampir selalu"],
          ["often", "Sering"],
          ["sometimes", "Kadang-kadang"],
          ["rarely", "Jarang"],
          ["no_data", "Belum memiliki cukup data"],
        ]),
      },
      {
        id: "viewer_behavior",
        label: "Bagaimana respons atau tindakan yang paling sering dilakukan calon pembeli setelah melihat produkmu?",
        type: "select",
        options: toOptions([
          ["buy_directly", "Langsung membeli"],
          ["ask_then_some_buy", "Bertanya-tanya terlebih dahulu, lalu memutuskan membeli"],
          ["many_ask_few_buy", "Banyak yang bertanya, tetapi sedikit yang memutuskan membeli"],
          ["many_view_few_ask", "Banyak yang melihat, tetapi jarang yang bertanya"],
          ["no_data", "Belum tahu / Belum mengukur data ini"],
        ]),
      },
      {
        id: "sales_sources",
        label: "Melalui saluran atau platform apa mayoritas penjualanmu terjadi?",
        type: "chips",
        exclusive: ["no_data"],
        options: toOptions([
          ["whatsapp", "WhatsApp"],
          ["instagram", "Instagram / Media sosial lainnya"],
          ["tiktok", "TikTok Shop / Live Streaming"],
          ["marketplace", "Marketplace (Shopee, Tokopedia, dll)"],
          ["offline_store", "Toko fisik / gerai offline"],
          ["reseller", "Reseller / Mitra"],
          ["no_data", "Belum tahu / Belum ada saluran tetap"],
        ]),
      },
      {
        id: "sales_trend_3m",
        label: "Bagaimana tren perkembangan penjualanmu dalam 3 bulan terakhir?",
        type: "select",
        options: toOptions([
          ["increasing", "Meningkat"],
          ["stable", "Relatif stabil"],
          ["decreasing", "Menurun"],
          ["fluctuating", "Fluktuatif / Naik-turun"],
          ["no_data", "Belum tahu / usaha baru berjalan"],
        ]),
      },
    ],
  },
  {
    key: "operasional",
    label: "Operasional",
    title: "Operasional",
    subtitle: "Langkah 3 dari 4. Sekitar 3 menit. Seluruh pertanyaan wajib diisi.",
    why: "Kami ingin memberikan saran promosi yang realistis. Karena itu, kami perlu tahu seberapa besar waktu, tenaga, dan anggaran yang bisa kamu alokasikan saat ini.",
    next: "Lanjut ke Tantangan",
    questions: [
      {
        id: "order_surge",
        label: "Kalau pesanan tiba-tiba meningkat, apa yang biasanya terjadi?",
        type: "select",
        options: toOptions([
          ["easy", "Masih bisa ditangani dengan mudah (Kapasitas aman & lancar)"],
          ["starting_overwhelmed", "Masih bisa teratasi, tapi mulai repot (Kapasitas pas-pasan/hampir penuh)"],
          ["often_overwhelmed", "Sering kewalahan dan keteteran (Operasional terganggu)"],
          ["very_overwhelmed", "Sangat kewalahan sampai pesanan terhambat/tertunda (Sudah di atas batas kapasitas)"],
          ["never_surged", "Belum pernah mengalami lonjakan pesanan (Kondisi khusus)"],
        ]),
      },
      {
        id: "operational_obstacles",
        label: "Apa yang paling sering menjadi kendala saat menjalankan pesanan?",
        type: "chips",
        exclusive: ["none"],
        options: toOptions([
          ["time", "Waktu terbatas / pengerjaan lama"],
          ["labor", "Kekurangan tenaga / sumber daya manusia"],
          ["raw_materials", "Bahan baku sulit didapat / sering habis"],
          ["stock", "Stok produk tidak mencukupi (khusus barang siap jual/reseller)"],
          ["production", "Kapasitas produksi / alat terbatas"],
          ["shipping", "Pengiriman atau kurir bermasalah"],
          ["packaging", "Proses pengemasan (packaging) memakan waktu"],
          ["customer_reply", "Kewalahan membalas pesan pelanggan"],
          ["none", "Tidak ada kendala khusus"],
        ]),
      },
      {
        id: "financial_recording_habit",
        label: "Bagaimana kebiasaan kamu dalam mencatat keuangan usaha saat ini?",
        type: "select",
        options: toOptions([
          ["daily", "Setiap hari (harian)"],
          ["weekly", "Setiap minggu (mingguan)"],
          ["monthly", "Setiap akhir bulan (bulanan)"],
          ["sometimes", "Hanya saat diperlukan saja / kalau lagi ingat"],
          ["never", "Belum pernah mencatat sama sekali"],
        ]),
      },
      {
        id: "money_separation",
        label: "Bagaimana kondisi pencampuran atau pemisahan keuangan usaha dan dompet pribadimu?",
        type: "select",
        options: toOptions([
          ["fully_separated", "Sudah terpisah sepenuhnya (rekening/dompet beda total)"],
          ["partially_separated", "Baru terpisah sebagian (terkadang masih tercampur)"],
          ["mixed", "Masih jadi satu / tercampur bebas"],
          ["not_separated", "Belum pernah dipisahkan sama sekali"],
        ]),
      },
    ],
  },
  {
    key: "tantangan",
    label: "Tantangan",
    title: "Tantangan saat ini",
    subtitle: "Langkah 4 dari 4. Sekitar 5 menit. Ruang curhat di bagian bawah boleh dilewati.",
    why: "Tantangan terbesar yang kamu hadapi akan menjadi fokus utama dari saran yang kami berikan. Ceritamu akan melengkapi pilihan di atas, supaya rekomendasinya benar-benar cocok buatmu.",
    next: "Lihat hasil diagnosis",
    hasStory: true,
    questions: [
      {
        id: "biggest_challenge",
        label: "Apa tantangan terbesar bisnismu saat ini?",
        type: "select",
        options: toOptions([
          ["hard_new_customers", "Sulit mendapatkan pelanggan baru"],
          ["view_not_buy", "Banyak yang tanya / lihat, tapi sedikit yang membeli"],
          ["customers_not_return", "Pelanggan lama jarang kembali"],
          ["stagnant_sales", "Penjualan stagnan / tidak ada pertumbuhan"],
          ["unsure_promo_strategy", "Bingung memilih strategi promosi yang cocok"],
          ["inconsistent_promo", "Sulit konsisten menjalankan promosi karena keterbatasan waktu & tenaga"],
          ["operations_finance_overwhelmed", "Operasional & keuangan masih berantakan"],
          ["unsure_next_step", "Bingung menentukan prioritas atau langkah berikutnya"],
        ]),
      },
      {
        id: "acquisition_activities",
        label: "Apa saja upaya yang pernah atau biasa kamu lakukan untuk menarik pelanggan?",
        type: "chips",
        exclusive: ["never_tried"],
        options: toOptions([
          ["post_product", "Posting produk secara rutin"],
          ["whatsapp_story", "Promosi lewat WhatsApp (Story / Chat)"],
          ["instagram_content", "Buat konten Instagram"],
          ["tiktok_content", "Buat konten TikTok"],
          ["promo_discount", "Memberikan promo / diskon khusus"],
          ["paid_ads", "Iklan berbayar (Facebook/Instagram/TikTok Ads)"],
          ["referral", "Program rekomendasi teman (Referral)"],
          ["influencer", "Kerja sama dengan KOL / Influencer"],
          ["bazaar_event", "Ikut bazaar / pameran / acara offline"],
          ["change_packaging", "Memperbarui pengemasan (packaging)"],
          ["add_product", "Menambah variasi produk baru"],
          ["never_tried", "Belum pernah mencoba strategi khusus"],
        ]),
      },
      {
        id: "main_goal",
        label: "Kalau bisa memperbaiki satu hal dalam bisnismu saat ini, apa yang paling ingin kamu ubah?",
        type: "select",
        options: toOptions([
          ["more_customers", "Mendapatkan lebih banyak pelanggan baru"],
          ["repeat_orders", "Membuat pelanggan lebih sering membeli kembali"],
          ["increase_profit_sales", "Meningkatkan omzet dan total penjualan "],
          ["brand_awareness", "Membuat bisnis lebih dikenal luas"],
          ["tidy_management", "Merapikan operasional agar menghemat waktu & tenaga (Mengover manajemen bisnis)"],
          ["start_online", "Memulai atau memaksimalkan penjualan secara online"],
        ]),
      },
    ],
  },
];

export const voiceText = {
  listeningTitle: "Sedang mendengarkan...",
  listeningHint: "Ceritakan saja, tekan tombol lagi untuk berhenti",
  unsupported:
    "Browser ini belum mendukung input suara. Coba Chrome atau Edge, atau ketik saja.",
  errors: {
    "not-allowed":
      "Izin mikrofon ditolak. Aktifkan izin mikrofon di pengaturan browser, lalu coba lagi.",
    "service-not-allowed":
      "Izin mikrofon ditolak. Aktifkan izin mikrofon di pengaturan browser, lalu coba lagi.",
    "no-speech":
      "Suaramu belum terdengar. Coba lagi dan bicara lebih dekat ke mikrofon.",
    "audio-capture": "Mikrofon tidak ditemukan. Periksa mikrofon di perangkatmu.",
    network: "Input suara butuh koneksi internet. Coba lagi setelah terhubung.",
    unauthorized: "Silakan masuk dulu untuk memakai fitur suara.",
    "transcribe-failed":
      "Suaramu belum bisa diubah jadi teks. Coba lagi sebentar lagi.",
    default: "Input suara terhenti. Coba lagi atau ketik saja.",
  },
};