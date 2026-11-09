'use client'

/**
 * Savborne — button primitives
 *
 * The handoff's five button treatments and four sizes. The CSS lives in
 * `globals.css` so the source-level contract tests can pin the geometry
 * without a renderer; this module only composes the class list.
 */

import Link from 'next/link'
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'icon'
export type ButtonSize = 'lg' | 'md' | 'sm' | 'move' | 'mode' | 'item'

type StyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

function resolveSize(variant: ButtonVariant, size?: ButtonSize): ButtonSize {
  if (size) return size
  if (variant === 'primary') return 'lg'
  if (variant === 'icon') return 'sm'
  return 'md'
}

function resolveFullWidth(variant: ButtonVariant, fullWidth?: boolean): boolean {
  if (fullWidth !== undefined) return fullWidth
  return variant === 'primary' || variant === 'secondary' || variant === 'destructive'
}

export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size?: ButtonSize,
  fullWidth?: boolean,
): string {
  return [
    'sv-btn',
    `sv-btn--${variant}`,
    `sv-btn--${resolveSize(variant, size)}`,
    resolveFullWidth(variant, fullWidth) ? 'sv-btn--full' : '',
    'sv-press',
  ]
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps & {
    loading?: boolean
    children?: ReactNode
  }

export function Button({
  variant = 'secondary',
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={`${buttonClasses(variant, size, fullWidth)} ${className ?? ''}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
      {loading && (
        <span className="sv-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      )}
    </button>
  )
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps

export function ButtonLink({
  variant = 'secondary',
  size,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      className={`${buttonClasses(variant, size, fullWidth)} ${className ?? ''}`.trim()}
    >
      {children}
    </Link>
  )
}
