// Label pilihan jawaban untuk pertanyaan klarifikasi diagnosis awal.
// Kalimat dibuat sama dengan pilihan di Assessment agar pengguna mengenalinya.
const OPTION_LABELS = {
  viewer_behavior: {
    buy_directly: "Langsung membeli",
    ask_then_some_buy: "Bertanya-tanya dulu, lalu sebagian memutuskan membeli",
    many_ask_few_buy: "Banyak yang bertanya, tetapi sedikit yang membeli",
    many_view_few_ask: "Banyak yang melihat, tetapi jarang yang bertanya",
  },
  repeat_frequency: {
    almost_always: "Hampir selalu",
    often: "Sering",
    sometimes: "Kadang-kadang",
    rarely: "Jarang",
    no_data: "Belum punya cukup data",
  },
  order_surge: {
    easy: "Masih bisa ditangani dengan mudah",
    starting_overwhelmed: "Masih teratasi, tapi mulai repot",
    often_overwhelmed: "Sering kewalahan dan keteteran",
    very_overwhelmed: "Sangat kewalahan sampai pesanan terhambat",
    never_surged: "Belum pernah mengalami lonjakan pesanan",
  },
  market_reach: {
    mostly_close: "Sebagian besar dari lingkungan atau lingkaran terdekat",
    mixed: "Campuran lingkungan terdekat dan orang baru",
    broad: "Banyak dari orang baru di luar lingkungan terdekat",
    not_sure: "Belum yakin",
  },
  promo_frequency: {
    regular: "Rutin dan terjadwal",
    irregular: "Kadang-kadang, tidak teratur",
    none: "Hampir tidak ada promosi",
  },
  product_feedback: {
    yes: "Ya, ada masukan agar produk diperbarui",
    no: "Tidak ada",
    not_sure: "Belum yakin",
  },
  financial_recording_habit: {
    daily: "Setiap hari",
    weekly: "Setiap minggu",
    monthly: "Setiap akhir bulan",
    sometimes: "Hanya kalau ingat atau diperlukan",
    never: "Belum pernah mencatat",
  },
};

// Mengubah daftar kode opsi dari mesin menjadi pilihan yang bisa ditampilkan.
// Untuk priority_choice, nama masalah dikirim mesin lewat optionLabels.
export function buildClarificationChoices(field, options, optionLabels) {
  if (!Array.isArray(options)) return [];
  const fieldLabels = OPTION_LABELS[field] ?? {};
  const custom =
    optionLabels && typeof optionLabels === "object" ? optionLabels : {};
  return options
    .filter((value) => typeof value === "string")
    .map((value) => ({
      value,
      label: custom[value] ?? fieldLabels[value] ?? value,
    }));
}
