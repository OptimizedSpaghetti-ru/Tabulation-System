import { useEffect, useState } from "react"
import { NavLink } from "react-router"
import { supabase } from "../lib/supabase"

type PublishedEvent = {
  id: string;
  name: string;
  competitions: { name: string; academic_year: string } | null
}
type PublishedResult = {
  id: string;
  event_id: string;
  rank: number | null
  final_score: number;
  finalized_at: string | null
  contestants: { full_name: string; contestant_number: string } | null
}
const control =
  "min-h-11 border border-[#17251d]/35 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a3441]"

export default function PublicResults({ brand }: { brand: React.ReactNode }) {
  const [events, setEvents] = useState<PublishedEvent[]>([])
  const [results, setResults] = useState<PublishedResult[]>([])
  const [eventId, setEventId] = useState("")
  const [search, setSearch] = useState("")
  const [state, setState] = useState<"loading" | "error" | "ready">("loading")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setState("loading")
    async function load() {
      try {
        if (!supabase) throw new Error("Unavailable")
        const [eventResponse, resultResponse] = await Promise.all([
          supabase
            .from("events")
            .select("id,name,competitions(name,academic_year)")
            .eq("status", "published")
            .order("name"),
          supabase
            .from("results")
            .select(
              "id,event_id,rank,final_score,finalized_at,contestants(full_name,contestant_number),events!inner(status)",
            )
            .eq("events.status", "published")
            .eq("status", "finalized")
            .order("rank")
            .order("id"),
        ])
        if (eventResponse.error || resultResponse.error)
          throw new Error("Unavailable")
        if (!active) return
        const published = (eventResponse.data ??
          []) as unknown as PublishedEvent[]
        setEvents(published)
        setResults((resultResponse.data ?? []) as unknown as PublishedResult[])
        setEventId((current) =>
          published.some((event) => event.id === current)
            ? current
            : (published[0]?.id ?? ""),
        )
        setState("ready")
      } catch {
        if (active) setState("error")
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [attempt])

  const selected = events.find((event) => event.id === eventId)
  const eventResults = results.filter((result) => result.event_id === eventId)
  const term = search.trim().toLocaleLowerCase()
  const visible = eventResults.filter((result) =>
    `${result.contestants?.full_name ?? ""} ${result.contestants?.contestant_number ?? ""}`
      .toLocaleLowerCase()
      .includes(term),
  )
  const finalizedAt = eventResults
    .map((result) => result.finalized_at)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)
  const refresh = () => setAttempt((value) => value + 1)

  return (
    <main className="public-results min-h-screen bg-[#f1efe6] text-[#17251d]">
      <a
        href="#published-results"
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-white focus:p-3"
      >
        Skip to results
      </a>
      <header className="border-b border-[#17251d]/20 bg-[#f8f6ee]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <NavLink
            to="/results"
            aria-label="University competition results"
            className="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {brand}
          </NavLink>
          <NavLink
            to="/login"
            className="flex min-h-11 items-center text-sm font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Staff sign in
          </NavLink>
        </div>
      </header>
      <section
        id="published-results"
        className="mx-auto max-w-5xl px-5 py-10 sm:py-14"
      >
        <h1 className="font-display text-4xl tracking-[-.03em] sm:text-5xl">
          Competition results
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#52655c]">
          Official rankings for published events. Only finalized results are
          listed; individual judge scores remain private.
        </p>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={state === "loading" ? "mt-10 text-sm" : "sr-only"}
        >
          {state === "loading"
            ? "Loading published results…"
            : state === "error"
              ? "Results could not be loaded."
              : selected
                ? `${selected.name}: ${visible.length} of ${eventResults.length} contestants shown.`
                : "No published events yet."}
        </div>
        {state === "error" && (
          <div className="mt-10 border border-[#a23b30]/40 bg-[#f8f6ee] p-5 sm:p-7">
            <h2 className="font-display text-2xl">
              Results could not be loaded
            </h2>
            <p className="mt-2 text-sm leading-6">
              Check your connection and try again. If the problem continues, ask
              the College of Computer Studies administration for assistance.
            </p>
            <button
              onClick={refresh}
              className={`${control} mt-5 font-semibold`}
            >
              Try again
            </button>
          </div>
        )}
        {state === "ready" && !events.length && (
          <div className="mt-10 border border-[#17251d]/20 bg-[#f8f6ee] p-5 sm:p-7">
            <h2 className="font-display text-2xl">Awaiting publication</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52655c]">
              No events have published results yet. Check again after the
              organizers announce publication, or ask the College of Computer
              Studies administration for an update.
            </p>
            <button
              onClick={refresh}
              className={`${control} mt-5 font-semibold`}
            >
              Check again
            </button>
          </div>
        )}
        {state === "ready" && selected && (
          <>
            <div className="mt-6 grid max-w-xl gap-4 border-y border-[#17251d]/20 py-4">
              <label className="grid gap-2 text-sm font-semibold">
                Published event
                <select
                  value={eventId}
                  onChange={(event) => {
                    setEventId(event.target.value)
                    setSearch("")
                  }}
                  className={`${control} w-full min-w-0`}
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.competitions
                        ? `${event.competitions.name} — `
                        : ""}
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Find a contestant
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or contestant number"
                  className={`${control} w-full min-w-0`}
                />
              </label>
            </div>
            <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {selected.competitions && (
                  <p className="break-words text-sm text-[#52655c]">
                    {selected.competitions.name} ·{" "}
                    {selected.competitions.academic_year}
                  </p>
                )}
                <h2 className="mt-1 break-words font-display text-3xl tracking-[-.02em]">
                  {selected.name}
                </h2>
                {finalizedAt && (
                  <p className="mt-2 text-sm text-[#52655c]">
                    Finalized{" "}
                    <time dateTime={finalizedAt}>
                      {new Intl.DateTimeFormat("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      }).format(new Date(finalizedAt))}
                    </time>{" "}
                    (Philippine time)
                  </p>
                )}
              </div>
              <button onClick={refresh} className={`${control} font-semibold`}>
                Refresh results
              </button>
            </div>
            <p className="mt-4 text-sm text-[#52655c]">
              Showing {visible.length} of {eventResults.length} contestants
            </p>
            {visible.length ? (
              <>
                <table className="mt-4 hidden w-full table-fixed border border-[#17251d]/20 bg-[#f8f6ee] sm:table">
                  <caption className="sr-only">
                    Official rankings for {selected.name}
                  </caption>
                  <thead className="bg-[#e8edf2] text-left text-sm">
                    <tr>
                      <th scope="col" className="w-20 p-4">
                        Rank
                      </th>
                      <th scope="col" className="p-4">
                        Contestant
                      </th>
                      <th scope="col" className="w-36 p-4 text-right">
                        Final score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((result) => (
                      <tr
                        key={result.id}
                        className="border-t border-[#17251d]/15"
                      >
                        <td className="p-4 font-mono tabular-nums">
                          {result.rank ?? "Pending"}
                        </td>
                        <th
                          scope="row"
                          className="break-words p-4 text-left font-semibold"
                        >
                          {result.contestants?.full_name ??
                            "Contestant name unavailable"}
                          <span className="mt-1 block text-sm font-normal text-[#52655c]">
                            {result.contestants?.contestant_number
                              ? `Contestant ${result.contestants.contestant_number}`
                              : "Number unavailable"}
                          </span>
                        </th>
                        <td className="p-4 text-right font-mono tabular-nums">
                          {Number(result.final_score).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ol
                  aria-label={`Official rankings for ${selected.name}`}
                  className="mt-4 border border-[#17251d]/20 bg-[#f8f6ee] sm:hidden"
                >
                  {visible.map((result) => (
                    <li
                      key={result.id}
                      className="border-b border-[#17251d]/15 p-4 last:border-0"
                    >
                      <p className="break-words font-semibold">
                        {result.contestants?.full_name ??
                          "Contestant name unavailable"}
                      </p>
                      <p className="mt-1 text-sm text-[#52655c]">
                        {result.contestants?.contestant_number
                          ? `Contestant ${result.contestants.contestant_number}`
                          : "Number unavailable"}
                      </p>
                      <dl className="mt-4 flex flex-wrap justify-between gap-4">
                        <div>
                          <dt className="text-sm text-[#52655c]">Rank</dt>
                          <dd className="mt-1 font-mono tabular-nums">
                            {result.rank ?? "Pending"}
                          </dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-sm text-[#52655c]">
                            Final score
                          </dt>
                          <dd className="mt-1 font-mono tabular-nums">
                            {Number(result.final_score).toFixed(2)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="mt-4 border border-[#17251d]/20 bg-[#f8f6ee] p-5">
                <h3 className="font-semibold">
                  {eventResults.length
                    ? "No matching contestants"
                    : "No finalized rankings available"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#52655c]">
                  {eventResults.length
                    ? "Try another name or contestant number."
                    : "This event is published, but no finalized rankings are available. Ask the College of Computer Studies administration for an update."}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className={`${control} mt-4`}
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
            <details className="mt-6 border-y border-[#17251d]/20 py-4 text-sm">
              <summary className="cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
                How to read these results
              </summary>
              <div className="mt-3 max-w-2xl space-y-3 leading-6 text-[#52655c]">
                <p>
                  Final scores average the weighted totals from submitted judge
                  score sheets. Each criterion contributes its raw score
                  multiplied by its percentage weight. The score scale depends
                  on the event’s criteria; scores from different events should
                  not be compared.
                </p>
                <p>
                  Equal final scores share a rank, and the next rank may skip a
                  position. Scores are displayed to two decimal places; rankings
                  use the recorded four-decimal totals, so identical displayed
                  scores can have different ranks.
                </p>
                <p>
                  For questions about an outcome or the event’s criteria, ask
                  the College of Computer Studies administration.
                </p>
              </div>
            </details>
          </>
        )}
      </section>
    </main>
  )
}
