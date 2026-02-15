import { LlmSettings } from "@/components/settings/llm-settings";
import { ProfileIntegrations } from "@/components/settings/profile-integrations";

export default function SettingsPage() {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-textMuted">Profile, integrations, and AI configuration.</p>
      </header>

      <ProfileIntegrations />
      <LlmSettings />
    </section>
  );
}

