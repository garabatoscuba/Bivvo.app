import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  name: string;
  color: string;
  className?: string;
}

const colorMap: Record<string, string> = {
  pink: 'bg-category-pink text-category-pink-foreground',
  green: 'bg-category-green text-category-green-foreground',
  blue: 'bg-category-blue text-category-blue-foreground',
  orange: 'bg-category-orange text-category-orange-foreground',
  purple: 'bg-category-purple text-category-purple-foreground',
};

export const CategoryBadge = ({ name, color, className }: CategoryBadgeProps) => {
  return (
    <Badge 
      className={cn(
        colorMap[color] || colorMap.blue,
        'font-medium',
        className
      )}
    >
      {name}
    </Badge>
  );
};
