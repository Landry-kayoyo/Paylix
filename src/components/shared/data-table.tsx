"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { FileQuestion } from "lucide-react";
import { Pagination } from "./pagination";
import { RefreshButton } from "./refresh-button";

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyDescription?: string;
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  refreshLabel?: string;
  refreshLoading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  emptyMessage = "Aucune donnée",
  emptyDescription = "Aucun élément n'a été trouvé.",
  className = "",
  headerClassName = "",
  rowClassName = "",
  page,
  pageSize,
  total,
  onPageChange,
  title,
  description,
  actions,
  onRefresh,
  refreshLabel = "Actualiser",
  refreshLoading = false,
}: DataTableProps<T>) {
  const showPagination = page !== undefined && pageSize !== undefined && total !== undefined && onPageChange;

  if (isError) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-border/60 bg-card ${className}`}>
      {(title || description || actions || onRefresh) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
            {description && (
              <p className="text-xs text-slate-500">{description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {actions}
            {onRefresh && (
              <RefreshButton
                onRefresh={onRefresh}
                label={refreshLabel}
                loading={refreshLoading}
                className="h-8 border-slate-200 text-xs text-slate-700 hover:bg-white"
              />
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className={`hover:bg-transparent ${headerClassName}`}>
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className={`h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 ${column.className ?? ""}`}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className={rowClassName}>
                  {columns.map((_, colIndex) => (
                    <TableCell key={colIndex} className="px-4 py-3">
                      <Skeleton className="h-6 w-full rounded-md" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className={rowClassName}>
                <TableCell colSpan={columns.length} className="h-64 px-4 py-8 align-middle">
                  <EmptyState
                    icon={FileQuestion}
                    title={emptyMessage}
                    description={emptyDescription}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, rowIndex) => (
                <TableRow key={rowIndex} className={`align-middle ${rowClassName}`}>
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex} className="px-4 py-3 align-middle text-sm text-slate-700">
                      {column.cell
                        ? column.cell(item)
                        : String(item[column.accessorKey as keyof T] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          className="border-t border-slate-100 bg-slate-50/50"
        />
      )}
    </div>
  );
}
