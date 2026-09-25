import { GraduationCap } from "lucide-react";

interface StudentIconBadgeProps {
  initials: string;
  className?: string;
}

export function StudentIconBadge({ initials, className = "" }: StudentIconBadgeProps) {
  return (
    <div className={`h-9 w-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100 ${className}`}> 
      {initials}
    </div>
  );
}
