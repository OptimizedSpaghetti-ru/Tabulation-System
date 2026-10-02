import { test } from "node:test"
import assert from "node:assert/strict"
import { pageantDefaults, canInitializePageantDefaults } from "../src/lib/pageant-defaults.ts"
test("CCS defaults total 100 and retain the supplied weights", () => {
  for (const name of ["Mr. and Ms. CCS", "Mr. & Ms. CCS", "MR AND MS CCS"]) {
    const rows = pageantDefaults(name)
    assert.equal(rows.length, 8)
    assert.deepEqual(rows.map(row => row.weight_percentage), [7,3,5,10,10,15,25,25])
    assert.equal(rows.reduce((sum,row) => sum + row.weight_percentage,0),100)
    assert.ok(rows.every(row => row.max_score === 100 && row.description.includes("%")))
  }
  assert.deepEqual(pageantDefaults("Quiz Bee"), [])
})
test("defaults return independent editable copies", () => {
  const rows = pageantDefaults("Mr. and Ms. CCS")
  rows[0].weight_percentage = 6
  assert.equal(pageantDefaults("Mr. and Ms. CCS")[0].weight_percentage,7)
})

test("every internal rubric totals 100 percent", () => {
  for (const row of pageantDefaults("Mr. and Ms. CCS")) {
    const percentages = [...row.description.matchAll(/(\d+)%/g)].map(match => Number(match[1]))
    assert.equal(percentages.reduce((sum, weight) => sum + weight, 0), 100, row.name)
  }
  const formal = pageantDefaults("Mr. and Ms. CCS").find(row => row.name === "Formal Attire")!
  assert.equal(92 * formal.weight_percentage / 100, 23)
})

test("empty pageant rubrics initialize throughout pre-scoring setup", () => {
  for (const status of ["draft", "registration_open", "ongoing"]) {
    assert.equal(canInitializePageantDefaults("Mr. and Ms. CCS", status, 0), true, status)
  }
  for (const status of ["scoring", "finalizing", "finalized", "published", "archived"]) {
    assert.equal(canInitializePageantDefaults("Mr. and Ms. CCS", status, 0), false, status)
  }
  assert.equal(canInitializePageantDefaults("Mr. and Ms. CCS", "draft", 1), false)
  assert.equal(canInitializePageantDefaults("Quiz Bee", "draft", 0), false)
})
