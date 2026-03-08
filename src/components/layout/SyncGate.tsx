// SyncGate is now a passthrough — offline blocking replaced by OfflineBanner
export const SyncGate = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
