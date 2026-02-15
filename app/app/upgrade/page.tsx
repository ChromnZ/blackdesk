import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";

export default function UpgradePage() {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">BlackDesk Pro</p>
          <CardTitle className="mt-2 text-2xl">Upgrade is coming soon</CardTitle>
          <CardDescription>
            Pro plans are not available yet. We are preparing advanced workflows,
            automations, and team features.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pt-1">
          <Button asChild variant="primary">
            <Link href="/app/settings">Manage account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
