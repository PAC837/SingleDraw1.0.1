/**
 * Button with primary, secondary, and toggle variants.
 */

const VARIANT_CLASSES = {
  primary: 'bg-[var(--accent)] text-black font-medium rounded hover:opacity-90 transition-opacity',
  secondary: 'bg-gray-800 text-white border border-gray-600 rounded hover:bg-gray-700 transition-colors',
  toggle: 'rounded transition-colors',
} as const

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'toggle'
  active?: boolean
  size?: 'sm' | 'md'
}

export default function Button({ variant, active, size = 'md', className = '', ...rest }: ButtonProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : 'text-xs px-3 py-2'

  const toggleClass = variant === 'toggle'
    ? (active ? 'bg-[var(--accent)] text-black font-medium' : 'bg-[#333] text-[#aaa]')
    : ''

  return (
    <button
      className={`${sizeClass} ${VARIANT_CLASSES[variant]} ${toggleClass} ${className}`}
      {...rest}
    />
  )
}
