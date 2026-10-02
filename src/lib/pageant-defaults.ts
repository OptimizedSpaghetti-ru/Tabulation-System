const production = "Mastery of Steps / Execution: 35%; Stage Presence and Confidence: 30%; Poise and Bearing: 25%; Overall Impact: 10%."
const categories: [string, number, string][] = [
  ["Mini Production / Full Production", 7, production],
  ["Photogenic", 3, "Camera Presence / Photogenic Appeal: 40%; Facial Expression: 25%; Poise and Confidence: 20%; Overall Impact: 15%."],
  ["Full Production", 5, production],
  ["Casual Wear", 10, "Styling and Appropriateness: 40%; Creativity and Uniqueness: 25%; Beauty and Carriage: 25%; Overall Impact: 10%."],
  ["Talent", 10, "Technical Skill / Mastery: 40%; Execution / Level of Difficulty: 20%; Creativity / Originality: 15%; Confidence / Stage Presence: 10%; Audience Impact: 10%; Appropriateness: 5%."],
  ["Sports Attire", 15, "Attire Creativity and Design: 40%; Relevance to Sports Theme: 20%; Confidence and Stage Presence: 30%; Overall Impact and Presentation: 10%."],
  ["Formal Attire", 25, "Poise and Bearing: 40%; Attire Fit and Styling: 25%; Stage Deportment: 25%; Overall Impact: 10%."],
  ["Question & Answer (Q&A)", 25, "Content and Relevance: 40%; Delivery and Communication: 30%; Confidence and Stage Presence: 20%; Overall Impact: 10%."],
]

export function pageantDefaults(eventName: string) {
  const normalized = eventName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "")
  if (normalized !== "mrandmsccs") return []
  return categories.map(([name, weight_percentage, description], index) => ({
    name, weight_percentage, description, max_score: 100, display_order: index + 1,
  }))
}

export function canInitializePageantDefaults(eventName: string, status: string, criteriaCount: number) {
  return pageantDefaults(eventName).length > 0 && criteriaCount === 0 && ["draft", "registration_open", "ongoing"].includes(status)
}
