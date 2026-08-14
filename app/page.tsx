import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
      <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground">
        RWG is online
      </h1>
      <Link href="/auth" className="rwg-btn rwg-btn-primary">
        Go to login
      </Link>
    </main>
  );
}
