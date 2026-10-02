import { test } from "node:test"
import assert from "node:assert/strict"
import { createJudge } from "../supabase/functions/create-judge/handler.ts"
function backend(role = "admin", status = "active", profileFails = false) {
  const users: any[] = []
  const profiles: any[] = []
  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-id" } },
        error: null,
      }),
      admin: {
        createUser: async (attributes: any) => {
          users.push({ id: "new-id", ...attributes })
          return { data: { user: { id: "new-id" } }, error: null }
        },
        deleteUser: async () => {
          users.length = 0
          return { error: null }
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role, status }, error: null }),
        }),
      }),
      upsert: async (profile: any) => {
        if (profileFails) return { error: { message: "database unavailable" } }
        profiles.push(profile)
        return { error: null }
      },
    }),
  }
  return { client, users, profiles }
}
const request = (body: unknown, authorized = true) =>
  new Request("https://example.com/create-judge", {
    method: "POST",
    headers: authorized ? { Authorization: "Bearer test-token" } : {},
    body: JSON.stringify(body),
  })
test("creates an active judge with normalized username and confirmed credentials", async () => {
  const b = backend()
  const response = await createJudge(
    request({ username: " Judge.One ", password: "Secure123!" }),
    b.client,
  )
  assert.equal(response.status, 201)
  assert.equal(b.users[0].email, "judge.one@tabulation.local")
  assert.equal(b.users[0].password, "Secure123!")
  assert.equal(b.users[0].email_confirm, true)
  assert.equal(b.profiles[0].role, "judge")
  assert.equal(b.profiles[0].status, "active")
  assert.ok(!JSON.stringify(await response.json()).includes("Secure123!"))
})
test("blocks missing authentication, non-admins, and suspended admins", async () => {
  for (const [role, status, authorized] of [
    ["judge", "active", true],
    ["admin", "suspended", true],
    ["admin", "active", false],
  ] as const) {
    const b = backend(role, status)
    const response = await createJudge(
      request({ username: "judge1", password: "Secure123!" }, authorized),
      b.client,
    )
    assert.ok([401, 403].includes(response.status))
    assert.equal(b.users.length, 0)
  }
})
test("rejects malformed usernames and weak passwords before creating accounts", async () => {
  for (const body of [
    { username: "ab", password: "Secure123!" },
    { username: "bad@email", password: "Secure123!" },
    { username: "judge1", password: "weak" },
    null,
  ]) {
    const b = backend()
    assert.equal((await createJudge(request(body), b.client)).status, 400)
    assert.equal(b.users.length, 0)
  }
})
test("removes the new auth account if its profile cannot be saved", async () => {
  const b = backend("admin", "active", true)
  assert.equal(
    (
      await createJudge(
        request({ username: "123", password: "Secure123!" }),
        b.client,
      )
    ).status,
    500,
  )
  assert.equal(b.users.length, 0)
})
