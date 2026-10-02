export function getDefaultEventId(events: readonly { id: string; name: string }[]): string {
  const preferred = events.find(event =>
    event.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "") === "mrandmsccs",
  )
  return preferred?.id ?? events[0]?.id ?? ""
}
