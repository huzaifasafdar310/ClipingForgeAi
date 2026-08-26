import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export type ProjectCategory = 'all' | 'analyzed' | 'completed';

interface FilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: ProjectCategory;
  onCategoryChange: (category: ProjectCategory) => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}) => {
  const categories: Array<{ id: ProjectCategory; label: string }> = [
    { id: 'all', label: 'All Clips' },
    { id: 'analyzed', label: 'Analyzed' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="bg-surface-1 rounded-2xl p-4 border border-border-subtle flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Search Bar */}
      <div className="relative w-full md:w-80">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by clip title, reasoning, tag..."
          icon={<Search className="w-4 h-4" />}
          className="text-xs py-2 h-10"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all',
                isActive
                  ? 'bg-primary text-black font-bold shadow-glow-sm'
                  : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground border border-border-subtle'
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
