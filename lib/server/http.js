import "server-only";

// Error yang aman ditampilkan ke pengguna (pesan sudah Bahasa Indonesia).
export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Semua response API: JSON + tidak boleh di-cache (data personal).
export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ApiError -> kirim pesannya apa adanya.
// Error lain (bug / database) -> detail hanya di log server, pengguna dapat pesan umum.
export function errorResponse(error, fallbackMessage) {
  if (error instanceof ApiError) {
    return jsonResponse({ success: false, message: error.message }, error.status);
  }

  console.error(fallbackMessage, error);
  return jsonResponse({ success: false, message: fallbackMessage }, 500);
}