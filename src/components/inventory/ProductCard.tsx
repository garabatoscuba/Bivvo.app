import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "./CategoryBadge";
import { Package, AlertTriangle } from "lucide-react";
import type { Product, Category } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product & { category: Category | null };
  stock?: number;
  onClick?: () => void;
  compact?: boolean;
  disabled?: boolean;
}

export const ProductCard = ({ product, stock = 0, onClick, compact = false, disabled = false }: ProductCardProps) => {
  const isLowStock = stock <= product.min_stock && stock > 0;
  const isOutOfStock = stock <= 0;

  if (compact) {
    return (
      <Card
        className={cn(
          "transition-all overflow-hidden",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
          isOutOfStock && !disabled && "opacity-50",
        )}
        onClick={disabled ? undefined : onClick}
      >
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full rounded-lg object-cover" />
              ) : (
                <Package className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm leading-snug break-words">{product.name}</h4>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-sm font-bold text-primary">${Number(product.sale_price).toFixed(2)}</p>
                <Badge variant={isOutOfStock ? "secondary" : "outline"} className="text-[10px] px-2 py-0.5 h-auto flex-shrink-0">
                  {stock} disp.
                </Badge>
                {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn("cursor-pointer transition-all hover:shadow-md", isOutOfStock && "opacity-50")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="aspect-square relative rounded-lg bg-muted mb-3 overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {isLowStock && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Stock bajo
              </Badge>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Badge variant="secondary">Sin stock</Badge>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {product.category && <CategoryBadge name={product.category.name} color={product.category.color} />}

          <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">${Number(product.sale_price).toFixed(2)}</span>
            <span className="text-sm text-muted-foreground">Stock: {stock}</span>
          </div>

          <p className="text-xs text-muted-foreground">{product.code}</p>
        </div>
      </CardContent>
    </Card>
  );
};
