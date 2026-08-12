import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginScreen from "../components/LoginScreen";
import { getOptionalUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login / Sign Up",
  description: "Log in or sign up to play RWG.",
};

export default async function AuthPage() {
  try {
    const user = await getOptionalUser();
    if (user) {
      redirect("/");
    }
  } catch (error) {
    console.error("Auth page:", error);
  }

  return <LoginScreen />;
}
