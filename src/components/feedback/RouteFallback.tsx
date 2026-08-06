import { Skeleton } from "@/components/ui/skeleton";

export function RouteFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
