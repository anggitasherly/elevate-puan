
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Clock3,
  PenLine,
  Ban,
} from "lucide-react";

// Urutan kolom: Nama | Kategori | Periode | Status | Evaluasi | Detail
export const GRID_COLS =
  "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.2fr)_124px]";

const detailHref = (id) => `/experiments/${id}`;

const STATUS = {
  completed: {
    label: "Selesai",
    Icon: CircleCheck,
    cls: "bg-mint-soft text-emerald-700",
  },
  ongoing: {
    label: "Berjalan",
    Icon: Clock3,
    cls: "bg-lav-pale text-brand-deep",
  },
  stopped: {
    label: "Dihentikan",
    Icon: Ban,
    cls: "bg-slate-100 text-slate-600",
  },
  draft: {
    label: "Draft",
    Icon: PenLine,
    cls: "bg-slate-100 text-slate-600",
  },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const parse = (iso) => {
  const [y, m, d] = iso.split("-");
  return {
    d: Number(d),
    m: MONTHS[Number(m) - 1],
    y,
  };
};

function formatPeriod(start, end) {
  if (!start || !end) return "Belum dijadwalkan";

  const s = parse(start);
  const e = parse(end);

  return `${s.d} ${s.m} - ${e.d} ${e.m} ${e.y}`;
}

function EvaluationBadge({ experiment }) {
  const { status, evaluation_status, final_review_id } = experiment;

  if (status !== "completed") {
    return <span className="text-sm text-ink-muted">-</span>;
  }

  if (!final_review_id) {
    return (
      <span className="text-xs text-ink-muted">
        Belum direview
      </span>
    );
  }

  return evaluation_status === "successful" ? (
    <span className="w-fit whitespace-nowrap rounded-lg bg-mint-soft px-2.5 py-1 text-xs font-medium text-emerald-700">
      Berhasil
    </span>
  ) : (
    <span className="w-fit whitespace-nowrap rounded-lg bg-sun-soft px-2.5 py-1 text-xs font-medium text-amber-700">
      Belum sesuai target
    </span>
  );
}

export default function ExperimentRow({ experiment }) {
  const {
    id,
    name,
    category,
    objective,
    status,
    start_date,
    end_date,
  } = experiment;

  const { label, Icon, cls } = STATUS[status] ?? STATUS.draft;

  return (
    <div
      className={`grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-white/90 p-4 transition-colors hover:bg-lav-pale/40 md:items-center md:gap-4 md:rounded-none md:border-x-0 md:border-t-0 md:px-4 md:py-5 ${GRID_COLS}`}
    >
      {/* Kolom 1: Nama eksperimen */}
      <div className="min-w-0">
        <p className="font-semibold leading-5 text-ink-title">
          {name}
        </p>

        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
          {objective || "Belum ada deskripsi eksperimen."}
        </p>
      </div>

      {/* Kolom 2: Kategori */}
      <div className="flex justify-start md:justify-center">
        <span className="w-fit rounded-full bg-pink-pale px-2.5 py-1 text-center text-xs font-medium text-pink-ink">
          {category || "Belum dikategorikan"}
        </span>
      </div>

      {/* Kolom 3: Periode */}
      <div className="text-left text-sm leading-5 text-ink-muted md:text-center">
        {formatPeriod(start_date, end_date)}
      </div>

      {/* Kolom 4: Status */}
      <div className="flex justify-start md:justify-center">
        <span
          className={`inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
        >
          <Icon size={13} />
          {label}
        </span>
      </div>

      {/* Kolom 5: Evaluasi */}
      <div className="flex justify-start md:justify-center">
        <EvaluationBadge experiment={experiment} />
      </div>

      {/* Kolom 6: Tombol detail */}
      <div className="flex justify-start md:justify-end">
        <Link
          href={detailHref(id)}
          className="inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-pink-line bg-white px-4 py-2 text-sm font-medium text-pink-ink transition hover:border-pink-ink hover:bg-pink-pale"
        >
          Lihat Detail
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
