import CompanyPermits from "./CompanyPermits";

export default function DesignProfessionalPermitting() {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-35">
        <CompanyPermits />
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
        <div className="rounded-2xl border border-border/70 bg-card/95 px-8 py-6 text-center shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Design Pro Permitting
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Coming Soon</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            This permitting workspace is planned for Design Pro accounts, but it is not interactive yet.
          </p>
        </div>
      </div>
    </div>
  );
}
