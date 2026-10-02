import { FormEvent, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

type Competition = { id: string; name: string }
type EventItem = {
  id: string;
  competition_id: string;
  name: string;
  description: string | null
  event_type: string;
  participation_type: string;
  status: string;
  competitions?: { name: string }
}

const OFFICIAL_EVENTS = [
  {
    name: "Quiz Bee",
    event_type: "knowledge",
    participation_type: "individual",
  },
  {
    name: "Programming Competition",
    event_type: "technical",
    participation_type: "team",
  },
  {
    name: "Linux Competition",
    event_type: "technical",
    participation_type: "team",
  },
  {
    name: "PC Assembly and Disassembly",
    event_type: "technical",
    participation_type: "team",
  },
  {
    name: "Dance Competition",
    event_type: "performance",
    participation_type: "team",
  },
  {
    name: "Pageant",
    event_type: "performance",
    participation_type: "individual",
  },
]

export default function EventsManager({
  isAdmin,
  profileId,
  onNavigate,
}: {
  isAdmin: boolean
  profileId?: string
  onNavigate?: (page: string) => void
}) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompId, setSelectedCompId] = useState<string>("")
  const [assignedEventIds, setAssignedEventIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [infoMsg, setInfoMsg] = useState("")
  const [form, setForm] = useState({
    name: "",
    description: "",
    event_type: "technical",
    participation_type: "individual",
    status: "draft",
  })

  async function loadData() {
    if (!supabase) {
      setError("Database connection is unavailable. Configure Supabase to manage events.")
      setLoading(false)
      return
    }
    setLoading(true)
    try {
    // Load competitions
    const { data: compData, error: compError } = await supabase
      .from("competitions")
      .select("id, name")
      .order("created_at", { ascending: false })
    if (compError) setError(`Could not load competitions: ${compError.message}`)
    if (compData) {
      setCompetitions(compData)
      if (!compData.some((competition) => competition.id === selectedCompId)) {
        setSelectedCompId(compData[0]?.id || "")
      }
    }

    // Load events
    let query = supabase
      .from("events")
      .select(
        "id, competition_id, name, description, event_type, participation_type, status, competitions(name)",
      )
      .order("name")
    const { data: eventData, error: eventError } = await query
    if (eventError) setError(`Could not load events: ${eventError.message}`)
    if (eventData) {
      setEvents(eventData as unknown as EventItem[])
    }

    // Load judge assignments
    if (profileId) {
      const { data: assignData } = await supabase
        .from("judge_event_assignments")
        .select("event_id")
        .eq("judge_id", profileId)
        .eq("status", "active")
      if (assignData) {
        setAssignedEventIds(assignData.map((a) => a.event_id))
      }
    }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load events. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [profileId])

  const filteredEvents = selectedCompId
    ? events.filter((e) => e.competition_id === selectedCompId)
    : events

  async function handleSeedOfficial() {
    if (!supabase || !selectedCompId || !isAdmin) return
    setError("")
    setInfoMsg("")
    try {
      const inserts = OFFICIAL_EVENTS.map((oe) => ({
        competition_id: selectedCompId,
        name: oe.name,
        event_type: oe.event_type,
        participation_type: oe.participation_type,
        status: "draft",
        created_by: profileId || null,
      }))

      const { error: seedErr } = await supabase
        .from("events")
        .upsert(inserts, { onConflict: "competition_id,name" })
      if (seedErr) {
        setError(seedErr.message)
      } else {
        setInfoMsg("Successfully seeded the 6 official CCS events!")
        loadData()
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError("")
    setInfoMsg("")
    if (saving) return
    if (!supabase) {
      setError("Database connection is unavailable. Configure Supabase before creating an event.")
      return
    }
    if (!selectedCompId) {
      setError("Create or select a competition before creating an event.")
      return
    }
    if (!isAdmin || !profileId) {
      setError("Sign in as an administrator to create an event.")
      return
    }
    if (form.name.trim().length < 2) {
      setError("Event name must be at least 2 characters.")
      return
    }

    setSaving(true)
    try {
    const { error: insertError } = await supabase.from("events").insert({
      competition_id: selectedCompId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type,
      participation_type: form.participation_type,
      status: form.status,
      created_by: profileId || null,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setShowModal(false)
    setForm({
      name: "",
      description: "",
      event_type: "technical",
      participation_type: "individual",
      status: "draft",
    })
    setInfoMsg("Event created successfully.")
    await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the event. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    if (!supabase || !isAdmin) return
    const { error } = await supabase
      .from("events")
      .update({ status: newStatus })
      .eq("id", id)
    if (!error) loadData()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            Competition Events
          </h1>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSeedOfficial}
              disabled={!selectedCompId}
              className="border border-[#17251d]/30 bg-white px-3 py-2 text-xs font-bold  text-[#2a3441] hover:bg-[#e8edf2] disabled:opacity-50"
              title="Populates the 6 official OLFU CCS events (Quiz Bee, Programming, Linux, PC Assembly, Dance, Pageant)"
            >
              Seed Official 6 Events
            </button>
            <button
              onClick={() => {
                setError("")
                setInfoMsg("")
                setShowModal(true)
              }}
              className="bg-[#2a3441] px-4 py-2 text-xs font-bold  text-white hover:bg-[#394658] disabled:opacity-50"
            >
              + Add Event
            </button>
          </div>
        )}
      </div>

      {infoMsg && (
        <p className="mt-3 border-l border-[#2a3441] bg-[#dfe5ec] p-2 text-xs text-[#2a3441]">
          {infoMsg}
        </p>
      )}
      {error && (
        <p className="mt-3 border-l border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 bg-[#f8f6ee] p-4 border border-[#17251d]/20">
        <label className="text-xs font-bold  text-[#61726a]">
          Active Competition:
        </label>
        <select
          value={selectedCompId}
          onChange={(e) => setSelectedCompId(e.target.value)}
          className="border border-[#17251d]/30 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
        >
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {competitions.length === 0 && (
            <option value="">No competitions found</option>
          )}
        </select>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 sm:py-12">
          <div className="w-full max-w-lg border border-[#17251d]/30 bg-[#f8f6ee] p-6 shadow-xl">
            <h2 className="font-sans text-lg font-semibold font-bold">
              Add Event
            </h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {error && (
                <p role="alert" className="bg-[#f3e2dc] p-2 text-xs text-[#70271f]">{error}</p>
              )}
              <div>
                <label htmlFor="event-competition" className="block text-xs font-semibold">Competition</label>
                <select
                  id="event-competition"
                  required
                  value={selectedCompId}
                  onChange={(e) => setSelectedCompId(e.target.value)}
                  disabled={loading || saving}
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                >
                  <option value="">{loading ? "Loading competitions…" : "Select a competition"}</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>{competition.name}</option>
                  ))}
                </select>
                {!loading && competitions.length === 0 && (
                  <div className="mt-2 text-sm text-[#52655c]">
                    <p>Create a competition first. Each event must belong to a competition.</p>
                    {onNavigate && <button type="button" onClick={() => onNavigate("competitions")} className="mt-2 underline underline-offset-4">Go to Competitions</button>}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold">
                  Event Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Programming Competition"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Rules or scope of this event"
                  className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm outline-none"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold">
                    Event Type
                  </label>
                  <select
                    value={form.event_type}
                    onChange={(e) =>
                      setForm({ ...form, event_type: e.target.value })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                  >
                    <option value="knowledge">Knowledge</option>
                    <option value="technical">Technical</option>
                    <option value="performance">Performance</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Participation
                  </label>
                  <select
                    value={form.participation_type}
                    onChange={(e) =>
                      setForm({ ...form, participation_type: e.target.value })
                    }
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                  >
                    <option value="individual">Individual</option>
                    <option value="team">Team</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                  className="border border-[#17251d]/30 px-3 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loading || !selectedCompId}
                  className="bg-[#2a3441] px-4 py-2 text-xs font-bold text-white hover:bg-[#394658]"
                >
                  {saving ? "Creating Event…" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-xs text-[#61726a]">Loading events…</p>
      ) : filteredEvents.length === 0 ? (
        <div className="mt-8 border-l border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-sans text-lg font-semibold">No events found</h2>
          <p className="mt-2 text-sm text-[#52655c]">
            {isAdmin
              ? "Click 'Seed Official 6 Events' to automatically load the department competitions, or click '+ Add Event' to create a custom one."
              : "No events are assigned to your profile yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#f8f6ee]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Event Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Format</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {filteredEvents.map((ev) => {
                const isAssigned = assignedEventIds.includes(ev.id)
                return (
                  <tr key={ev.id} className="hover:bg-white/50">
                    <td className="p-3 font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{ev.name}</span>
                        {isAssigned && (
                          <span className="rounded bg-[#2a3441] px-1.5 py-0.5 text-xs font-bold  text-white">
                            Your Event
                          </span>
                        )}
                      </div>
                      {ev.description && (
                        <p className="text-xs font-normal text-[#61726a]">
                          {ev.description}
                        </p>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs capitalize">
                      {ev.event_type}
                    </td>
                    <td className="p-3 font-mono text-xs capitalize">
                      {ev.participation_type}
                    </td>
                    <td className="p-3">
                      <span className="inline-block rounded-sm bg-[#dfe5ec] px-2 py-0.5 text-xs font-bold  text-[#2a3441]">
                        {ev.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(isAdmin || isAssigned) && onNavigate && (
                          <>
                            <button
                              onClick={() => onNavigate("criteria")}
                              className="border border-[#17251d]/30 bg-white px-2 py-1 text-xs font-bold hover:bg-[#e8edf2]"
                            >
                              Criteria
                            </button>
                            <button
                              onClick={() => onNavigate("scores")}
                              className="bg-[#2a3441] px-2 py-1 text-xs font-bold text-white hover:bg-[#394658]"
                            >
                              Scoring
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <select
                            value={ev.status}
                            onChange={(e) =>
                              updateStatus(ev.id, e.target.value)
                            }
                            className="border border-[#17251d]/30 bg-white px-2 py-1 text-xs"
                          >
                            <option value="draft">Draft</option>
                            <option value="registration_open">
                              Registration Open
                            </option>
                            <option value="ongoing">Ongoing</option>
                            <option value="scoring">Scoring</option>
                            <option value="finalized">Finalized</option>
                            <option value="published">Published</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
