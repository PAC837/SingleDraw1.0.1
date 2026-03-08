/**
 * Styled input with dark theme and accent border.
 */
import { forwardRef } from 'react'

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input
      ref={ref}
      className={`text-xs px-2 py-1 bg-gray-800 border border-[var(--accent)] text-white rounded focus:outline-none ${className}`}
      {...rest}
    />
  ),
)

Input.displayName = 'Input'
export default Input
