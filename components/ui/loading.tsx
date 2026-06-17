export function PageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse">
      <div className="app-panel p-6 sm:p-8">
        <div className="skeleton-shimmer h-3 w-28 rounded-full" />
        <div className="skeleton-shimmer mt-5 h-10 w-2/3 max-w-xl rounded-lg" />
        <div className="skeleton-shimmer mt-4 h-4 w-full max-w-2xl rounded-full" />
      </div>
      <div className="mt-6 grid gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="app-panel flex items-center gap-4 p-4">
            <div className="skeleton-shimmer h-14 w-14 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-3">
              <div className="skeleton-shimmer h-4 w-1/3 rounded-full" />
              <div className="skeleton-shimmer h-3 w-3/5 rounded-full" />
            </div>
            <div className="skeleton-shimmer hidden h-8 w-24 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
