import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALLOWED_SOURCE_TYPES, isUuid } from "@/lib/experiments/server-helpers";

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

/*
 * GET /api/experiments/context?proposalId=<uuid>
 * Balasan: { proposal, business, finance, constraints }
 */
export async function GET(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(
        "Silakan login terlebih dahulu untuk menjalankan eksperimen dari strategi yang dipilih.",
        401
      );
    }

    const proposalId = new URL(request.url).searchParams.get("proposalId");

    if (!isUuid(proposalId)) {
      return jsonError("ID strategi tidak valid.", 400);
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("solution_proposals")
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) {
      console.error("[experiments/context] proposal:", proposalError.code);
      return jsonError("Gagal mengambil data strategi.", 500);
    }

    if (!proposal) {
      return jsonError(
        "Strategi yang dipilih tidak ditemukan. Silakan kembali ke halaman sumber dan pilih strategi lagi.",
        404
      );
    }

    if (!ALLOWED_SOURCE_TYPES.includes(proposal.source_type)) {
      return jsonError(
        "Asal strategi tidak valid. Strategi harus berasal dari Opportunity Library atau Growth Insight.",
        400
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, category, business_type, created_at")
      .eq("id", proposal.business_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (businessError) {
      console.error("[experiments/context] business:", businessError.code);
      return jsonError("Gagal mengambil data bisnis.", 500);
    }

    if (!business) {
      return jsonError(
        "Bisnis dari strategi yang dipilih tidak ditemukan atau bukan milik akun yang sedang login.",
        404
      );
    }

    const { data: finance, error: financeError } = await supabase
      .from("financial_readiness")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (financeError) {
      console.error("[experiments/context] finance:", financeError.code);
      return jsonError("Gagal mengambil data keuangan.", 500);
    }

    const { data: constraints, error: constraintError } = await supabase
      .from("constraints")
      .select("hours_per_week")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (constraintError) {
      console.error("[experiments/context] constraints:", constraintError.code);
      return jsonError("Gagal mengambil data kapasitas waktu.", 500);
    }

    return NextResponse.json({
      proposal,
      business,
      finance: finance ?? null,
      constraints: constraints ?? null,
    });
  } catch (err) {
    console.error("[experiments/context] unexpected:", err?.name);
    return jsonError("Terjadi kesalahan pada server.", 500);
  }
}