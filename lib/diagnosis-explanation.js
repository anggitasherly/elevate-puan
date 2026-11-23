// Explanation layer: tidak mengubah skor atau hasil diagnosis.
// Seluruh narasi hanya berasal dari evidence yang dikembalikan Diagnosis Engine.
// Kalimat ditulis per field dan per nilai, supaya arti tiap jawaban tidak tertukar
// dan setiap kalimat bisa dipahami sendiri oleh pengguna.

const LABELS = {
  low_awareness: "Kesadaran Calon Pelanggan Masih Rendah",
  low_conversion: "Konversi Penjualan Rendah",
  weak_retention: "Pembelian Ulang Pelanggan Masih Rendah",
  capacity_limit: "Kapasitas Operasional Terbatas",
  narrow_market: "Jangkauan Pasar Terbatas",
  inconsistent_promo: "Promosi Belum Konsisten",
  product_stagnation: "Pengembangan Produk Belum Optimal",
  weak_finance_habits: "Pengelolaan Keuangan Perlu Diperbaiki",
};

// Kalimat penutup per masalah. Berisi arah perhatian saja, tanpa fakta baru tentang usaha.
const FOCUS = {
  low_awareness:
    "membuat lebih banyak orang mengenal dan tertarik pada produkmu perlu jadi perhatian lebih dulu.",
  low_conversion:
    "mengubah calon pembeli yang sudah tertarik menjadi pembeli perlu jadi perhatian lebih dulu.",
  weak_retention:
    "membuat pelanggan mau kembali membeli perlu jadi perhatian lebih dulu.",
  capacity_limit:
    "kemampuan usahamu menangani pesanan yang bertambah perlu jadi perhatian lebih dulu.",
  narrow_market:
    "menjangkau pelanggan di luar lingkaran terdekat perlu jadi perhatian lebih dulu.",
  inconsistent_promo:
    "membuat promosi lebih teratur perlu jadi perhatian lebih dulu.",
  product_stagnation:
    "menyegarkan produk sesuai masukan pelanggan perlu jadi perhatian lebih dulu.",
  weak_finance_habits:
    "kebiasaan mencatat dan memisahkan keuangan usaha perlu jadi perhatian lebih dulu.",
};

