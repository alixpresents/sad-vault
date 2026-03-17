import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen flex-col bg-white">
      <AdminNav />
      <div className="flex-1 px-6 py-8">
        {children}
      </div>
    </div>
  );
}
