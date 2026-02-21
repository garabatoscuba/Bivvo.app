import { Link } from 'react-router-dom';

const StorefrontFooter = () => (
  <footer className="border-t border-border mt-auto">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
      <Link
        to="/"
        className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        Powered by GestorPro
      </Link>
    </div>
  </footer>
);

export default StorefrontFooter;
