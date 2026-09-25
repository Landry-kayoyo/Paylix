import { Button } from "../ui/button";

export interface PaginationMeta {
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  startIndex: number;
  endIndex: number;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function getPaginationMeta({ page, pageSize, total }: { page: number; pageSize: number; total: number }): PaginationMeta {
  const totalPages = Math.max(0, Math.ceil(total / pageSize));
  return {
    totalPages,
    hasPrevious: page > 1 && totalPages > 0,
    hasNext: page < totalPages,
    startIndex: total === 0 ? 0 : (page - 1) * pageSize + 1,
    endIndex: Math.min(page * pageSize, total),
  };
}

export function Pagination({ page, pageSize, total, onPageChange, className = "" }: PaginationProps) {
  const meta = getPaginationMeta({ page, pageSize, total });

  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between px-6 py-4 border-t border-slate-100 ${className}`}> 
      <p className="text-xs text-muted-foreground">
        Page {page} sur {meta.totalPages} · {total} résultat{total > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          disabled={!meta.hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
