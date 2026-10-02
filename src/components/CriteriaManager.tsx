import AnimatedPresence from "./AnimatedPresence"
import { getDefaultEventId } from "../lib/default-event"
import { FormEvent, useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { pageantDefaults, canInitializePageantDefaults } from "../lib/pageant-defaults"

type EventItem = { id: string; name: string; status: string }
type Criterion = {
  id: string;
  event_id: string;
  name: string;
  description: string | null
  weight_percentage: number;
  max_score: number;
  display_order: number;
}

export default function CriteriaManager({
  isAdmin,
  profileId,
}: {
  isAdmin: boolean
  profileId?: string
}) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [criteriaLoading, setCriteriaLoading] = useState(false)
  const criteriaRequest = useRef(0)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [form, setForm] = useState({
    name: "",
    description: "",
    weight_percentage: 20,
    max_score: 100,
    display_order: 1,
  })

  async function loadEvents() {
    if (!supabase) {
      setError("Database connection is unavailable. Configure Supabase to manage criteria.")
      setLoading(false)
      return
    }
    setLoading(true)
    let eventList: EventItem[] = []

    if (isAdmin) {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, status")
        .order("name")
      if (data) eventList = data
      if (error) setError(error.message)
    } else if (profileId) {
      // Load only assigned events for judge
      const { data, error } = await supabase
        .from("judge_event_assignments")
        .select("event_id, events(id, name, status)")
        .eq("judge_id", profileId)
        .eq("status", "active")
      if (data) {
        eventList = data.map((d: any) => d.events).filter(Boolean)
      }
      if (error) setError(error.message)
    }

    setEvents(eventList)
    if (eventList.length > 0) {
      setSelectedEventId(getDefaultEventId(eventList))
    }
    setLoading(false)
  }

  async function loadCriteria(eventId: string, initializeDefaults = false) {
    if (!supabase || !eventId) return
    const request = ++criteriaRequest.current
    setCriteriaLoading(true)
    setCriteria([])
    const { data, error } = await supabase
      .from("criteria")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order")
    if (request !== criteriaRequest.current) return
    if (!error && data) {
      const event = events.find(item => item.id === eventId)
      const defaults = pageantDefaults(event?.name ?? "")
      if (initializeDefaults && profileId && event && canInitializePageantDefaults(event.name, event.status, data.length)) {
        // Insert the complete rubric together. Unique event/order prevents duplicate defaults.
        const { error: seedError } = await supabase.from("criteria").insert(
          defaults.map(row => ({ ...row, event_id: eventId, created_by: profileId })),
        )
        if (seedError && seedError.code !== "23505") setError(`Could not load default rubric: ${seedError.message}`)
        const { data: seeded, error: reloadError } = await supabase.from("criteria").select("*").eq("event_id", eventId).order("display_order")
        if (request !== criteriaRequest.current) return
        setCriteria(seeded ?? [])
        if (reloadError) setError(reloadError.message)
      } else setCriteria(data)
    }
    if (error) setError(error.message)
    setCriteriaLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [profileId, isAdmin])

  useEffect(() => {
    if (selectedEventId) {
      loadCriteria(selectedEventId, true)
      setError("")
      setSuccess("")
    }
  }, [selectedEventId, events, profileId])

  const totalWeight = Math.round(criteria.reduce(
    (sum, c) => sum + Number(c.weight_percentage),
    0,
  ) * 100) / 100
  const weightBudget = 100 - totalWeight + Number(criteria.find(c => c.id === editingId)?.weight_percentage ?? 0)

  async function handleAddCriterion(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setError("")
    setSuccess("")
    if (!supabase || !selectedEventId || !profileId) {
      setError("Select a competition and sign in before saving a criterion.")
      return
    }

    const weight = Number(form.weight_percentage)
    const maxScore = Number(form.max_score)
    const order = Number(form.display_order)

    if (weight <= 0 || weight > 100) {
      setError("Weight percentage must be between 1% and 100%.")
      return
    }
    if (weight > weightBudget) {
      setError(
        `Weight exceeds the available ${weightBudget}%. Reduce another criterion first.`,
      )
      return
    }
    if (maxScore <= 0) {
      setError("Maximum score must be greater than 0.")
      return
    }

    setSaving(true)
    const values = {
      event_id: selectedEventId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      weight_percentage: weight,
      max_score: maxScore,
      display_order: order,
    }
    const { error: insErr } = editingId
      ? await supabase.from("criteria").update(values).eq("id", editingId).eq("event_id", selectedEventId)
      : await supabase.from("criteria").insert({ ...values, created_by: profileId })
    setSaving(false)

    if (insErr) {
      setError(insErr.message)
      return
    }

    setShowModal(false)
    setForm({
      name: "",
      description: "",
      weight_percentage: 20,
      max_score: 100,
      display_order: criteria.length + 2,
    })
    setSuccess(editingId ? "Criterion updated successfully." : "Criterion added successfully.")
    setEditingId(null)
    loadCriteria(selectedEventId)
  }

  async function handleDelete(id: string) {
    if (!supabase) return
    setError("")
    const { error: delErr } = await supabase
      .from("criteria")
      .delete()
      .eq("id", id)
    if (delErr) setError(delErr.message)
    else {
      setSuccess("Criterion deleted.")
      loadCriteria(selectedEventId)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            Scoring Criteria
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setError("")
                setSuccess("")
                if (!selectedEventId) {
                  setError(isAdmin
                    ? "Create a competition in Competition, then select it here to add criteria."
                    : "You need an assigned competition before adding criteria. Ask an administrator to assign one.")
                  return
                }
                if (totalWeight >= 100) {
                  setError("Criteria already total 100%. Edit or delete a criterion to free up weight before adding another.")
                  return
                }
                setEditingId(null)
                setForm((prev) => ({
                  ...prev,
                  weight_percentage: Math.min(20, 100 - totalWeight),
                  display_order: Math.max(0, ...criteria.map(c => c.display_order)) + 1,
                }))
                setShowModal(true)
              }}
              disabled={loading || criteriaLoading || saving}
              className="border border-[#2a3441] bg-[#2a3441] px-4 py-2 text-xs font-bold  text-white hover:bg-[#394658] disabled:opacity-50"
            >
              + Add Criterion
            </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 border-l border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 border-l border-[#2a3441] bg-[#dfe5ec] p-2 text-xs text-[#2a3441]">
          {success}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-[#ffffff] p-4 border border-[#17251d]/20">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold  text-[#61726a]">
            Assigned Competition:
          </label>
          <select
            value={selectedEventId}
            disabled={saving}
            onChange={(e) => {
              criteriaRequest.current += 1
              setCriteria([])
              setCriteriaLoading(true)
              setShowModal(false)
              setEditingId(null)
              setSelectedEventId(e.target.value)
            }}
            className="border border-[#17251d]/30 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.status})
              </option>
            ))}
            {events.length === 0 && (
              <option value="">No competitions available</option>
            )}
          </select>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span>
            Total Weight:{" "}
            <b
              className={
                totalWeight === 100 ? "text-[#2a3441]" : "text-[#a23b30]"
              }
            >
              {totalWeight}%
            </b>{" "}
            / 100%
          </span>

        </div>
      </div>

      <AnimatedPresence kind="modal">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:py-12">
          <div className="w-full max-w-lg border border-[#17251d]/30 bg-[#ffffff] p-6 shadow-xl">
            <h2 className="font-sans text-lg font-semibold font-bold">
              {editingId ? "Edit Criterion" : "Add Criterion"}
            </h2>
            <p className="mt-1 text-xs text-[#61726a]">
              Remaining weight budget: {weightBudget}%
            </p>
            <form onSubmit={handleAddCriterion} className="mt-4 space-y-4">
              {error && <p role="alert" className="bg-[#f3e2dc] p-2 text-xs text-[#70271f]">{error}</p>}
              <div>
                <label className="block text-xs font-semibold">
                  Criterion Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Code Quality & Correctness"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold">
                  Description / Guidelines
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Points to evaluate"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold">
                    Weight (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={weightBudget}
                    step="0.01"
                    required
                    value={form.weight_percentage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weight_percentage: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Max Score
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={form.max_score}
                    onChange={(e) =>
                      setForm({ ...form, max_score: Number(e.target.value) })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">Order</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.display_order}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        display_order: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-[#17251d]/30 px-3 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#2a3441] px-4 py-2 text-xs font-bold text-white hover:bg-[#394658]"
                >
                  {saving ? "Saving?" : "Save Criterion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </AnimatedPresence>

      {loading || criteriaLoading ? (
        <p className="mt-8 text-xs text-[#61726a]">Loading criteria…</p>
      ) : criteria.length === 0 ? (
        <div className="mt-8 border-l border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-sans text-lg font-semibold">
            No criteria configured yet
          </h2>
          <p className="mt-2 text-sm text-[#52655c]">
            {pageantDefaults(events.find(event => event.id === selectedEventId)?.name ?? "").length > 0
              ? "The default Mr. & Ms. CCS rubric has not been saved. Check any error above, then retry loading it."
              : "Click '+ Add Criterion' to specify the judging breakdown. Remember that the sum of percentage weights must equal exactly 100% before scoring can commence."}
          </p>
          {events.some(event => event.id === selectedEventId && canInitializePageantDefaults(event.name, event.status, 0)) && (
            <button
              onClick={() => { setError(""); loadCriteria(selectedEventId, true) }}
              className="mt-4 border border-[#2a3441] bg-[#2a3441] px-4 py-2 text-xs font-bold text-white"
            >Load Default Rubric</button>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#ffffff]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Criterion</th>
                <th className="p-3">Weight (%)</th>
                <th className="p-3">Max Points</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {criteria.map((c) => (
                <tr key={c.id} className="hover:bg-white/50">
                  <td className="p-3 font-mono text-xs">{c.display_order}</td>
                  <td className="p-3 font-semibold">
                    {c.name}
                    {c.description && (
                      <p className="mt-1 whitespace-pre-line text-xs font-normal text-[#61726a]">
                        {c.description}
                      </p>
                    )}
                  </td>
                  <td className="p-3 font-mono font-bold text-[#2a3441]">
                    {c.weight_percentage}%
                  </td>
                  <td className="p-3 font-mono text-xs">{c.max_score}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingId(c.id)
                          setForm({ name: c.name, description: c.description ?? "", weight_percentage: Number(c.weight_percentage), max_score: Number(c.max_score), display_order: c.display_order })
                          setError("")
                          setShowModal(true)
                        }}
                        className="mr-2 border border-[#17251d]/30 px-2 py-1 text-xs hover:bg-[#e8edf2]"
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="border border-[#a23b30]/40 px-2 py-1 text-xs text-[#a23b30] hover:bg-[#f3e2dc]"
                      >
                        Delete
                      </button>
                    </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-[#17251d]/20 bg-[#e8edf2] font-mono text-xs font-bold">
              <tr>
                <td colSpan={2} className="p-3 uppercase">
                  Total Weight
                </td>
                <td
                  className={`p-3 ${
                    totalWeight === 100 ? "text-[#2a3441]" : "text-[#a23b30]"
                  }`}
                >
                  {totalWeight}%
                </td>
                <td
                  colSpan={2}
                  className="p-3 text-right font-normal text-[#61726a]"
                >
                  {totalWeight === 100
                    ? "Weight target reached (100%)"
                    : `Need ${100 - totalWeight}% more before scoring can begin.`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
