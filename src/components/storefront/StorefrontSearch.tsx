import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const StorefrontSearch = ({ value, onChange }: Props) => (
  <div className="relative">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Buscar productos..."
      className="w-full h-10 pl-10 pr-10 rounded-full bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:bg-muted/50 transition-all"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

export default StorefrontSearch;
