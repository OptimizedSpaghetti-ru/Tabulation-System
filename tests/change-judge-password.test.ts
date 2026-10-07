import { test } from "node:test"
import assert from "node:assert/strict"
import { changeJudgePassword } from "../supabase/functions/change-judge-password/handler.ts"

const judgeId = "12345678-1234-1234-1234-123456789abc"
function backend(options: { role?: string; status?: string; targetRole?: string; missing?: boolean; expired?: boolean; updateFails?: boolean } = {}) {
  const updates: any[] = []
  const client: any = {
    auth: {
      getUser: async () => ({ data: { user: options.expired ? null : { id: "admin-auth" } }, error: null }),
      admin: { updateUserById: async (id: string, attributes: any) => {
        updates.push({ id, ...attributes })
        return { data: { user: { id } }, error: options.updateFails ? { message: "failure" } : null }
      } },
    },
    from: () => ({ select: () => ({ eq: (column: string, value: string) => ({ maybeSingle: async () => {
      assert.ok(column === "auth_user_id" ? value === "admin-auth" : column === "id" && value === judgeId)
      return { data: column === "auth_user_id"
        ? { role: options.role ?? "admin", status: options.status ?? "active" }
        : options.missing ? null : { role: options.targetRole ?? "judge", auth_user_id: "judge-auth" }, error: null }
    } }) }) }),
  }
  return { client, updates }
}
const request = (body: unknown = { judgeId, password: "Secure123!" }, authorized = true) => new Request("https://example.com/change-judge-password", {
  method: "POST", headers: authorized ? { Authorization: "Bearer token" } : {}, body: JSON.stringify(body),
})

test("updates the selected judge's auth password without returning it", async () => {
  const b = backend()
  const response = await changeJudgePassword(request(), b.client)
  assert.equal(response.status, 200)
  assert.deepEqual(b.updates, [{ id: "judge-auth", password: "Secure123!" }])
  assert.deepEqual(await response.json(), { judgeId })
})
test("blocks unauthenticated, expired, judge, and inactive administrator sessions", async () => {
  for (const options of [{ role: "judge" }, { status: "suspended" }, { status: "pending" }, { expired: true }, {}]) {
    const b = backend(options)
    const response = await changeJudgePassword(request(undefined, Object.keys(options).length > 0), b.client)
    assert.ok([401, 403].includes(response.status))
    assert.equal(b.updates.length, 0)
  }
})
test("rejects weak passwords, invalid IDs, missing judges, and admin targets", async () => {
  for (const [body, options, expected] of [
    [{ judgeId, password: "weak" }, {}, 400],
    [{ judgeId: "invalid", password: "Secure123!" }, {}, 400],
    [null, {}, 400],
    [{ judgeId, password: "Secure123!" }, { missing: true }, 404],
    [{ judgeId, password: "Secure123!" }, { targetRole: "admin" }, 400],
  ] as const) {
    const b = backend(options)
    assert.equal((await changeJudgePassword(request(body), b.client)).status, expected)
    assert.equal(b.updates.length, 0)
  }
})
test("reports an auth update failure instead of success", async () => {
  const b = backend({ updateFails: true })
  assert.equal((await changeJudgePassword(request(), b.client)).status, 400)
})
test("supports preflight and rejects non-POST requests", async () => {
  for (const [method, status] of [["OPTIONS", 204], ["GET", 405]] as const) {
    const response = await changeJudgePassword(new Request("https://example.com", { method }), backend().client)
    assert.equal(response.status, status)
  }
})
