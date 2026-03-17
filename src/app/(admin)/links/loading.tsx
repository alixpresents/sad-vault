export default function LinksLoading() {
  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-5 w-36 rounded bg-neutral-100" />
        <div className="h-8 w-28 rounded-md bg-neutral-100" />
      </div>
      <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-lg border border-neutral-200 bg-white shadow-sm" />)}</div>
    </div>
  );
}
