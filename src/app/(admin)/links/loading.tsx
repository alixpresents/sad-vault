import { Skeleton } from "@/components/ui/skeleton";

export default function LinksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}
