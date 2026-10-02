import { criteriaReadyForScoring } from "../lib/criteria-readiness"
import { getDefaultEventId } from "../lib/default-event"
import { useEffect, useState, type CSSProperties } from "react"

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

  const [activeContestantIndex, setActiveContestantIndex] = useState(0)

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
    setActiveContestantIndex(0)

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

    if (value.trim() === "") {
      setScores((prev) => {
        const next = { ...(prev[contestantId] || {}) }
        delete next[criterionId]
        return { ...prev, [contestantId]: next }
      })
      setError("")
      return
    }

    const num = Number(value)
    if (!Number.isFinite(num)) return

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

  const criteriaReady = criteriaReadyForScoring(criteria)

  async function handleSaveDraft() {
    if (!supabase || !profileId || !selectedEventId) return

    setError("")

    setSuccess("")

    if (!criteriaReady) {
      setError("Criteria weights must total exactly 100% before scoring can begin.")
      return
    }

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

    if (!criteriaReady) {
      setError("Criteria weights must total exactly 100% before scoring can begin.")
      return
    }

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
    <div className="judge-scoring">
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
                disabled={loading || !criteriaReady}
                className="border border-[#17251d]/30 bg-white px-3 py-2 text-xs font-bold  text-[#2a3441] hover:bg-[#e8edf2] disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                onClick={handleSubmitOfficial}
                disabled={
                  loading || !criteriaReady || contestants.length === 0
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
        <p role="alert" className="mt-3 border-l border-[#a23b30] bg-[#f3e2dc] p-2 text-xs text-[#70271f]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-3 border-l border-[#2a3441] bg-[#dfe5ec] p-2 text-xs text-[#2a3441]">
          {success}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-[#ffffff] p-4 border border-[#17251d]/20">
        <div className="flex items-center gap-3">
          <label htmlFor="scoring-event" className="text-xs font-bold  text-[#61726a]">
            Competition:
          </label>
          <select
            id="scoring-event"
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
      ) : !criteriaReady ? (
        <div className="mt-8 border-l border-[#a23b30] bg-[#f3e2dc] p-6">
          <h2 className="font-sans text-lg font-semibold">
            Criteria Not Ready for Scoring
          </h2>
          <p className="mt-2 text-sm text-[#70271f]">
            This competition needs criteria totaling exactly 100%. Configure
            the weights in the Criteria tab before scoring can begin.
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
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#52655c]">
            <p>{contestants.filter((c) => criteria.every((crit) => scores[c.id]?.[crit.id] !== undefined)).length} of {contestants.length} contestants fully scored</p>
            <p className="text-xs">Changes are saved when you select Save Draft.</p>
          </div>
          {!isAdmin && (
            <nav aria-label="Contestant navigation" className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Previous contestant"
                disabled={activeContestantIndex === 0}
                onClick={() => setActiveContestantIndex((index) => Math.max(0, index - 1))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#17251d]/30 bg-white text-[#2a3441] hover:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:cursor-default disabled:opacity-40"
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <p aria-live="polite" aria-atomic="true" className="text-center text-sm font-semibold text-[#2a3441]">
                Contestant {activeContestantIndex + 1} of {contestants.length}
              </p>
              <button
                type="button"
                aria-label="Next contestant"
                disabled={activeContestantIndex >= contestants.length - 1}
                onClick={() => setActiveContestantIndex((index) => Math.min(contestants.length - 1, index + 1))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#17251d]/30 bg-white text-[#2a3441] hover:bg-[#e8edf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441] disabled:cursor-default disabled:opacity-40"
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </nav>
          )}
          {(isAdmin ? contestants : contestants.slice(activeContestantIndex, activeContestantIndex + 1)).map((c) => {
            const completed = criteria.filter((crit) => scores[c.id]?.[crit.id] !== undefined).length
            const total = criteria.reduce((sum, crit) => sum + (scores[c.id]?.[crit.id] ?? 0) * Number(crit.weight_percentage) / 100, 0)
            return (
              <section key={c.id} aria-labelledby={`contestant-${c.id}`} className="score-contestant overflow-hidden border border-[#17251d]/20 bg-white">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#17251d]/10 bg-[#f8faf9] px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <ContestantPhoto path={c.photo_path} name={c.full_name} />
                    <div>
                      <h2 id={`contestant-${c.id}`} className="text-lg font-semibold tracking-[-.02em] text-[#2a3441]">
                        <span className="mr-3 font-mono text-sm text-[#52655c]">#{c.contestant_number}</span>{c.full_name}
                      </h2>
                      <p className="mt-1 text-xs text-[#52655c]">{completed === criteria.length ? "All criteria scored" : `${completed} of ${criteria.length} criteria scored`}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3 text-[#2a3441]">
                    <span className="text-xs">Weighted total</span>
                    <output aria-label={`Weighted total for ${c.full_name}`} className="font-mono text-2xl font-semibold tabular-nums">{total.toFixed(2)}</output>
                  </div>
                </header>
                <div className="grid grid-cols-1 gap-x-10 gap-y-8 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                  {criteria.map((crit) => {
                    const raw = scores[c.id]?.[crit.id]
                    const maximum = Number(crit.max_score)
                    const sliderMaximum = Math.floor(maximum / 5) * 5
                    const weighted = (raw ?? 0) * Number(crit.weight_percentage) / 100
                    const inputId = `score-${c.id}-${crit.id}`
                    const disabled = sheetStatus === "submitted"
                    return (
                      <div key={crit.id} className="min-w-0">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <label htmlFor={inputId} className="block text-sm font-semibold text-[#2a3441]">{crit.name}</label>
                            <p className="mt-1 text-xs text-[#52655c]">{crit.weight_percentage}% weight</p>
                          </div>
                          <div className="flex shrink-0 items-baseline gap-1.5">
                            <input id={inputId} type="number" min="0" max={maximum} step="0.5" disabled={disabled}
                              value={raw ?? ""} placeholder="?"
                              onChange={(e) => handleScoreChange(c.id, crit.id, e.target.value, maximum)}
                              className="score-number w-[72px] border border-[#17251d]/25 bg-white px-2 py-2 text-center font-mono text-lg font-semibold text-[#2a3441] disabled:bg-[#f3f4f6]"
                              aria-describedby={`${inputId}-help`} />
                            <span className="text-xs text-[#52655c]">/ {maximum}</span>
                          </div>
                        </div>
                        <input type="range" min="0" max={sliderMaximum} step="5"
                          value={Math.min(sliderMaximum, Math.round((raw ?? 0) / 5) * 5)}
                          disabled={disabled || sliderMaximum === 0}
                          aria-label={`${crit.name} score for ${c.full_name}, in steps of 5`}
                          aria-describedby={`${inputId}-help`}
                          onChange={(e) => handleScoreChange(c.id, crit.id, e.target.value, maximum)}
                          className={`score-slider ${raw === undefined ? "score-slider-empty" : ""}`}
                          style={{ "--score-fill": `${sliderMaximum > 0 ? Math.min(100, Math.round((raw ?? 0) / 5) * 5 / sliderMaximum * 100) : 0}%` } as CSSProperties} />
                        <div aria-hidden="true" className="score-ticks">
                          {Array.from({ length: Math.min(40, Math.floor(sliderMaximum / 5)) + 1 }, (_, tick) => <span key={tick} />)}
                        </div>
                        <div id={`${inputId}-help`} className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#52655c]">
                          <span>0</span>
                          <span>{raw === undefined ? "Awaiting score" : `${weighted.toFixed(2)} weighted points`}</span>
                          <span>{sliderMaximum}</span>
                        </div>
                        {sliderMaximum < maximum && <p className="mt-2 text-xs text-[#52655c]">Type a score to enter up to {maximum}.</p>}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
