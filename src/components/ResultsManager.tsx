import { getDefaultEventId } from "../lib/default-event"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

type EventItem = { id: string; name: string; status: string }
type ResultItem = {
  id: string;
  event_id: string;
  contestant_id: string;
  final_score: number;
  rank: number;
  status: string;
  contestants?: { contestant_number: string; full_name: string; course: string }
}

type WinnerItem = {
  id: string;
  placement: number;
  title: string;
  final_score: number;
  contestants?: { full_name: string }
}

export default function ResultsManager({
  isAdmin,
  viewMode = "tabulation",
}: {
  isAdmin: boolean
  viewMode?: "tabulation" | "rankings" | "winners" | "results"
}) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [results, setResults] = useState<ResultItem[]>([])
  const [winners, setWinners] = useState<WinnerItem[]>([])
  const [sheetsCount, setSheetsCount] = useState<{
    submitted: number
    total: number
  }>({ submitted: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function loadEvents() {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from("events")
      .select("id, name, status")
      .order("name")
    if (data && data.length > 0) {
      setEvents(data)
      if (!selectedEventId) setSelectedEventId(getDefaultEventId(data))
    }
    setLoading(false)
  }

  async function loadResults(eventId: string) {
    if (!supabase || !eventId) return
    setLoading(true)
    setError("")
    setSuccess("")

    // Load results
    const { data: resData } = await supabase
      .from("results")
      .select(
        "id, event_id, contestant_id, final_score, rank, status, contestants(contestant_number, full_name, course)",
      )
      .eq("event_id", eventId)
      .order("rank", { ascending: true })
    setResults(resData as unknown as ResultItem[] || [])

    // Load winners
    const { data: winData } = await supabase
      .from("winners")
      .select("id, placement, title, final_score, contestants(full_name)")
      .eq("event_id", eventId)
      .order("placement")
    setWinners(winData as unknown as WinnerItem[] || [])

    // Load judge submission status
    const { data: assignData } = await supabase
      .from("judge_event_assignments")
      .select("judge_id")
      .eq("event_id", eventId)
      .eq("status", "active")

    const { data: subData } = await supabase
      .from("score_sheets")
      .select("judge_id")
      .eq("event_id", eventId)
      .eq("status", "submitted")

    setSheetsCount({
      total: assignData?.length || 0,
      submitted: subData?.length || 0,
    })

    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      loadResults(selectedEventId)
    }
  }, [selectedEventId])

  async function handleRecalculate() {
    if (!supabase || !selectedEventId) return
    setError("")
    setSuccess("")
    const { error: rpcErr } = await supabase.rpc("refresh_event_results", {
      event_uuid: selectedEventId,
    })
    if (rpcErr) setError(rpcErr.message)
    else {
      setSuccess("Tabulation recalculated successfully.")
      loadResults(selectedEventId)
    }
  }

  async function handleFinalizeAndPublish() {
    if (!supabase || !selectedEventId || !isAdmin) return
    setError("")
    setSuccess("")
    const { error: rpcErr } = await supabase.rpc("finalize_and_publish_event", {
      event_uuid: selectedEventId,
    })
    if (rpcErr) setError(rpcErr.message)
    else {
      setSuccess(
        "Official results finalized and published! Verdicts are now public.",
      )
      loadResults(selectedEventId)
      loadEvents()
    }
  }

  async function handleReopen() {
    if (!supabase || !selectedEventId || !isAdmin) return
    setError("")
    setSuccess("")
    const { error: rpcErr } = await supabase.rpc("reopen_event_scoring", {
      event_uuid: selectedEventId,
    })
    if (rpcErr) setError(rpcErr.message)
    else {
      setSuccess("Competition scoring has been reopened for judges.")
      loadResults(selectedEventId)
      loadEvents()
    }
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            {viewMode === "winners"
              ? "Official Winners"
              : viewMode === "rankings"
                ? "Competition Rankings"
                : "Official Tabulation & Results"}
          </h1>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRecalculate}
              className="border border-[#17251d]/30 bg-white px-3 py-2 text-xs font-bold  text-[#2a3441] hover:bg-[#e8edf2]"
            >
              Recalculate
            </button>
            {selectedEvent?.status !== "published" ? (
              <button
                onClick={handleFinalizeAndPublish}
                disabled={results.length === 0}
                className="bg-[#2a3441] px-4 py-2 text-xs font-bold  text-white hover:bg-[#394658] disabled:opacity-50"
              >
                Finalize & Publish Verdicts
              </button>
            ) : (
              <button
                onClick={handleReopen}
                className="border border-[#a23b30] bg-[#a23b30] px-4 py-2 text-xs font-bold  text-white hover:bg-[#852f26]"
              >
                Reopen Scoring
              </button>
            )}
          </div>
        )}
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
            Select Competition:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="border border-[#17251d]/30 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.status})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs">
          <span>
            Judges Submitted:{" "}
            <b className="text-[#2a3441]">
              {sheetsCount.submitted} / {sheetsCount.total}
            </b>
          </span>
          <span
            className={`rounded px-2 py-0.5 font-bold  ${
              selectedEvent?.status === "published"
                ? "bg-[#2a3441] text-white"
                : "bg-[#dfe5ec] text-[#2a3441]"
            }`}
          >
            {selectedEvent?.status === "published"
              ? "Published Official Verdict"
              : "Provisional Tabulation"}
          </span>
        </div>
      </div>

      {winners.length > 0 && (
        <div className="mt-6 border border-[#17251d]/20 bg-[#e8edf2] p-6">
          <p className="text-xs font-bold  text-[#61726a]">Winner's Podium</p>
          <div className="mt-4 grid max-w-lg gap-4">
            {winners.map((w) => (
              <div
                key={w.id}
                className={`border p-4 ${
                  w.placement === 1
                    ? "border-[#2a3441] bg-white shadow-md"
                    : "border-[#17251d]/20 bg-white/70"
                }`}
              >
                <span className="font-mono text-xs font-semibold text-[#2a3441]">
                  {w.title}
                </span>
                <p className="mt-2 font-sans text-xl font-bold">
                  {w.contestants?.full_name}
                </p>
                <p className="mt-1 font-mono text-sm text-[#61726a]">
                  Score: {Number(w.final_score).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-xs text-[#61726a]">Loading tabulation…</p>
      ) : results.length === 0 ? (
        <div className="mt-8 border-l border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-sans text-lg font-semibold">
            No Submitted Scores Yet
          </h2>
          <p className="mt-2 text-sm text-[#52655c]">
            Once assigned judges complete and submit their score sheets, the
            database scoring engine will calculate and rank the official
            averages here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#ffffff]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Contestant No.</th>
                <th className="p-3">Name / Team</th>
                <th className="p-3">Department / Course</th>
                <th className="p-3 text-right">Official Final Score</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-white/50">
                  <td className="p-3">
                    <span
                      className={`inline-grid size-7 place-items-center font-sans text-sm font-bold ${
                        r.rank === 1
                          ? "bg-[#2a3441] text-white"
                          : r.rank === 2
                            ? "bg-[#61726a] text-white"
                            : r.rank === 3
                              ? "bg-[#475569] text-white"
                              : "text-[#17251d]"
                      }`}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-[#2a3441]">
                    {r.contestants?.contestant_number}
                  </td>
                  <td className="p-3 font-semibold">
                    {r.contestants?.full_name}
                  </td>
                  <td className="p-3 text-xs">{r.contestants?.course}</td>
                  <td className="p-3 text-right font-mono text-base font-bold text-[#2a3441]">
                    {Number(r.final_score).toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-xs uppercase text-[#61726a]">
                    {r.status}
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
