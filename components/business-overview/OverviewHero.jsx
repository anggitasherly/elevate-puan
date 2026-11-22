
import Image from "next/image";

export default function OverviewHero() {
  return (
    <section
      aria-label="Gambaran Bisnismu Saat Ini"
      className="w-full"
    >
      <h1 className="sr-only">
        Gambaran Bisnismu Saat Ini
      </h1>

      <Image
        src="/business-overview-hero.png"
        alt="Gambaran Bisnismu Saat Ini. Yuk, lihat ringkasan kondisi bisnismu berdasarkan hasil diagnosis awal."
        width={1728}
        height={864}
        priority
        sizes="(max-width: 768px) 100vw, 1100px"
        className="h-auto w-full rounded-2xl object-contain"
      />
    </section>
  );
}
