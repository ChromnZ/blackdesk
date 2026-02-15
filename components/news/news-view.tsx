"use client";

import {
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
} from "@/lib/news";
import { swrFetcher } from "@/lib/swr-fetcher";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";

type NewsPayload = {
  category: NewsCategory;
  articles: NewsArticle[];
  fetchedAt?: string;
  error?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NewsView() {
  const [activeTab, setActiveTab] = useState<NewsCategory>("local");

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<NewsPayload>(
    `/api/news?category=${activeTab}`,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  const articles = data?.articles ?? [];
  const categoryError = data?.error ?? error?.message ?? null;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5">
      <header className="rounded-xl border border-border bg-panel p-6 shadow-glow">
        <p className="text-xs uppercase tracking-[0.28em] text-textMuted">News</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Daily Briefing
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-textMuted">
          Switch between categories and scan headlines quickly.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-panel p-4 shadow-glow">
        <div className="flex flex-wrap gap-2">
          {NEWS_CATEGORIES.map((category) => {
            const isActive = category.key === activeTab;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveTab(category.key)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition",
                  isActive
                    ? "border-accent/25 bg-accent text-accentText"
                    : "border-border bg-panelSoft text-textMuted hover:bg-panelSoft hover:text-textMain",
                )}
              >
                {category.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => void mutate()}
            className="ml-auto rounded-md border border-border bg-panelSoft px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-textMuted transition hover:bg-panelSoft hover:text-textMain"
          >
            {isValidating ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {categoryError && (
          <p className="mt-4 rounded-md border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
            {categoryError}
          </p>
        )}

        {isLoading && !data ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="animate-pulse rounded-md border border-border bg-panelSoft/90 px-3 py-3"
              >
                <div className="h-4 w-3/4 rounded bg-panelSoft" />
                <div className="mt-2 h-3 w-1/3 rounded bg-panelSoft" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <p className="mt-4 rounded-md border border-border bg-panelSoft/80 px-3 py-6 text-sm text-textMuted">
            No news articles were available for this category right now.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {articles.map((article, index) => (
              <li
                key={`${article.url}-${index}`}
                className="rounded-md border border-border bg-panelSoft/80 px-4 py-3 transition hover:bg-panel"
              >
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm font-medium text-textMain transition hover:text-accent"
                >
                  {article.title}
                </a>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-textMuted">
                  <span>{article.source ?? "Unknown source"}</span>
                  {article.publishedAt && (
                    <span>{dateFormatter.format(new Date(article.publishedAt))}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
