export type ContestantGender = "Male" | "Female"
type NumberedContestant = {
  id: string
  contestant_number: string
  gender: string | null
}
export function isCcsPageant(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "")
  return normalized === "mrandmsccs" || normalized === "mrandmsccscompetition"
}
export function isContestantGender(
  value: string | null,
): value is ContestantGender {
  return value === "Male" || value === "Female"
}
export function filterScoringContestants<T extends NumberedContestant>(
  contestants: T[],
  name: string,
  gender: ContestantGender,
): T[] {
  return isCcsPageant(name)
    ? contestants.filter((c) => c.gender === gender)
    : contestants
}
export function pageantContestantError(
  name: string,
  gender: string,
  number: string,
  contestants: NumberedContestant[],
  editingId?: string,
): string {
  if (!isCcsPageant(name)) return ""
  if (!isContestantGender(gender))
    return "Select Male or Female for this contestant."
  if (
    contestants.some(
      (c) =>
        c.id !== editingId &&
        c.gender === gender &&
        c.contestant_number.trim() === number.trim(),
    )
  )
    return `Contestant number ${number.trim()} is already assigned to a ${gender.toLowerCase()} contestant in this competition. Choose another number.`
  return ""
}
