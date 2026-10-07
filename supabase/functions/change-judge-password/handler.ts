import type { SupabaseClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const respond = (body: unknown, status: number) => Response.json(body, { status, headers: corsHeaders })

export async function changeJudgePassword(request: Request, client: SupabaseClient): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405)
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return respond({ error: "Sign in as an administrator to change judge passwords." }, 401)
  try {
    const { data: auth, error: authError } = await client.auth.getUser(token)
    if (authError || !auth.user) return respond({ error: "Your session expired. Sign in again." }, 401)
    const { data: admin, error: adminError } = await client.from("profiles")
      .select("role, status").eq("auth_user_id", auth.user.id).maybeSingle()
    if (adminError || admin?.role !== "admin" || admin.status !== "active")
      return respond({ error: "Only active administrators can change judge passwords." }, 403)
    let body
    try { body = await request.json() } catch {
      return respond({ error: "Select a judge and enter a new password." }, 400)
    }
    const judgeId = typeof body?.judgeId === "string" ? body.judgeId : ""
    const password = typeof body?.password === "string" ? body.password : ""
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(judgeId))
      return respond({ error: "Select a valid judge from the directory." }, 400)
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password))
      return respond({ error: "Password needs 8+ characters with uppercase, lowercase, number, and special character." }, 400)
    const { data: judge, error: judgeError } = await client.from("profiles")
      .select("auth_user_id, role").eq("id", judgeId).maybeSingle()
    if (judgeError) return respond({ error: "Could not load the judge account. Please try again." }, 500)
    if (!judge) return respond({ error: "Judge account not found. Refresh the directory." }, 404)
    if (judge.role !== "judge" || !judge.auth_user_id || judge.auth_user_id === auth.user.id)
      return respond({ error: "Select a judge account with a linked login." }, 400)
    const { data, error } = await client.auth.admin.updateUserById(judge.auth_user_id, { password })
    if (error || !data.user) return respond({ error: "Could not change the password. Try a different password or try again later." }, 400)
    return respond({ judgeId }, 200)
  } catch {
    return respond({ error: "Could not change the password. Please try again." }, 500)
  }
}
