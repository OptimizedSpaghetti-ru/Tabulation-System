import type { SupabaseClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const respond = (body: unknown, status: number) =>
  Response.json(body, { status, headers: corsHeaders })

export async function createJudge(
  request: Request,
  client: SupabaseClient,
): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "POST")
    return respond({ error: "Method not allowed." }, 405)
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token)
    return respond({ error: "Sign in as an administrator to add judges." }, 401)
  try {
    const { data: auth, error: authError } = await client.auth.getUser(token)
    if (authError || !auth.user)
      return respond({ error: "Your session expired. Sign in again." }, 401)
    const { data: admin, error: adminError } = await client
      .from("profiles")
      .select("role, status")
      .eq("auth_user_id", auth.user.id)
      .maybeSingle()
    if (adminError || admin?.role !== "admin" || admin.status !== "active") {
      return respond(
        { error: "Only active administrators can add judges." },
        403,
      )
    }
    let body
    try {
      body = await request.json()
    } catch {
      return respond({ error: "Enter a username and password." }, 400)
    }
    const username =
      typeof body?.username === "string"
        ? body.username.trim().toLowerCase()
        : ""
    const password = typeof body?.password === "string" ? body.password : ""
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      return respond(
        {
          error:
            "Username must be 3–30 characters using letters, numbers, underscores, dots, or hyphens.",
        },
        400,
      )
    }
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
    ) {
      return respond(
        {
          error:
            "Password needs 8+ characters with uppercase, lowercase, number, and special character.",
        },
        400,
      )
    }
    const email = `${username}@tabulation.local`
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: `Judge ${username}` },
    })
    if (error || !data.user) {
      const duplicate =
        error?.code === "email_exists" || error?.code === "user_already_exists"
      return respond(
        {
          error: duplicate
            ? "This username is already taken. Choose another username."
            : "Could not create the judge account. Check the password and try again.",
        },
        duplicate ? 409 : 400,
      )
    }
    // Upsert also handles installations whose signup trigger did not create a profile.
    const { error: profileError } = await client.from("profiles").upsert(
      {
        auth_user_id: data.user.id,
        full_name: `Judge ${username}`,
        email,
        role: "judge",
        status: "active",
      },
      { onConflict: "auth_user_id" },
    )
    if (profileError) {
      const { error: cleanupError } = await client.auth.admin.deleteUser(
        data.user.id,
      )
      if (cleanupError)
        console.error("Judge account cleanup failed", data.user.id)
      return respond(
        {
          error: cleanupError
            ? "Judge setup failed. Contact support before retrying this username."
            : "Could not save the judge profile. Please try again.",
        },
        500,
      )
    }
    return respond({ username }, 201)
  } catch {
    return respond({ error: "Could not add the judge. Please try again." }, 500)
  }
}
