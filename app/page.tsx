import WrestlerSelect from "./components/WrestlerSelect";
import HomeEntry from "./components/HomeEntry";
import { listWrestlersFromCloud } from "@/lib/wrestler-actions";
import { getOptionalUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

/** Home: wrestler select when signed in. */
export default async function Home() {
  const user = await getOptionalUser().catch(() => null);
  if (!user) {
    return <HomeEntry />;
  }

  try {
    const result = await listWrestlersFromCloud();
    return (
      <WrestlerSelect
        initialWrestlers={result.data}
        loadError={result.ok ? null : result.error}
      />
    );
  } catch (error) {
    console.error("Home page:", error);
    return <WrestlerSelect initialWrestlers={[]} loadError="Could not load wrestlers." />;
  }
}
