import { createClient } from "@supabase/supabase-js";

/**
 * Registration goes through this server route instead of a plain client-side
 * `supabase.auth.updateUser({ email })` call because that counts as a
 * "secure email change" to Supabase and always tries to send a confirmation
 * email — on the free tier's very low send quota that reliably hits
 * "email rate limit exceeded" after a handful of signups, and the synthetic
 * `@onepiece.local` addresses this app uses can never receive mail anyway.
 * The admin API sets the email as already-confirmed and never sends mail.
 *
 * The caller's access token is verified server-side (via the anon client)
 * to resolve the real user id, rather than trusting a client-supplied id —
 * otherwise anyone could pass an arbitrary user id and hijack that account.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: "Supabase ist serverseitig nicht konfiguriert." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const avatarCharacterId = typeof body?.avatarCharacterId === "string" ? body.avatarCharacterId : null;
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";

  if (!accessToken) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (username.length < 3) return Response.json({ error: "Nutzername muss mindestens 3 Zeichen haben." }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Passwort muss mindestens 6 Zeichen haben." }, { status: 400 });
  if (!email) return Response.json({ error: "Ungültige E-Mail." }, { status: 400 });
  if (!inviteCode) return Response.json({ error: "Einladungscode wird benötigt." }, { status: 400 });

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await anonClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return Response.json({ error: "Sitzung ungültig, bitte Seite neu laden." }, { status: 401 });
  }
  const userId = userData.user.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Atomic compare-and-swap: only succeeds if the code exists and is still unused,
  // so two simultaneous signups can't both redeem the same code.
  const { data: redeemed, error: redeemError } = await adminClient
    .from("invite_codes")
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq("code", inviteCode)
    .is("used_by", null)
    .select("code")
    .maybeSingle();
  if (redeemError) return Response.json({ error: redeemError.message }, { status: 500 });
  if (!redeemed) return Response.json({ error: "Einladungscode ist ungültig oder schon benutzt." }, { status: 400 });

  const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    email,
    password,
    email_confirm: true,
  });
  if (updateError) {
    await adminClient.from("invite_codes").update({ used_by: null, used_at: null }).eq("code", inviteCode);
    const msg = updateError.message.toLowerCase();
    if (msg.includes("already been registered") || msg.includes("already exists")) {
      return Response.json({ error: "Dieser Nutzername ist schon vergeben." }, { status: 409 });
    }
    return Response.json({ error: updateError.message }, { status: 400 });
  }
  if (!updated.user) {
    await adminClient.from("invite_codes").update({ used_by: null, used_at: null }).eq("code", inviteCode);
    return Response.json({ error: "Registrierung fehlgeschlagen." }, { status: 500 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: updated.user.id,
      username,
      nickname: username,
      avatar_character_id: avatarCharacterId,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });

  return Response.json({});
}
