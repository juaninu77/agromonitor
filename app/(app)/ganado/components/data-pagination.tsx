"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { PaginationInfo } from "@/lib/hooks/use-ganado"

interface DataPaginationProps {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export function DataPagination({ pagination, onPageChange, onLimitChange }: DataPaginationProps) {
  const { page, limit, total, totalPages, hasNextPage, hasPrevPage } = pagination

  // Generar array de páginas a mostrar
  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxPagesToShow = 7

    if (totalPages <= maxPagesToShow) {
      // Mostrar todas las páginas si son pocas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Lógica para mostrar páginas con elipsis
      if (page <= 4) {
        // Inicio
        for (let i = 1; i <= 5; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (page >= totalPages - 3) {
        // Final
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Medio
        pages.push(1)
        pages.push('ellipsis')
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
  }

  const pages = generatePageNumbers()

  // Calcular el rango de resultados actuales
  const startResult = (page - 1) * limit + 1
  const endResult = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-2 py-4 border-t-2 border-gray-200">
      {/* Info y selector de items por página */}
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-700">
          Mostrando <span className="font-medium">{startResult}</span> a{" "}
          <span className="font-medium">{endResult}</span> de{" "}
          <span className="font-medium">{total}</span> resultados
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Mostrar:</span>
          <Select
            value={limit.toString()}
            onValueChange={(value) => {
              onLimitChange(parseInt(value))
              onPageChange(1) // Resetear a la primera página
            }}
          >
            <SelectTrigger className="h-8 w-[70px] border-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Controles de paginación */}
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => hasPrevPage && onPageChange(page - 1)}
              className={!hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>

          {pages.map((pageNum, index) => (
            <PaginationItem key={index}>
              {pageNum === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  onClick={() => onPageChange(pageNum)}
                  isActive={pageNum === page}
                  className="cursor-pointer"
                >
                  {pageNum}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              onClick={() => hasNextPage && onPageChange(page + 1)}
              className={!hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
