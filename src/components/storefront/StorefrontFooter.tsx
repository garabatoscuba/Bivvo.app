import { Link } from 'react-router-dom';
import FadeInView from '@/components/storefront/FadeInView';

interface Props {
  businessName: string;
}

const StorefrontFooter = ({ businessName }: Props) => (
  <footer className="border-t border-border mt-auto">
    <FadeInView className="max-w-5xl mx-auto px-6 sm:px-10 py-10 flex items-center justify-center gap-4 text-center">
      <span className="text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} {businessName}
      </span>
      <span className="w-px h-3.5 bg-border" />
      <Link
        to="/"
        className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
      >
        Powered by GestorPro
      </Link>
    </FadeInView>
  </footer>
);

export default StorefrontFooter;
