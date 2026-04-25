"use client"

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortableHeaderProps {
  field: string
  label: string
  currentOrderBy: string
  currentDirection: 'asc' | 'desc'
  onSort: (field: string) => void
  className?: string
}

export function SortableHeader({
  field,
  label,
  currentOrderBy,
  currentDirection,
  onSort,
  className
}: SortableHeaderProps) {
  const isActive = currentOrderBy === field

  const getSortIcon = () => {
    if (!isActive) {
      return <ArrowUpDown className="h-4 w-4 opacity-40" />
    }
    if (currentDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 text-blue-600" />
    }
    return <ArrowDown className="h-4 w-4 text-blue-600" />
  }

  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none",
        isActive && "bg-gray-50",
        className
      )}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        {getSortIcon()}
      </div>
    </th>
  )
}
