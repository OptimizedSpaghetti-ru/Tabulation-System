import { getDefaultEventId } from "../lib/default-event"
import { useEffect, useState } from "react"

import { supabase } from "../lib/supabase"

import ContestantPhoto from "./ContestantPhoto"

type EventItem = { id: string; name: string; status: string }

type Criterion = {
  id: string

  name: string

  weight_percentage: number

  max_score: number
}

type Contestant = {
  id: string
  contestant_number: string
  full_name: string
  photo_path: string | null
}

export default function ScoresManager({
  isAdmin,

  profileId,
}: {
  isAdmin: boolean

  profileId?: string
}) {
  const [events, setEvents] = useState<EventItem[]>([])

  const [selectedEventId, setSelectedEventId] = useState("")

  const [criteria, setCriteria] = useState<Criterion[]>([])

  const [contestants, setContestants] = useState<Contestant[]>([])

  const [scores, setScores] = useState<Record<string, Record<string, number>>>(
    {},
  ) // [contestantId][criterionId] = rawScore

  const [sheetStatus, setSheetStatus] = useState<string>("draft")

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [success, setSuccess] = useState("")

  async function loadEvents() {
    if (!supabase) return

    setLoading(true)

    let eventList: EventItem[] = []

    if (isAdmin) {
      const { data } = await supabase

        .from("events")

        .select("id, name, status")

        .order("name")

      if (data) eventList = data
    } else if (profileId) {
      const { data } = await supabase

        .from("judge_event_assignments")

        .select("event_id, events(id, name, status)")

        .eq("judge_id", profileId)

        .eq("status", "active")

      if (data) eventList = data.map((d: any) => d.events).filter(Boolean)
    }

    setEvents(eventList)

    if (eventList.length > 0) {
      setSelectedEventId(getDefaultEventId(eventList))
    }

    setLoading(false)
  }

  async function loadEventScoringData(eventId: string) {
    if (!supabase || !eventId || !profileId) return

    setLoading(true)

    setError("")

    setSuccess("")

    // Load criteria

    const { data: critData } = await supabase

      .from("criteria")

      .select("id, name, weight_percentage, max_score")

      .eq("event_id", eventId)

      .eq("is_locked", true)

      .order("display_order")

    setCriteria(critData || [])

    // Load contestants for this competition

    const { data: ecData } = await supabase

      .from("event_contestants")

      .select(
        "contestant_id, contestants(id, contestant_number, full_name, photo_path)",
      )

      .eq("event_id", eventId)

    const contList =
      ecData?.map((ec: any) => ec.contestants).filter(Boolean) || []

    setContestants(contList)

    // Load judge score sheet status

    const { data: sheetData } = await supabase

      .from("score_sheets")

      .select("status")

      .eq("event_id", eventId)

      .eq("judge_id", profileId)

      .maybeSingle()

    setSheetStatus(sheetData?.status || "draft")

    // Load existing scores

    const { data: scoreData } = await supabase

      .from("scores")

      .select("contestant_id, criterion_id, raw_score")

      .eq("event_id", eventId)

      .eq("judge_id", profileId)

    const scoreMap: Record<string, Record<string, number>> = {}

    scoreData?.forEach((s) => {
      if (!scoreMap[s.contestant_id]) scoreMap[s.contestant_id] = {}

      scoreMap[s.contestant_id][s.criterion_id] = Number(s.raw_score)
    })

    setScores(scoreMap)

    setLoading(false)
  }

  useEffect(() => {
    loadEvents()
  }, [profileId, isAdmin])

  useEffect(() => {
    if (selectedEventId) {
      loadEventScoringData(selectedEventId)
    }
  }, [selectedEventId, profileId])

  function handleScoreChange(
    contestantId: string,

    criterionId: string,

    value: string,

    maxScore: number,
  ) {
    if (sheetStatus === "submitted") return

    const num = Number(value)

    if (num < 0) return

    if (num > maxScore) {
      setError(`Score cannot exceed max score of ${maxScore}.`)

      return
    }

    setError("")

    setScores((prev) => ({
      ...prev,

      [contestantId]: {
        ...(prev[contestantId] || {}),

        [criterionId]: num,
      },
    }))
  }

  async function handleSaveDraft() {
    if (!supabase || !profileId || !selectedEventId) return

    setError("")

    setSuccess("")

    const scoreInserts: any[] = []

    Object.entries(scores).forEach(([cId, critScores]) => {
      Object.entries(critScores).forEach(([critId, raw]) => {
        scoreInserts.push({
          judge_id: profileId,

          event_id: selectedEventId,

          contestant_id: cId,

          criterion_id: critId,

          raw_score: raw,
        })
      })
    })

    if (scoreInserts.length === 0) {
      setError("No scores entered to save.")

      return
    }

    const { error: upsertErr } = await supabase

      .from("scores")

      .upsert(scoreInserts, {
        onConflict: "judge_id,event_id,contestant_id,criterion_id",
      })

    if (upsertErr) {
      setError(upsertErr.message)
    } else {
      setSuccess("Draft scores saved successfully.")
    }
  }

  async function handleSubmitOfficial() {
    if (!supabase || !selectedEventId) return

    setError("")

    setSuccess("")

    // Check that all scores are filled

    for (const c of contestants) {
      for (const crit of criteria) {
        const val = scores[c.id]?.[crit.id]

        if (val === undefined || val === null || isNaN(val)) {
          setError(
            `Missing score for ${c.full_name} under criterion '${crit.name}'. All scores must be recorded before submission.`,
          )

          return
        }
      }
    }

    // Save current scores first

    await handleSaveDraft()

    // Call submit_score_sheet RPC

    const { error: rpcErr } = await supabase.rpc("submit_score_sheet", {
      event_uuid: selectedEventId,
    })

    if (rpcErr) {
      setError(rpcErr.message)
    } else {
      setSuccess(
        "Score sheet officially submitted! Tabulation has been updated.",
      )

      setSheetStatus("submitted")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/20 pb-5">
        <div>
          <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-.02em]">
            Score Sheet
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sheetStatus !== "submitted" && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={loading || criteria.length === 0}
                className="border border-[#17251d]/30 bg-white px-3 py-2 text-xs font-bold  text-[#2a3441] hover:bg-[#e8edf2] disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                onClick={handleSubmitOfficial}
                disabled={
                  loading || criteria.length === 0 || contestants.length === 0
                }
                className="bg-[#2a3441] px-4 py-2 text-xs font-bold  text-white hover:bg-[#394658] disabled:opacity-50"
              >
                Submit Official Score Sheet
              </button>
            </>
          )}
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
            Competition:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="border border-[#17251d]/30 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
            {events.length === 0 && (
              <option value="">No competitions assigned</option>
            )}
          </select>
        </div>

        <div className="font-mono text-xs">
          Sheet Status:{" "}
          <span
            className={`rounded px-2 py-0.5 font-bold  ${
              sheetStatus === "submitted"
                ? "bg-[#dfe5ec] text-[#2a3441]"
                : "bg-[#f1f5f9] text-[#475569]"
            }`}
          >
            {sheetStatus === "submitted"
              ? "Official Submitted (Locked)"
              : "Draft In Progress"}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-xs text-[#61726a]">Loading score sheet…</p>
      ) : criteria.length === 0 ? (
        <div className="mt-8 border-l border-[#a23b30] bg-[#f3e2dc] p-6">
          <h2 className="font-sans text-lg font-semibold">
            Criteria Not Locked for Scoring
          </h2>
          <p className="mt-2 text-sm text-[#70271f]">
            This competition does not have finalized and locked criteria
            totaling 100%. Please configure and lock criteria in the Criteria
            tab before scoring can begin.
          </p>
        </div>
      ) : contestants.length === 0 ? (
        <div className="mt-8 border-l border-[#2a3441] bg-[#e8edf2] p-6">
          <h2 className="font-sans text-lg font-semibold">
            No Contestants Registered
          </h2>
          <p className="mt-2 text-sm text-[#52655c]">
            There are no contestants currently registered for this competition.
            An administrator must register contestants before you can submit
            scores.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border border-[#17251d]/20 bg-[#ffffff]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#17251d]/20 bg-[#e8edf2] text-xs font-bold  text-[#61726a]">
              <tr>
                <th className="p-3">Contestant</th>
                {criteria.map((crit) => (
                  <th key={crit.id} className="p-3">
                    {crit.name}
                    <span className="block font-normal text-[#2a3441]">
                      {crit.weight_percentage}% (Max: {crit.max_score})
                    </span>
                  </th>
                ))}
                <th className="p-3 text-right">Your Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251d]/10">
              {contestants.map((c) => {
                let totalJudgeScore = 0

                return (
                  <tr key={c.id} className="hover:bg-white/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <ContestantPhoto
                          path={c.photo_path}
                          name={c.full_name}
                        />
                        <div>
                          <span className="font-mono font-bold text-[#2a3441]">
                            {c.contestant_number}
                          </span>
                          <p className="font-semibold">{c.full_name}</p>
                        </div>
                      </div>
                    </td>
                    {criteria.map((crit) => {
                      const raw = scores[c.id]?.[crit.id]

                      const weighted =
                        typeof raw === "number"
                          ? (raw * Number(crit.weight_percentage)) / 100
                          : 0

                      totalJudgeScore += weighted

                      return (
                        <td key={crit.id} className="p-3">
                          <input
                            type="number"
                            min="0"
                            max={crit.max_score}
                            step="0.5"
                            disabled={sheetStatus === "submitted"}
                            value={raw !== undefined ? raw : ""}
                            onChange={(e) =>
                              handleScoreChange(
                                c.id,

                                crit.id,

                                e.target.value,

                                crit.max_score,
                              )
                            }
                            className="w-20 border border-[#17251d]/30 bg-white p-1.5 font-mono text-sm outline-none disabled:bg-gray-100"
                            placeholder="0.00"
                          />
                          <span className="ml-2 text-xs text-[#61726a]">
                            = {weighted.toFixed(2)}
                          </span>
                        </td>
                      )
                    })}
                    <td className="p-3 text-right font-mono text-base font-bold text-[#2a3441]">
                      {totalJudgeScore.toFixed(2)}
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
