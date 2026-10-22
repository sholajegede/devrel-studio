import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ink/25 focus-visible:ring-[3px] aria-invalid:ring-destructive/25 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // The signature button: one soft corner pair, one tight one.
        default:
          'rounded-[2rem_0.5rem_0.5rem_2rem] bg-accent text-accent-foreground hover:bg-ink hover:text-paper',
        destructive:
          'rounded-full bg-destructive text-destructive-foreground hover:bg-ink focus-visible:ring-destructive/25',
        outline:
          'rounded-full border border-ink/25 bg-transparent text-foreground hover:border-ink hover:bg-sand',
        secondary:
          'rounded-full bg-blue text-paper hover:bg-ink',
        ghost:
          'rounded-full text-foreground hover:bg-sand',
        link: 'rounded-none text-foreground underline underline-offset-4 decoration-ink/30 hover:decoration-accent hover:text-accent',
      },
      size: {
        default: 'h-10 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-9 gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-12 px-7 text-base has-[>svg]:px-6',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
