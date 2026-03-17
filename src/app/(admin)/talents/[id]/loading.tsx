export default function TalentDetailLoading() {
  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <div className="mb-6 flex items-center gap-1.5"><div className="h-4 w-16 rounded bg-neutral-100" /><div className="h-4 w-2 rounded bg-neutral-100" /><div className="h-5 w-32 rounded bg-neutral-100" /></div>
      <div className="mb-3 h-3 w-24 rounded bg-neutral-100" />
      <div className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="aspect-video rounded-lg bg-neutral-100" />)}</div>
    </div>
  );
}
