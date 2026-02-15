export default function AppLoading() {
  return (
    <section className="mx-auto w-full max-w-6xl animate-pulse space-y-4">
      <div className="h-8 w-40 rounded bg-panelSoft" />
      <div className="rounded-xl border border-border bg-panel p-5">
        <div className="h-4 w-28 rounded bg-panelSoft" />
        <div className="mt-3 h-6 w-52 rounded bg-panelSoft" />
        <div className="mt-3 h-4 w-3/4 rounded bg-panelSoft" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-xl border border-border bg-panel" />
        <div className="h-28 rounded-xl border border-border bg-panel" />
      </div>
      <div className="h-56 rounded-xl border border-border bg-panel" />
    </section>
  );
}
