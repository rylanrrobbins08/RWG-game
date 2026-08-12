"use client";

import Link from "next/link";
import { canCreateCareer, getCareerCount, MAX_CAREERS } from "@/lib/career-slots";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WrestlerCreator from "../components/WrestlerCreator";

export default function CreateWrestlerPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    const ok = canCreateCareer();
    setUsed(getCareerCount());
    setAllowed(ok);
    if (!ok) {
      router.replace("/");
    }
  }, [router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-sm text-muted">
        Checking career slots…
      </div>
    );
  }

  if (!allowed) {
    return null;
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
        <p className="mt-2 text-xs text-muted">
          {used} of {MAX_CAREERS} careers used
        </p>
      </div>
      <WrestlerCreator />
    </div>
  );
}
