import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import CardHeading from "@/components/home/CardHeading";

const STATUS_LABEL = {
  completed: "Selesai",
  stopped: "Dihentikan",
  expired: "Kedaluwarsa",
};

const formatNumber = (value) => new Intl.NumberFormat("id-ID").format(Number(value));

export default function LastResultCard({ result }) {
  return (
    <Card className="min-h-57.5 gap-0 rounded-3xl border border-row-line bg-white py-0 shadow-[0_20px_50px_-30px_rgba(54,17,171,0.25)] ring-0">
      <CardContent className="flex flex-1 flex-col p-5 sm:px-6 sm:py-5.5">
        <CardHeading icon={Trophy} title="Hasil terakhir" />

        {result ? (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="h-6.5 rounded-full border border-lav-line bg-lav-pale px-3 text-xs font-extrabold text-brand-deep hover:bg-lav-pale">
                {STATUS_LABEL[result.status] ?? result.status}
              </Badge>
              {result.targetMet === true && (
                <Badge className="h-6.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50">
                  Target tercapai
                </Badge>
              )}
              {result.targetMet === false && (
                <Badge className="h-6.5 rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-extrabold text-amber-700 hover:bg-amber-50">
                  Belum sesuai target
                </Badge>
              )}
            </div>
            <p className="mt-2.5 text-lg font-extrabold leading-snug text-ink-title">
              {result.title}
            </p>
            {result.actualValue != null && result.targetValue != null && (
              <p className="mt-2 text-[13px] font-bold text-ink-muted">
                {result.metricName ? `${result.metricName}: ` : ""}
                {formatNumber(result.actualValue)} dari target {formatNumber(result.targetValue)}
              </p>
            )}
            {result.netProfit != null && (
              <p className="mt-1 text-[13px] font-bold text-ink-muted">
                Laba bersih Rp {formatNumber(result.netProfit)}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2 text-center">
            <span className="mb-1 flex size-13 items-center justify-center rounded-full bg-lav-pale text-brand-deep">
              <Trophy className="size-6" />
            </span>
            <p className="text-[15px] font-extrabold text-ink-title">Belum ada data</p>
            <p className="max-w-68 text-[13px] leading-relaxed text-ink-muted">
              Hasil eksperimen terakhir akan muncul di sini setelah ada
              eksperimen yang selesai.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}