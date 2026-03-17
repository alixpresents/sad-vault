import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen flex-col bg-white">
      <AdminNav />
      <main className="mx-auto w-full flex-1" style={{ maxWidth: 680, padding: "3rem 1.5rem" }}>
        {children}
      </main>
    </div>
  );
}
