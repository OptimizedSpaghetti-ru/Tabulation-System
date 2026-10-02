export function criteriaReadyForScoring(criteria: { weight_percentage: number | string }[]): boolean {
  return criteria.length > 0 && criteria.reduce((sum, criterion) => sum + Math.round(Number(criterion.weight_percentage) * 100), 0) === 10000
}