// Klausa per field dan per nilai. Semua klausa berdiri sendiri, huruf kecil, tanpa titik.
const CLAUSES = {
  viewer_behavior: {
    many_view_few_ask:
      "banyak orang melihat produkmu, tetapi hanya sedikit yang bertanya",
    many_ask_few_buy:
      "banyak calon pelanggan bertanya, tetapi hanya sedikit yang akhirnya membeli",
    ask_then_some_buy:
      "sebagian calon pelanggan yang bertanya akhirnya membeli",
    buy_directly: "calon pelanggan cenderung langsung membeli",
  },
  repeat_frequency: {
    rarely: "pelanggan jarang membeli lagi",
    sometimes: "pelanggan hanya sesekali membeli lagi",
    often: "pelanggan cukup sering membeli lagi",
    almost_always: "hampir semua pelanggan membeli lagi",
  },
  order_surge: {
    easy: "usahamu masih mudah menangani pesanan yang bertambah",
    starting_overwhelmed: "usahamu mulai kewalahan saat pesanan meningkat",
    often_overwhelmed: "usahamu sering kewalahan saat pesanan meningkat",
    very_overwhelmed: "usahamu sangat kewalahan saat pesanan meningkat",
    never_surged: "pesananmu belum pernah melonjak",
  },
  financial_recording_habit: {
    daily: "kamu mencatat pemasukan dan pengeluaran usaha setiap hari",
    weekly: "kamu mencatat pemasukan dan pengeluaran usaha setiap minggu",
    monthly: "kamu mencatat pemasukan dan pengeluaran usaha setiap bulan",
    sometimes: "kamu baru sesekali mencatat pemasukan dan pengeluaran usaha",
    never: "kamu belum rutin mencatat pemasukan dan pengeluaran usaha",
  },
  money_separation: {
    not_separated: "uang usaha masih tercampur dengan uang pribadi",
    mixed: "uang usaha dan uang pribadi masih tercampur",
    partially_separated: "uang usaha baru sebagian dipisahkan dari uang pribadi",
    separated: "uang usaha sudah dipisahkan dari uang pribadi",
    money_separated: "uang usaha sudah dipisahkan dari uang pribadi",
  },
  market_reach: {
    mostly_close: "sebagian besar pembelimu berasal dari lingkungan terdekat",
    mixed: "pembelimu berasal dari lingkungan terdekat dan dari luar",
    broad: "pembelimu berasal dari berbagai kalangan",
    not_sure: "kamu belum yakin dari mana saja pembelimu berasal",
  },
  promo_frequency: {
    regular: "promosi sudah kamu lakukan secara rutin",
    irregular: "promosi belum kamu lakukan secara konsisten",
    none: "kamu belum melakukan promosi dalam sebulan terakhir",
  },
  product_feedback: {
    yes: "ada masukan pelanggan yang menunjukkan produkmu perlu diperbarui",
    no: "belum ada masukan pelanggan yang meminta produkmu diperbarui",
    not_sure: "kamu belum yakin apakah ada masukan pelanggan untuk memperbarui produk",
  },
  biggest_challenge: {
    hard_new_customers: "kamu merasa sulit mendapatkan pelanggan baru",
    view_not_buy: "kamu merasa calon pelanggan belum banyak yang membeli",
    customers_not_return: "kamu merasa pelanggan belum rutin kembali membeli",
    inconsistent_promo: "kamu merasa promosimu belum konsisten",
    operations_finance_overwhelmed:
      "kamu merasa operasional dan keuangan usaha terasa berat",
    stagnant_sales: "kamu merasa penjualan belum berkembang",
    unsure_promo_strategy: "kamu merasa belum yakin dengan strategi promosimu",
  },
};

// Kolom pilihan ganda: tiap pilihan diterjemahkan sendiri, lalu digabung.
const OBSTACLES = {
  time: "waktu",
  labor: "tenaga kerja",
  raw_materials: "bahan baku",
  stock: "ketersediaan stok",
  production: "proses produksi",
  shipping: "pengiriman",
  packaging: "pengemasan",
  customer_reply: "membalas pelanggan",
};
const SOURCES = { whatsapp: "WhatsApp", instagram: "Instagram" };

const CONF = {
  high:
    "Jawabanmu menunjukkan pola yang cukup jelas, jadi kami punya dasar yang kuat untuk menentukan hal yang perlu diprioritaskan.",
  medium:
    "Dari jawabanmu, kami sudah melihat arah masalah yang perlu diperhatikan. Namun, masih ada beberapa hal yang perlu dipastikan agar hasilnya semakin sesuai dengan kondisi usahamu.",
  low:
    "Kami mulai melihat hal yang mungkin perlu diperhatikan, tetapi masih butuh informasi tambahan sebelum bisa menyimpulkannya dengan lebih yakin.",
  none:
    "Kami belum punya cukup informasi untuk menilai kondisi ini. Kamu bisa melengkapi jawaban agar hasilnya lebih membantu.",
};

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

