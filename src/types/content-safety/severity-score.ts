/**
 * The severity score for a single label in the {@link SeverityScoreSummary}.
 */
export class SeverityScore {
  /**
   * The confidence that the label is "low" in severity throughout the entire audio file.
   */
  low?: number;
  /**
   * The confidence that the label is "medium" in severity throughout the entire audio file.
   */
  medium?: number;
  /**
   * The confidence that the label is "high" in severity throughout the entire audio file.
   */
  high?: number;
}
