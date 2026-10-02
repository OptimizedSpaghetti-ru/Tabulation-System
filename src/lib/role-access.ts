const adminPages = ["Dashboard", "Competition", "Contestants", "Judges", "Assign Judges", "Criteria", "Tabulation", "Results", "Audit Logs"]
const judgePages = ["Dashboard", "Competition", "Criteria", "Scores", "Results"]

export function navigationForRole(role: string): string[] {
  if (role === "admin") return adminPages
  if (role === "judge") return judgePages
  return []
}

export function canAccessPage(role: string, page: string): boolean {
  return navigationForRole(role).some((label) => label.toLowerCase().replace(/ /g, "-") === page)
}
