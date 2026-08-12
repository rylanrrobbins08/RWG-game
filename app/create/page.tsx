"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MAX_CAREERS } from "@/lib/career-slots";
import { listWrestlersFromCloud } from "@/lib/wrestler-actions";
import WrestlerCreator from "../components/WrestlerCreator";

export default function CreateWrestlerPage() {
  const [cloudCount, setCloudCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listWrestlersFromCloud()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setCloudCount(result.data.length);
          return;
        }
        setCloudCount(0);
      })
      .catch((error) => {
        console.error("Create wrestler page:", error);
        if (!cancelled) setCloudCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const atCloudLimit = cloudCount !== null && cloudCount >= MAX_CAREERS;

  if (atCloudLimit) {
    return (
      <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/"
          className="font-display text-sm uppercase tracking-[0.12em] text-accent transition hover:text-accent-hover"
        >
          ← Back to select
        </Link>
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground">
          Career limit reached
        </h1>
        <p className="text-sm text-muted sm:text-base" role="alert">
          You already have {MAX_CAREERS} wrestlers saved. Return to select and
          continue an existing career before creating another.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div className="relative mx-auto max-w-2xl px-5 pt-6 sm:px-8">
        <Link
          href="/"
          className="font-display text-sm uppercase tracking-[0.12em] text-accent transition hover:text-accent-hover"
        >
          ← Back to select
        </Link>
        {cloudCount !== null && (
          <p className="mt-2 text-xs text-muted">
            {cloudCount} of {MAX_CAREERS} careers used
          </p>
        )}
      </div>
      <WrestlerCreator />
    </div>
  );
}
