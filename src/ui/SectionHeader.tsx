/**
 * Reusable section header with accent underline.
 */
export default function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
      {children}
    </h2>
  )
}
