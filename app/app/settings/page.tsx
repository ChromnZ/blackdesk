import { LlmSettings } from "@/components/settings/llm-settings";
import { ProfileIntegrations } from "@/components/settings/profile-integrations";
import { ThemeSelector } from "@/components/theme-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";

export default function SettingsPage() {
  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-textMuted">Profile, integrations, and AI configuration.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Switch between light, dark, or system theme.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ThemeSelector />
          <Separator className="mt-4" />
        </CardContent>
      </Card>

      <ProfileIntegrations />
      <LlmSettings />
    </section>
  );
}

