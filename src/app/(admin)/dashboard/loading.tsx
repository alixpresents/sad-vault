export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-6 w-40 rounded bg-neutral-100" />
        <div className="mt-2 h-4 w-48 rounded bg-neutral-100" />
      </div>
      <div className="mb-8 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <div className="h-3 w-12 rounded bg-neutral-100" />
            <div className="mt-2 h-6 w-8 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
      <div className="mb-3 h-3 w-24 rounded bg-neutral-100" />
      <div className="mb-8 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-neutral-200 bg-white shadow-sm" />
        ))}
      </div>
      <div className="mb-3 h-3 w-16 rounded bg-neutral-100" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-neutral-200 bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}
