import { X } from 'lucide-react';
import StorefrontAffiliateForm from '@/components/storefront/StorefrontAffiliateForm';

interface Props {
  branchId: string;
  accent: string;
  portalPath: string;
  onClose: () => void;
}

const StorefrontMembershipPopup = ({ branchId, accent, portalPath, onClose }: Props) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-background border border-border rounded-2xl max-w-sm w-full shadow-xl">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Membresía</h3>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">
        <StorefrontAffiliateForm branchId={branchId} accent={accent} portalPath={portalPath} />
      </div>
    </div>
  </div>
);

export default StorefrontMembershipPopup;
