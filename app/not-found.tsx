import Link from "next/link";
import LoginScreen from "./components/LoginScreen";

export const dynamic = "force-dynamic";

/** Missing routes still land on login / home instead of a dead 404. */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <p className="px-4 pt-4 text-center text-sm text-muted">
        That page is not available.{" "}
        <Link href="/" className="font-medium text-accent hover:text-accent-hover">
          Go to home
        </Link>
      </p>
      <LoginScreen />
    </div>
  );
}
