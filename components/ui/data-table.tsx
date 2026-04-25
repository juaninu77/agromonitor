"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface ColumnDef<T> {
  id: string
  header: string
  accessorFn?: (row: T) => React.ReactNode
  accessorKey?: keyof T
  sortable?: boolean
  className?: string
  headerClassName?: string
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  pagination?: {
    page: number
    totalPages: number
    total: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  onPageChange?: (page: number) => void
  sortBy?: string
  sortDirection?: "asc" | "desc"
  onSort?: (columnId: string) => void
  onRowClick?: (row: T) => void
  rowKey?: (row: T) => string
}

function SortIcon({ columnId, sortBy, sortDirection }: {
  columnId: string
  sortBy?: string
  sortDirection?: "asc" | "desc"
}) {
  if (sortBy !== columnId) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />
  if (sortDirection === "asc") return <ArrowUp className="ml-1 h-3.5 w-3.5" />
  return <ArrowDown className="ml-1 h-3.5 w-3.5" />
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No hay datos para mostrar",
  pagination,
  onPageChange,
  sortBy,
  sortDirection,
  onSort,
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  const getCellValue = (row: T, column: ColumnDef<T>): React.ReactNode => {
    if (column.accessorFn) return column.accessorFn(row)
    if (column.accessorKey) {
      const val = row[column.accessorKey]
      if (val === null || val === undefined) return "—"
      return String(val)
    }
    return "—"
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.id} className={col.headerClassName}>
                  {col.sortable && onSort ? (
                    <button
                      onClick={() => onSort(col.id)}
                      className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                    >
                      {col.header}
                      <SortIcon
                        columnId={col.id}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow
                  key={rowKey ? rowKey(row) : idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} className={col.className}>
                      {getCellValue(row, col)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && onPageChange && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            {pagination.total} registro{pagination.total !== 1 ? "s" : ""} en total
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(1)}
              disabled={!pagination.hasPrevPage}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(pagination.totalPages)}
              disabled={!pagination.hasNextPage}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
