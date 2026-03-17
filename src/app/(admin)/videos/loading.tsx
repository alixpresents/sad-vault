export default function VideosLoading() {
  return (
    <div className="mx-auto" style={{ maxWidth: 960 }}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-20 rounded bg-neutral-100" />
          <div className="h-4 w-16 rounded bg-neutral-100" />
        </div>
        <div className="h-8 w-48 rounded-lg bg-neutral-100" />
      </div>
      <div className="mb-6 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-20 rounded-lg bg-neutral-100" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <div className="aspect-video rounded-lg bg-neutral-100" />
            <div className="mt-2 h-4 w-3/4 rounded bg-neutral-100" />
            <div className="mt-1 h-3 w-1/2 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
