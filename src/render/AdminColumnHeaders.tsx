/**
 * Sticky column header row for the Admin Panel's unit type grid.
 * Shows abbreviated labels for built-in columns and editable labels for user columns.
 */
import { useState, useCallback } from 'react'
import type { UnitTypeColumn } from '../mozaik/types'
import { COLUMN_ABBREVS } from '../mozaik/unitTypes'
import Input from '../ui/Input'

interface AdminColumnHeadersProps {
  columns: UnitTypeColumn[]
  onRenameColumn: (columnId: string, newLabel: string) => void
}

export default function AdminColumnHeaders({ columns, onRenameColumn }: AdminColumnHeadersProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = useCallback((col: UnitTypeColumn) => {
    if (col.isBuiltin) return
    setEditingId(col.id)
    setEditValue(col.label)
  }, [])

  const commitEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRenameColumn(editingId, editValue.trim())
    }
    setEditingId(null)
  }, [editingId, editValue, onRenameColumn])

  return (
    <div
      className="flex items-center border-b sticky top-0 z-10"
      style={{ borderColor: '#333', background: 'var(--bg-dark)' }}
    >
      {/* Product name column */}
      <div className="flex-1 min-w-[200px] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Product
        </span>
      </div>

      {/* Unit type checkbox columns */}
      {columns.map(col => {
        const abbrev = COLUMN_ABBREVS[col.id] ?? col.label.slice(0, 4)
        const isEditing = editingId === col.id

        return (
          <div
            key={col.id}
            className="w-[44px] flex-shrink-0 flex items-center justify-center py-2"
            title={col.label}
          >
            {isEditing ? (
              <Input
                type="text"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                className="w-[40px] text-[9px] text-center px-0.5 py-0.5"
              />
            ) : (
              <span
                className={`text-[9px] font-medium uppercase tracking-tight ${
                  col.isBuiltin
                    ? 'text-[var(--text-secondary)] cursor-default'
                    : 'text-[var(--text-secondary)] cursor-pointer hover:text-[var(--accent)]'
                }`}
                onDoubleClick={() => startEdit(col)}
              >
                {abbrev}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
