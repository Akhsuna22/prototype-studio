/**
 * api/_supabaseAuth.js
 * --------------------
 * Shared helper: verifies a Supabase session token SERVER-SIDE before
 * letting a request through. This is the real security boundary - the
 * frontend also hides the UI behind a login screen, but that alone is
 * cosmetic. Anyone could call this API directly with curl, bypassing the
 * UI entirely. This check is what actually stops that.
 *
 * Deliberately does NOT use the @supabase/supabase-js library here.
 * That library's createClient() eagerly initializes a Realtime
 * (WebSocket) client even though we never use realtime features - which
 * crashes on Node.js versions below 22 with "native WebSocket not
 * found." Since all we actually need is "ask Supabase if this token is
 * valid," we call Supabase's Auth REST endpoint directly with a plain
 * fetch - lighter, avoids the WebSocket dependency entirely, and works
 * on any Node version.
 */

export async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null, error: "Missing login session. Please log in." };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: "Server is missing SUPABASE_URL/SUPABASE_ANON_KEY environment variables." };
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!res.ok) {
      return { user: null, error: "Your session has expired. Please log in again." };
    }

    const user = await res.json();
    if (!user?.id) {
      return { user: null, error: "Your session has expired. Please log in again." };
    }

    return { user, error: null };
  } catch (err) {
    return { user: null, error: "Couldn't verify your login: " + err.message };
  }
}