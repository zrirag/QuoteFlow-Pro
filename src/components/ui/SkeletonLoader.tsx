export function SkeletonLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
  );
}

export function SkeletonTable() {
  return (
    <div className="w-full space-y-4">
      <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex space-x-4">
          <SkeletonLoader className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}
