export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <span className="sr-only">Memuat data...</span>
    </div>
  );
}
