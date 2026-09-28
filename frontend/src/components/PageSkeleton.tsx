
function Bar({ className }: {className: string;}) {
  return <div className={`animate-pulse rounded-md bg-line ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-8">
      <div className="space-y-3">
        <Bar className="h-7 w-56 max-w-full" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-line bg-surface p-5 lg:col-span-2">
          <Bar className="h-4 w-32" />
          <Bar className="h-9 w-48" />
          <div className="space-y-3 pt-2">
            {[0, 1, 2].map((i) =>
            <div key={i} className="flex items-center gap-4">
                <Bar className="h-8 w-8 shrink-0 rounded-full" />
                <Bar className="h-4 flex-1" />
                <Bar className="h-4 w-16" />
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <Bar className="h-4 w-24" />
          <Bar className="h-8 w-32" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-3/4" />
        </div>
      </div>
    </div>);

}