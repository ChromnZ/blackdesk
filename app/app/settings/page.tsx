import { LlmSettings } from "@/components/settings/llm-settings";
import { ProfileIntegrations } from "@/components/settings/profile-integrations";
import { ThemeSelector } from "@/components/theme-selector";

export default function SettingsPage() {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-textMuted">Profile, integrations, and AI configuration.</p>
      </header>

      <div className="rounded-lg border border-border bg-panel p-5 shadow-glow">
        <h2 className="font-display text-lg">Appearance</h2>
        <p className="mt-1 text-sm text-textMuted">
          Switch between light, dark, or system theme.
        </p>
        <div className="mt-4">
          <ThemeSelector />
        </div>
      </div>

      <ProfileIntegrations />
      <LlmSettings />
    </section>
  );
}

