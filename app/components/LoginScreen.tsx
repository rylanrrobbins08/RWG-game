import AuthForm from "./AuthForm";

/** Full-page Login / Sign Up layout. */
export default function LoginScreen() {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#172554_0%,_transparent_50%),linear-gradient(160deg,_#0c0e12_0%,_#12161f_45%,_#0c0e12_100%)]"
      />
      <div className="relative w-full max-w-md">
        <AuthForm />
      </div>
    </div>
  );
}
