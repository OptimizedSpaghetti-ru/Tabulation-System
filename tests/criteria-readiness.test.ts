import { test } from "node:test"
import assert from "node:assert/strict"
import { criteriaReadyForScoring } from "../src/lib/criteria-readiness.ts"

test("scoring requires a complete 100 percent rubric without a lock flag", () => {
  assert.equal(criteriaReadyForScoring([]), false)
  assert.equal(criteriaReadyForScoring([{ weight_percentage: 40 }]), false)
  assert.equal(criteriaReadyForScoring([{ weight_percentage: 60 }, { weight_percentage: 40 }]), true)
  assert.equal(criteriaReadyForScoring([{ weight_percentage: 60 }, { weight_percentage: 41 }]), false)
  assert.equal(criteriaReadyForScoring([{ weight_percentage: "33.33" }, { weight_percentage: "66.67" }]), true)
})
