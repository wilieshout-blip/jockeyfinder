export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border border-dashed border-zinc-300 bg-white px-6 py-12 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-turf-200 bg-turf-50 text-turf-700">
        <span className="h-2 w-2 rounded-full bg-turf-500" />
      </div>
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {children ? <p className="mt-1.5 text-sm text-zinc-500">{children}</p> : null}
    </div>
  );
}
