export function authErrorMessage(error) {
  const code = error?.code;
  const message = (error?.message ?? "").toLowerCase();

  if (code === "user_already_exists" || message.includes("already registered"))
    return "Email ini sudah terdaftar. Silakan masuk.";
  if (code === "invalid_credentials" || message.includes("invalid login"))
    return "Email atau password salah.";
  if (code === "weak_password")
    return "Password terlalu lemah. Gunakan minimal 8 karakter.";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error?.status === 429
  )
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (code === "email_not_confirmed") return "Email belum dikonfirmasi.";
  if (message.includes("fetch") || message.includes("network"))
    return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
  return "Terjadi kesalahan. Coba lagi sebentar lagi.";
}