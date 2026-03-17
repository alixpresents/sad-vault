export default function TalentsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-5 w-20 rounded bg-neutral-100" />
        <div className="h-8 w-36 rounded-md bg-neutral-100" />
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < 2 ? "border-b border-neutral-100" : ""}`}>
            <div className="h-8 w-8 rounded-full bg-neutral-100" />
            <div className="flex-1"><div className="h-4 w-28 rounded bg-neutral-100" /><div className="mt-1 h-3 w-20 rounded bg-neutral-100" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
