import { Skeleton } from "@/components/ui/skeleton";

export default function TalentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
