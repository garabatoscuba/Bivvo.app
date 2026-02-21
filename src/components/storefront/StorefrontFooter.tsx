import { Link } from 'react-router-dom';

interface Props {
  businessName: string;
}

const StorefrontFooter = ({ businessName }: Props) => (
  <footer className="border-t border-border mt-auto">
    <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 flex flex-col items-center gap-3 text-center">
      <span className="text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} {businessName}
      </span>
      <span className="hidden sm:block w-px h-3 bg-border" />
      <span className="block sm:hidden w-8 h-px bg-border" />
      <Link
        to="/"
        className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
      >
        Powered by GestorPro
      </Link>
    </div>
  </footer>
);

export default StorefrontFooter;
