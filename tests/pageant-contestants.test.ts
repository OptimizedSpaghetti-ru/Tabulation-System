import { test } from "node:test"
import assert from "node:assert/strict"
import {
  isCcsPageant,
  filterScoringContestants,
  pageantContestantError,
} from "../src/lib/pageant-contestants.ts"

const contestants = [
  { id: "male-one", contestant_number: "1", gender: "Male" },
  { id: "female-one", contestant_number: "1", gender: "Female" },
  { id: "legacy", contestant_number: "2", gender: null },
]
test("limits gender rules to the named CCS pageant, including its existing name variants", () => {
  for (const name of [
    "Mr. and Ms. CCS",
    "Mr. & Ms. CCS",
    "Mr. and Ms. CCS Competition",
  ])
    assert.equal(isCcsPageant(name), true)
  for (const name of [
    "Mr. and Ms. University",
    "Dance Competition",
    "CCS Quiz",
    "",
  ])
    assert.equal(isCcsPageant(name), false)
})
test("allows partners to share numbers but rejects another contestant of the same gender", () => {
  assert.equal(
    pageantContestantError("Mr. and Ms. CCS", "Female", "1", [contestants[0]]),
    "",
  )
  assert.ok(
    pageantContestantError("Mr. and Ms. CCS", "Male", " 1 ", contestants),
  )
  assert.equal(
    pageantContestantError(
      "Mr. and Ms. CCS",
      "Male",
      "1",
      contestants,
      "male-one",
    ),
    "",
  )
  assert.ok(
    pageantContestantError(
      "Mr. and Ms. CCS",
      "Female",
      "1",
      contestants,
      "male-one",
    ),
  )
})
test("requires Male or Female only for pageant contestants", () => {
  for (const gender of ["", "Mr", "Ms", "Other"])
    assert.ok(
      pageantContestantError("Mr. and Ms. CCS", gender, "3", contestants),
    )
  assert.equal(
    pageantContestantError("Dance Competition", "", "1", contestants),
    "",
  )
})
test("Mr and Ms filter individual IDs without modifying contestants or their score state", () => {
  const scores = {
    "male-one": { criterion: 90 },
    "female-one": { criterion: 85 },
  }
  const original = structuredClone(contestants)
  assert.deepEqual(
    filterScoringContestants(contestants, "Mr. and Ms. CCS", "Male").map(
      (c) => c.id,
    ),
    ["male-one"],
  )
  assert.deepEqual(
    filterScoringContestants(contestants, "Mr. and Ms. CCS", "Female").map(
      (c) => c.id,
    ),
    ["female-one"],
  )
  assert.deepEqual(
    filterScoringContestants(contestants, "Mr. and Ms. CCS", "Male").map(
      (c) => scores[(c.id as keyof typeof scores)].criterion,
    ),
    [90],
  )
  assert.deepEqual(contestants, original)
  assert.deepEqual(scores, {
    "male-one": { criterion: 90 },
    "female-one": { criterion: 85 },
  })
  assert.equal(
    filterScoringContestants(contestants, "Dance Competition", "Female"),
    contestants,
  )
})
