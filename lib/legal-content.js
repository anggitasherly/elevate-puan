export const termsVersion = "2026-11-08";

const contactEmail = "isi-email-kontak@contoh.com";
const updated = "Terakhir diperbarui: 8 November 2026";

export const legalDocs = {
  terms: {
    title: "Syarat & Ketentuan",
    updated,
    intro:
      "Dengan membuat akun, kamu menyetujui syarat berikut. Mohon dibaca dengan tenang.",
    sections: [
      {
        heading: "1. Tentang ElevatePuan",
        body: "ElevatePuan adalah asisten pertumbuhan berbasis AI untuk perempuan pemilik usaha mikro dan kecil. ElevatePuan membantu kamu memahami kondisi usaha, mendapat rekomendasi langkah kecil yang realistis, dan mencatat hasil eksperimen. Layanan ini saat ini berupa proyek tugas akhir (versi percobaan) dari Kelompok Dewi Sartika, AI Fullstack Website Development, Perempuan Inovasi.",
      },
      {
        heading: "2. Akun kamu",
        body: "Kamu berusia 18 tahun ke atas, mengisi data dengan benar, dan menjaga kerahasiaan password. Kamu bertanggung jawab atas semua aktivitas di akunmu.",
      },
      {
        heading: "3. Saran yang kamu terima",
        body: "Rekomendasi dan analisis dibuat dengan bantuan AI dari data yang kamu isi. Isinya adalah panduan, bukan nasihat keuangan, hukum, atau pajak profesional, dan hasilnya tidak dijamin. Keputusan usaha tetap ada di tanganmu.",
      },
      {
        heading: "4. Penggunaan yang wajar",
        body: "Gunakan layanan hanya untuk usahamu sendiri. Jangan memasukkan data pribadi orang lain tanpa izin, dan jangan mengganggu atau menyalahgunakan sistem.",
      },
      {
        heading: "5. Data usahamu",
        body: "Data usaha yang kamu isi tetap milikmu. Kamu mengizinkan kami memprosesnya untuk menjalankan layanan, sebagaimana dijelaskan di Kebijakan Privasi.",
      },
      {
        heading: "6. Perubahan layanan dan syarat",
        body: "Fitur dapat berubah, dihentikan sementara, atau diperbarui. Syarat ini dapat diperbarui, dan versi terbaru berlaku sejak ditampilkan di layanan.",
      },
      {
        heading: "7. Batas tanggung jawab",
        body: "Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian yang timbul dari keputusan usaha yang diambil berdasarkan saran layanan ini.",
      },
      {
        heading: "8. Hukum yang berlaku",
        body: "Syarat ini diatur oleh hukum Republik Indonesia.",
      },
      {
        heading: "9. Kontak",
        body: `Pertanyaan tentang syarat ini dapat dikirim ke ${contactEmail}.`,
      },
    ],
  },
  privacy: {
    title: "Kebijakan Privasi",
    updated,
    intro:
      "Kami menghargai datamu. Berikut data apa yang kami kumpulkan dan bagaimana kami memakainya.",
    sections: [
      {
        heading: "1. Data yang kami kumpulkan",
        body: "Data akun (nama lengkap, email, nomor HP bila diisi, nama usaha), jawaban assessment (jenis usaha, lama usaha, cara penjualan, pelanggan, kendala, kebiasaan keuangan, tujuan), deskripsi dan cerita usaha (termasuk teks dari input suara), data keuangan yang kamu isi, serta catatan eksperimen.",
      },
      {
        heading: "2. Untuk apa data dipakai",
        body: "Membuat dan menjaga akunmu, menyusun diagnosis dan rekomendasi, menghitung kesiapan finansial, menampilkan progres eksperimen, dan memperbaiki layanan.",
      },
      {
        heading: "3. Pemrosesan oleh AI",
        body: "Ringkasan data usahamu dikirim ke layanan model AI (Google Gemini) untuk menyusun narasi dan rekomendasi. Pada paket gratis, penyedia dapat memakai input dan output untuk memperbaiki modelnya. Karena itu, jangan memasukkan data pribadi pelanggan atau data sensitif lain.",
      },
      {
        heading: "4. Input suara",
        body: "Saat kamu memakai tombol mikrofon, browser (Chrome atau Edge) mengirim suaramu ke layanan pengenalan suara milik pembuat browser untuk diubah menjadi tulisan. Kami tidak menyimpan rekaman suara, hanya teks yang muncul di kolom.",
      },
      {
        heading: "5. Penyimpanan dan keamanan",
        body: "Data disimpan pada penyedia basis data dan hosting terkelola, dengan akses yang dibatasi per pengguna. Password tidak dapat kami baca.",
      },
      {
        heading: "6. Berbagi data",
        body: "Data tidak kami jual. Data hanya dapat diakses penyedia layanan yang menjalankan sistem (basis data, AI, hosting) atau bila diwajibkan oleh hukum.",
      },
      {
        heading: "7. Hakmu",
        body: `Kamu dapat meminta akses, perbaikan, atau penghapusan akun dan datamu sesuai peraturan pelindungan data pribadi di Indonesia. Hubungi ${contactEmail}.`,
      },
      {
        heading: "8. Lama penyimpanan",
        body: "Data disimpan selama akunmu aktif atau sampai kamu meminta penghapusan.",
      },
      {
        heading: "9. Perubahan kebijakan",
        body: "Kebijakan ini dapat diperbarui, dan versi terbaru ditampilkan di layanan.",
      },
    ],
  },
};