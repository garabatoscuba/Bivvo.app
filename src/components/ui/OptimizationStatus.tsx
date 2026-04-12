import { CheckCircle, Info } from 'lucide-react';

interface Props {
  result: { message: string; variant: 'success' | 'info' } | null;
  optimizing: boolean;
}

const OptimizationStatus = ({ result, optimizing }: Props) => {
  if (optimizing) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5 animate-pulse">
        <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Optimizando imagen…
      </div>
    );
  }
  if (!result) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs mt-1.5 ${result.variant === 'success' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
      {result.variant === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
      {result.message}
    </div>
  );
};

export default OptimizationStatus;
