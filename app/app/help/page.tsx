export default function HelpPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-4 rounded-xl border border-border bg-panel p-5 shadow-glow">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Support</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Help</h1>
      </header>

      <p className="text-sm text-textMuted">
        For account, billing, or integration issues, send details to support and include
        your email plus the provider/model you are using.
      </p>

      <div className="rounded-lg border border-border bg-panelSoft p-4 text-sm text-textMain">
        <p className="font-medium">Quick links</p>
        <ul className="mt-2 space-y-1 text-textMuted">
          <li>1. Settings - update profile, integrations, and API keys.</li>
          <li>2. AI Agent - switch model/provider directly in chat.</li>
          <li>3. Calendar - manage events and tasks in one planner.</li>
        </ul>
      </div>
    </section>
  );
}