// "a", "a dan b", "a, b, dan c"
function joinList(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} dan ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, dan ${items[items.length - 1]}`;
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Mengembalikan satu klausa yang bisa berdiri sendiri, atau null kalau nilainya tidak dikenal.
function clauseFor(field, value) {
  if (field === "operational_obstacles") {
    const names = asArray(value).map((v) => OBSTACLES[v]).filter(Boolean);
    return names.length
      ? `kendala operasionalmu ada pada ${joinList(names)}`
      : null;
  }

  if (field === "main_customers") {
    return asArray(value).includes("friends_family")
      ? "pelangganmu sebagian besar berasal dari teman atau keluarga"
      : null;
  }

  if (field === "sales_sources") {
    const names = asArray(value).map((v) => SOURCES[v]).filter(Boolean);
    if (!names.length) return null;
    return names.length === 1
      ? `penjualanmu masih bergantung pada satu saluran, yaitu ${names[0]}`
      : `penjualanmu berjalan lewat ${joinList(names)}`;
  }

  const byValue = CLAUSES[field];
  if (!byValue || typeof value !== "string") return null;
  return byValue[value] ?? null;
}

// Sinyal gabungan dari engine dipecah menjadi sinyal per field.
function expandSignal(signal) {
  if (!signal || typeof signal !== "object") return [];
  const field = signal.source_field;
  const value = signal.value;

  if (field === "order_surge+operational_obstacles" && value && typeof value === "object") {
    return [
      { source_field: "order_surge", value: value.order_surge },
      { source_field: "operational_obstacles", value: value.operational_obstacles },
    ];
  }

  if (field === "main_customers+sources" || field === "main_customers+sales_sources") {
    if (value && typeof value === "object") {
      return [
        { source_field: "main_customers", value: value.customers },
        { source_field: "sales_sources", value: value.sources },
      ];
    }
  }

  return [signal];
}

function clausesFrom(signals) {
  const seen = new Set();
  const result = [];
  for (const signal of asArray(signals)) {
    for (const item of expandSignal(signal)) {
      const clause = clauseFor(item.source_field, item.value);
      if (clause && !seen.has(clause)) {
        seen.add(clause);
        result.push(clause);
      }
    }
  }
  return result;
}

function buildDescription(code, clauses) {
  const focus = FOCUS[code];
  if (!clauses.length || !focus) {
    return "Kami sudah menemukan area yang perlu diperhatikan, tetapi belum memiliki rincian jawaban yang cukup untuk menjelaskan alasannya.";
  }

  const [first, second, third] = clauses;
  const sentences = [`Dari jawabanmu, terlihat bahwa ${first}.`];
  if (second) sentences.push(`Selain itu, ${second}.`);
  if (third) sentences.push(`Terlihat juga bahwa ${third}.`);
  sentences.push(`Karena itu, ${focus}`);
  return sentences.join(" ");
}

export function explainDiagnosis(rawDiagnosis) {
  const raw = rawDiagnosis && typeof rawDiagnosis === "object" ? rawDiagnosis : {};
  const status = raw.diagnosis_status;
  const code = raw.primary_problem?.problem_type;
  const level = ["high", "medium", "low", "none"].includes(raw.confidence)
    ? raw.confidence
    : "none";

  // Bukti utama dari engine. supporting_signals hanya indikasi tambahan.
  const primaryClauses = clausesFrom(raw.primary_problem?.evidence);
  const primaryKeys = new Set(primaryClauses);
  const secondaryClauses = clausesFrom(raw.supporting_signals).filter(
    (clause) => !primaryKeys.has(clause)
  );

  const diagnosed = status === "diagnosed" && !!code;
  const title = diagnosed
    ? LABELS[code] || "Masalah Usaha Terdeteksi"
    : "Masalah Utama Belum Dapat Ditentukan";

  const description = diagnosed
    ? buildDescription(code, primaryClauses.slice(0, 3))
    : status === "needs_clarification"
      ? "Ada beberapa hal yang ingin kami pahami lebih jauh sebelum menentukan apa yang paling perlu kamu prioritaskan."
      : "Kami belum bisa menentukan fokus utama usahamu dari jawaban yang tersedia. Yuk, lengkapi informasinya terlebih dahulu.";

  const primaryLines = primaryClauses.map((clause) => `${capitalize(clause)}.`);
  const secondaryLines = secondaryClauses.map((clause) => `${capitalize(clause)}.`);

  return {
    primaryProblem: { code: diagnosed ? code : null, title, description },
    confidence: { level, reason: CONF[level] },
    evidence: primaryLines.length ? primaryLines : secondaryLines,
    secondaryEvidence: secondaryLines,
  };
}
