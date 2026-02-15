"use client";

import { useCallback, useEffect, useState } from "react";

type InboxItem = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
};

export function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setIsLoading(true);

    const response = await fetch("/api/inbox", { cache: "no-store" });
    if (!response.ok) {
      setError("Unable to load inbox items.");
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as InboxItem[];
    setItems(payload);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  async function addInboxItem() {
    const text = content.trim();
    if (!text) {
      setError("Content is required.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/inbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: text,
        type: "note",
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to save inbox item.");
      return;
    }

    const item = (await response.json()) as InboxItem;
    setItems((current) => [item, ...current]);
    setContent("");
    setError(null);
  }

  async function deleteItem(id: string) {
    const response = await fetch(`/api/inbox/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("Unable to delete inbox item.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function triggerExtractStub() {
    setExtractMessage(null);

    const response = await fetch("/api/extract", {
      method: "POST",
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    setExtractMessage(payload?.message ?? "Extraction endpoint is not available yet.");
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Inbox Dump</h1>
        <p className="mt-1 text-sm text-textMuted">
          Drop notes, ideas, and fragments quickly without organizing first.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-700/50 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-border bg-panel p-4 shadow-glow sm:p-5">
        <label htmlFor="inbox-content" className="mb-2 block text-sm text-textMuted">
          Dump anything
        </label>
        <textarea
          id="inbox-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-48 w-full rounded-md border border-border bg-panelSoft px-3 py-2 text-sm text-textMain"
          placeholder="Ideas, reminders, rough notes..."
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void addInboxItem()}
            disabled={isSaving}
            className="rounded-md border border-accent/25 bg-accent px-4 py-2 text-sm font-semibold text-accentText transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Add to inbox"}
          </button>
          <button
            type="button"
            onClick={() => void triggerExtractStub()}
            className="rounded-md border border-border bg-panelSoft px-4 py-2 text-sm text-textMain transition hover:bg-panelSoft"
          >
            Extract tasks/events (soon)
          </button>
        </div>

        {extractMessage && <p className="mt-3 text-sm text-textMuted">{extractMessage}</p>}
      </div>

      <div className="rounded-xl border border-border bg-panel p-4 shadow-glow sm:p-5">
        <h2 className="font-display text-lg">Recent items</h2>

        {isLoading ? (
          <p className="mt-4 text-sm text-textMuted">Loading inbox...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-textMuted">Inbox is empty. Add your first note above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-panelSoft p-4">
                <p className="whitespace-pre-wrap text-sm text-textMain">{item.content}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-textMuted">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item.id)}
                    className="rounded-md border border-red-700/50 bg-red-900/20 px-2.5 py-1 text-red-300 transition hover:bg-red-900/35"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

