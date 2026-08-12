import WrestlerSelect from "./components/WrestlerSelect";
import LoginScreen from "./components/LoginScreen";
import { listWrestlersFromCloud } from "@/lib/wrestler-actions";
import { getOptionalUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return <LoginScreen />;
    }

    const result = await listWrestlersFromCloud();
    return (
      <WrestlerSelect
        initialWrestlers={result.data}
        loadError={result.ok ? null : result.error}
      />
    );
  } catch (error) {
    console.error("Home page:", error);
    return <LoginScreen />;
  }
}
