import { FormEvent, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

type Contestant = {
  id: string;
  contestant_number: string;
  full_name: string;
  student_id: string | null
  course: string;
  year_level: string | null
  section: string | null
  status: string;
  event_contestants?: { event_id: string; events?: { name: string } }[]
}

type EventItem = { id: string; name: string }

export default function ContestantsManager({ isAdmin }: { isAdmin: boolean }) {
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    contestant_number: "",
    full_name: "",
    student_id: "",
    course: "BS Information Technology",
    year_level: "3rd Year",
    section: "CCS-301",
    event_id: "",
  })

  async function loadData() {
    if (!supabase) return
    setLoading(true)
    // Load events
    const { data: evData } = await supabase
      .from("events")
      .select("id, name")
      .order("name")
    if (evData) {
      setEvents(evData)
      if (!selectedEventId && evData.length > 0) {
        setForm((prev) => ({ ...prev, event_id: evData[0].id }))
      }
    }

    // Load contestants
    const { data: cData } = await supabase
      .from("contestants")
      .select(
        "id, contestant_number, full_name, student_id, course, year_level, section, status, event_contestants(event_id, events(name))",
      )
      .order("contestant_number")

    if (cData) {
      setContestants(cData as unknown as Contestant[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError("")
    if (!supabase) return
    if (!form.contestant_number.trim()) {
      setError("Contestant number is required.")
      return
    }
    if (form.full_name.trim().length < 2) {
      setError("Contestant name must have at least 2 characters.")
      return
    }
    if (!form.event_id) {
      setError("Please select an event for this contestant.")
      return
    }

    const { data: newC, error: cErr } = await supabase
      .from("contestants")
      .insert({
        contestant_number: form.contestant_number.trim(),
        full_name: form.full_name.trim(),
        student_id: form.student_id.trim() || null,
        course: form.course.trim(),
        year_level: form.year_level || null,
        section: form.section.trim() || null,
        status: "registered",
      })
      .select()
      .single()

    if (cErr) {
      setError(cErr.message)
      return
    }

    // Link to event
    const { error: ecErr } = await supabase.from("event_contestants").insert({
      event_id: form.event_id,
      contestant_id: newC.id,
      registration_status: "registered",
    })

    if (ecErr) {
      setError(ecErr.message)
      return
    }

    setShowModal(false)
    setForm({
      contestant_number: "",
      full_name: "",
      student_id: "",
      course: "BS Information Technology",
      year_level: "3rd Year",
      section: "CCS-301",
      event_id: events[0]?.id || "",
    })
    loadData()
  }

  const filtered = selectedEventId
    ? contestants.filter((c) =>
        c.event_contestants?.some((ec) => ec.event_id === selectedEventId),
      )
    : contestants

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            Contestants
          </h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#2a3441] px-4 py-2 text-xs font-bold  text-white hover:bg-[#394658]"
          >
            + Add Contestant
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 bg-[#f8f6ee] p-4 border border-[#17251d]/20">
        <label className="text-xs font-bold  text-[#61726a]">
          Filter by Event:
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="border border-[#17251d]/30 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
        >
          <option value="">All Events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:py-12">
          <div className="w-full max-w-lg border border-[#17251d]/30 bg-[#f8f6ee] p-6 shadow-xl">
            <h2 className="font-sans text-lg font-semibold font-bold">
              Register Contestant
            </h2>
            {error && (
              <p className="mt-3 border-l border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]">
                {error}
              </p>
            )}
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold">
                    Contestant / Team No.
                  </label>
                  <input
                    required
                    value={form.contestant_number}
                    onChange={(e) =>
                      setForm({ ...form, contestant_number: e.target.value })
                    }
                    placeholder="e.g. C-01"
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Event Assignment
                  </label>
                  <select
                    required
                    value={form.event_id}
                    onChange={(e) =>
                      setForm({ ...form, event_id: e.target.value })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold">
                  Full Name / Team Name
                </label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder="e.g. Maria Santos or Team Binary"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold">
                    Student ID
                  </label>
                  <input
                    value={form.student_id}
                    onChange={(e) =>
                      setForm({ ...form, student_id: e.target.value })
                    }
                    placeholder="2024-00123"
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Year Level
                  </label>
                  <select
                    value={form.year_level}
                    onChange={(e) =>
                      setForm({ ...form, year_level: e.target.value })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Section</label>
                  <input
                    value={form.section}
                    onChange={(e) =>
                      setForm({ ...form, section: e.target.value })
                    }
                    placeholder="CCS-301"
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold">
                  Department / Course
                </label>
                <select
                  required
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                >
                  <option value="BS Information Technology">BS Information Technology</option>
                  <option value="BS Computer Science">BS Computer Science</option>
                  <option value="BS Entertainment and Multimedia Computing">BS Entertainment and Multimedia Computing</option>
                </select>
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
                  className="bg-[#2a3441] px-4 py-2 text-xs font-bold text-white hover:bg-[#394658]"
                >
                  Save Contestant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-xs text-[#61726a]">Loading contestants…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-8 border-l border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-sans text-lg font-semibold">
            No contestants found
          </h2>
          <p className="mt-2 text-sm text-[#52655c]">
            {isAdmin
              ? "Click '+ Add Contestant' to register participants."
              : "No registered participants for this event."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#f8f6ee]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Number</th>
                <th className="p-3">Contestant Name</th>
                <th className="p-3">Course / Year</th>
                <th className="p-3">Assigned Event(s)</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-white/50">
                  <td className="p-3 font-mono font-bold text-[#2a3441]">
                    {c.contestant_number}
                  </td>
                  <td className="p-3 font-semibold">
                    {c.full_name}
                    {c.student_id && (
                      <span className="ml-2 font-mono text-xs text-[#61726a]">
                        ({c.student_id})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {c.course} {c.year_level ? `• ${c.year_level}` : ""}{" "}
                    {c.section ? `• ${c.section}` : ""}
                  </td>
                  <td className="p-3 text-xs">
                    {c.event_contestants
                      ?.map((ec) => ec.events?.name)
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="p-3">
                    <span className="inline-block rounded-sm bg-[#dfe5ec] px-2 py-0.5 text-xs font-bold  text-[#2a3441]">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
