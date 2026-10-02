import { test } from "node:test"
import assert from "node:assert/strict"
import { canAccessPage, navigationForRole } from "../src/lib/role-access.ts"
test("admins cannot score but can manage judges and results", () => {
  assert.equal(canAccessPage("admin", "scores"), false)
  assert.equal(canAccessPage("admin", "judges"), true)
  assert.equal(canAccessPage("admin", "tabulation"), true)
  assert.equal(navigationForRole("admin").includes("Scores"), false)
})
test("judges cannot enter administrative pages through direct URLs", () => {
  for (const page of ["contestants", "judges", "assign-judges", "audit-logs", "tabulation"]) {
    assert.equal(canAccessPage("judge", page), false, page)
  }
  assert.equal(canAccessPage("judge", "scores"), true)
  assert.equal(canAccessPage("judge", "criteria"), true)
  assert.equal(canAccessPage("judge", "competition"), true)
})
test("unknown roles and pages fail closed", () => {
  for (const role of ["viewer", "", "admin,judge"]) {
    assert.equal(canAccessPage(role, "scores"), false)
    assert.equal(canAccessPage(role, "judges"), false)
    assert.deepEqual(navigationForRole(role), [])
  }
  assert.equal(canAccessPage("admin", "unknown"), false)
})
