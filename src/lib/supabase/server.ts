import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — can be ignored
            // if middleware is refreshing sessions.
          }
        },
      },
    }
  );
}

export interface AuthUser {
  id: string;
  email: string | undefined;
}

// The signed-in user, read from the verified JWT rather than fetched. The
// project signs tokens with an asymmetric key, so getClaims() checks the
// signature locally against the cached JWKS — no round-trip to the Auth server,
// which getUser() made on every render. It cannot see a session revoked before
// its token expires, but neither can RLS: every query carries that same token.
// Wrapped in `cache` so layout + page share one verification per request.
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  return { id: data.claims.sub, email: data.claims.email };
});
