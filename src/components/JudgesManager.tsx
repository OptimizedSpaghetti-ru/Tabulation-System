import { getDefaultEventId } from "../lib/default-event"
import { FormEvent, useEffect, useState } from "react"
import { authEmailToUsername, isValidUsername, supabase } from "../lib/supabase"

type Profile = {
  id: string
  full_name: string
  email: string
  judge_id: string | null
  contact_number: string | null
  role: string
  status: string
}

type EventItem = {
  id: string
  name: string
}
type Assignment = {
  id: string
  judge_id: string
  event_id: string
  profiles?: {
    full_name: string
    email: string
  }
  events?: { name: string }
}

export default function JudgesManager({
  isAdmin,
  isAssignMode,
}: {
  isAdmin: boolean
  isAssignMode?: boolean
}) {
  const [judges, setJudges] = useState<Profile[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [selectedJudgeId, setSelectedJudgeId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [showAddJudge, setShowAddJudge] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [creatingJudge, setCreatingJudge] = useState(false)
  const [createError, setCreateError] = useState("")

  async function handleAddJudge(e: FormEvent) {
    e.preventDefault()
    if (creatingJudge || !isAdmin) return
    setCreateError("")
    setSuccess("")
    const cleanUsername = username.trim().toLowerCase()
    if (!isValidUsername(cleanUsername)) {
      setCreateError(
        "Username must be 3–30 characters using letters, numbers, underscores, dots, or hyphens.",
      )
      return
    }
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
    ) {
      setCreateError(
        "Password needs 8+ characters with uppercase, lowercase, number, and special character.",
      )
      return
    }
    if (!supabase) {
      setCreateError("Account creation is unavailable. Please try again later.")
      return
    }
    setCreatingJudge(true)
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "create-judge",
        {
          body: { username: cleanUsername, password },
        },
      )
      if (functionError) {
        let message = "Could not add the judge. Please try again."
        if (functionError.context instanceof Response) {
          const details = await functionError.context.json().catch(() => null)
          if (typeof details?.error === "string") message = details.error
        }
        throw new Error(message)
      }
      if (!data?.username)
        throw new Error(
          "Could not confirm account creation. Please refresh the directory before retrying.",
        )
      setPassword("")
      setUsername("")
      setShowPassword(false)
      setShowAddJudge(false)
      setSuccess(
        `Judge @${data.username} added. They can now sign in with the username and password you provided.`,
      )
      await loadData()
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Could not add the judge. Please try again.",
      )
    } finally {
      setCreatingJudge(false)
    }
  }

  async function loadData() {
    if (!supabase) return
    setLoading(true)
    // Load judges
    const { data: jData, error: judgesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, judge_id, contact_number, role, status")
      .eq("role", "judge")
      .order("full_name")
    if (judgesError)
      setError("Could not refresh the directory. Please reload the page.")
    if (jData) setJudges(jData)

    // Load events
    const { data: evData } = await supabase
      .from("events")
      .select("id, name")
      .order("name")
    if (evData) {
      setEvents(evData)
      if (!selectedEventId && evData.length > 0)
        setSelectedEventId(getDefaultEventId(evData))
    }

    // Load assignments
    const { data: aData } = await supabase
      .from("judge_event_assignments")
      .select(
        "id, judge_id, event_id, profiles(full_name, email), events(name)",
      )
      .order("assigned_at", { ascending: false })
    if (aData) setAssignments(aData as unknown as Assignment[])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleStatusChange(profileId: string, newStatus: string) {
    if (!supabase || !isAdmin) return
    setError("")
    const { error: err } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("role", "judge")
      .eq("id", profileId)
    if (err) setError(err.message)
    else loadData()
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (!supabase || !isAdmin || !selectedEventId || !judges.some((judge) => judge.id === selectedJudgeId && judge.role === "judge" && judge.status === "active")) {
      setError("Select both an event and an active judge.")
      return
    }

    const { error: insErr } = await supabase
      .from("judge_event_assignments")
      .insert({
        judge_id: selectedJudgeId,
        event_id: selectedEventId,
        status: "active",
      })

    if (insErr) {
      setError(insErr.message)
    } else {
      setSuccess("Judge successfully assigned to event.")
      loadData()
    }
  }

  async function handleUnassign(assignmentId: string) {
    if (!supabase || !isAdmin) return
    setError("")
    const { error: delErr } = await supabase
      .from("judge_event_assignments")
      .delete()
      .eq("id", assignmentId)
    if (delErr) setError(delErr.message)
    else loadData()
  }

  const activeJudges = judges.filter(
    (j) => j.status === "active" && j.role === "judge",
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            {isAssignMode ? "Assign Judges to Competitions" : "Judge Directory"}
          </h1>
        </div>
        {isAdmin && !isAssignMode && (
          <button
            type="button"
            onClick={() => {
              setShowAddJudge(true)
              setCreateError("")
              setSuccess("")
            }}
            aria-expanded={showAddJudge}
            aria-controls="add-judge-form"
            disabled={showAddJudge}
            className="bg-[#2a3441] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#394658] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:opacity-50"
          >
            Add Judge
          </button>
        )}
      </div>

      {isAdmin && !isAssignMode && showAddJudge && (
        <section
          id="add-judge-form"
          aria-labelledby="add-judge-heading"
          className="mt-6 border border-[#17251d]/20 bg-[#ffffff] p-5"
        >
          <h2 id="add-judge-heading" className="text-lg font-semibold">
            Add Judge
          </h2>
          <p className="mt-1 text-sm text-[#61726a]">
            Create an active judge account. Share these credentials with the
            judge so they can sign in.
          </p>
          <form
            onSubmit={handleAddJudge}
            className="mt-4 grid max-w-lg gap-4"
            aria-busy={creatingJudge}
          >
            <div>
              <label
                htmlFor="judge-username"
                className="block text-sm font-semibold"
              >
                Username
              </label>
              <input
                id="judge-username"
                autoFocus
                required
                minLength={3}
                maxLength={30}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={creatingJudge}
                aria-describedby="judge-username-help"
                className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-[#2a3441] disabled:opacity-50"
              />
              <p
                id="judge-username-help"
                className="mt-1 text-xs text-[#61726a]"
              >
                3–30 characters: letters, numbers, underscores, dots, or
                hyphens.
              </p>
            </div>
            <div>
              <label
                htmlFor="judge-password"
                className="block text-sm font-semibold"
              >
                Password
              </label>
              <div className="mt-1 flex border border-[#17251d]/30 bg-white focus-within:outline-2 focus-within:outline-[#2a3441]">
                <input
                  id="judge-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={creatingJudge}
                  aria-describedby="judge-password-help"
                  className="min-w-0 flex-1 bg-transparent p-2 text-sm outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={creatingJudge}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="px-3 text-xs font-semibold text-[#2a3441] hover:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-[#2a3441]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p
                id="judge-password-help"
                className="mt-1 text-xs text-[#61726a]"
              >
                8+ characters with uppercase, lowercase, number, and special
                character.
              </p>
            </div>
            {createError && (
              <p
                role="alert"
                className="bg-[#f3e2dc] p-3 text-sm text-[#70271f]"
              >
                {createError}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={creatingJudge}
                className="bg-[#2a3441] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#394658] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:opacity-50"
              >
                {creatingJudge ? "Adding Judge…" : "Add Judge"}
              </button>
              <button
                type="button"
                disabled={creatingJudge}
                onClick={() => {
                  setShowAddJudge(false)
                  setUsername("")
                  setPassword("")
                  setShowPassword(false)
                  setCreateError("")
                }}
                className="border border-[#17251d]/30 px-4 py-2.5 text-sm font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 border-l border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mt-3 border-l border-[#2a3441] bg-[#dfe5ec] p-2 text-xs text-[#2a3441]"
        >
          {success}
        </p>
      )}

      {isAssignMode ? (
        <div className="mt-6 space-y-6">
          {isAdmin && (
            <div className="border border-[#17251d]/20 bg-[#ffffff] p-5">

              <form
                onSubmit={handleAssign}
                className="mt-4 grid max-w-lg gap-4"
              >
                <div>
                  <label className="block text-xs font-semibold">
                    Select Event
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">
                    Select Active Judge
                  </label>
                  <select
                    value={selectedJudgeId}
                    onChange={(e) => setSelectedJudgeId(e.target.value)}
                    className="mt-1 w-full border border-[#17251d]/30 bg-white p-2 text-sm"
                  >
                    <option value="">-- Choose Judge --</option>
                    {activeJudges.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.full_name} (@{authEmailToUsername(j.email)}){" "}
                        {j.judge_id ? `[${j.judge_id}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-[#2a3441] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#394658]"
                  >
                    Assign to Event
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto border border-[#17251d]/20 bg-[#ffffff]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
                <tr>
                  <th className="p-3">Event</th>
                  <th className="p-3">Assigned Judge</th>
                  <th className="p-3">Username</th>
                  {isAdmin && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17251d]/10">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-white/50">
                    <td className="p-3 font-semibold">{a.events?.name}</td>
                    <td className="p-3">{a.profiles?.full_name}</td>
                    <td className="p-3 font-mono text-xs text-[#61726a]">
                      @{authEmailToUsername(a.profiles?.email)}
                    </td>
                    {isAdmin && (
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleUnassign(a.id)}
                          className="border border-[#a23b30]/40 px-2 py-1 text-xs text-[#a23b30] hover:bg-[#f3e2dc]"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-xs text-[#61726a]"
                    >
                      No judge assignments registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#ffffff]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Judge Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                {isAdmin && <th className="p-3 text-right">Status Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {judges.map((j) => (
                <tr key={j.id} className="hover:bg-white/50">
                  <td className="p-3 font-semibold">{j.full_name}</td>
                  <td className="p-3 font-mono text-xs">
                    @{authEmailToUsername(j.email)}
                  </td>
                  <td className="p-3 font-mono text-xs capitalize">{j.role}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-sm px-2 py-0.5 text-xs font-bold  ${
                        j.status === "active"
                          ? "bg-[#dfe5ec] text-[#2a3441]"
                          : j.status === "pending"
                            ? "bg-[#f1f5f9] text-[#475569]"
                            : "bg-[#f3e2dc] text-[#a23b30]"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <select
                        value={j.status}
                        onChange={(e) =>
                          handleStatusChange(j.id, e.target.value)
                        }
                        className="border border-[#17251d]/30 bg-white px-2 py-1 text-xs"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active (Approved)</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
              {judges.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="p-6 text-center text-xs text-[#61726a]"
                  >
                    No accounts found in directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
