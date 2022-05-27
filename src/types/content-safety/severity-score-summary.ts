import type { SeverityScore } from './severity-score';

/**
 * The `severity_score_summary` key lists each label that was detected along with `low`, `medium`, and `high` keys.
 * ```
 *     "severity_score_summary": {
 *         "health_issues": {
 *             "low": 0.7210625030587972,
 *             "medium": 0.2789374969412028,
 *             "high": 0.0
 *         }
 *     }
 * ```
 * The value of the `low`, `medium`, and `high` keys reflect the API's confidence that the label is "low," "medium," or "high" in severity throughout the entire audio file. This score is based on the intersection of the length of the audio file, the frequency of `low`/`medium`/`high` severity tags through the file, and the `confidence` score for each of those occurrences.
 */
export type SeverityScoreSummary = Record<string, SeverityScore>;
