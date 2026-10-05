import type { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: Promise<BrowserClient> | null = null;

// supabase-js is ~185 KB that every page with a form downloaded and parsed on
// load, although nothing touches the browser client until a save, a delete or
// a sign-in. It is imported on first use instead; the promise is the singleton.
export function createClient(): Promise<BrowserClient> {
  client ??= import("@supabase/ssr").then(({ createBrowserClient }) =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  );
  return client;
}

// The signed-in user, for stamping `user_id` on a write. Read from the local
// session instead of getUser(), which made every save wait on an Auth
// round-trip before its insert could even start. Nothing is trusted on the
// strength of it: RLS's `with check (auth.uid() = user_id)` authorizes the write.
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}
