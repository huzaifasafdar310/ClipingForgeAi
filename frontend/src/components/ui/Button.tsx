import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-black font-bold hover:bg-primary-hover active:bg-primary-active shadow-glow-sm hover:shadow-glow',
        secondary:
          'bg-surface-2 text-foreground hover:bg-surface-3 border border-border-subtle hover:border-border-muted',
        outline:
          'border border-border-subtle bg-transparent hover:bg-surface-2 text-foreground',
        ghost:
          'text-muted-foreground hover:text-foreground hover:bg-surface-2',
        danger:
          'bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30',
        cyan:
          'bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25 shadow-glow-cyan',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
        md: 'h-10 px-4 text-xs font-semibold rounded-xl gap-2',
        lg: 'h-12 px-6 text-sm font-bold rounded-2xl gap-2.5',
        icon: 'h-9 w-9 p-0 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {isLoading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
