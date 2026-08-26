import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-foreground border-border-subtle',
        primary: 'bg-primary/15 text-primary border-primary/30',
        secondary: 'bg-secondary/15 text-secondary border-secondary/30',
        success: 'bg-status-success/15 text-status-success border-status-success/30',
        error: 'bg-status-error/15 text-status-error border-status-error/30',
        warning: 'bg-status-warning/15 text-status-warning border-status-warning/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ className, variant, children, ...props }) => {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
};
