
export default function PageShell({
  children,
  noTopSpacing = false,
}) {
  return (
    <main className="elevate-bg">
      <div
        className={`mx-auto max-w-6xl px-5 pb-20 sm:px-7 ${
          noTopSpacing ? "pt-0" : "pt-10"
        }`}
      >
        {children}
      </div>

      <footer className="pb-8 text-center font-serif italic text-purple-800">
        Better Decisions, Bigger Dreams ✦
      </footer>
    </main>
  );
}
