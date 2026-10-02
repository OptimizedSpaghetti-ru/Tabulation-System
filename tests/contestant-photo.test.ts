import assert from "node:assert/strict"
import test from "node:test"
import { validateContestantPhoto } from "../src/lib/contestant-photo.ts"
test("accepts supported photos up to 5 MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateContestantPhoto({ type, size: 5 * 1024 * 1024 }), null)
  }
})
test("rejects unsupported formats and empty or oversized files", () => {
  assert.match(
    validateContestantPhoto({ type: "image/svg+xml", size: 100 })!,
    /JPEG, PNG, or WebP/,
  )
  assert.match(
    validateContestantPhoto({ type: "image/png", size: 0 })!,
    /empty/,
  )
  assert.match(
    validateContestantPhoto({ type: "image/png", size: 5 * 1024 * 1024 + 1 })!,
    /5 MB/,
  )
})
