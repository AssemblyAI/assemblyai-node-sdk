/**
 * Each label will be returned with a `confidence` score and a `severity` score. It is important to note that these two keys measure two very different things. The `severity` key will produce a score that shows how severe the flagged content is on a scale of `0–1`. For example, a natural disaster with mass casualties would be a `1`, whereas a wind storm that broke a lamppost would be a `0.1`.
 *
 * In comparison, `confidence` displays how confident the model was in predicting the label it predicted, also on a scale of `0-1`.
 *
 * We can break this down further by reviewing the following label:
 * ```
 *     "labels": [
 *         {
 *             "label": "health_issues",
 *             "confidence": 0.8225132822990417,
 *             "severity": 0.15090347826480865
 *         }
 *     ],
 * ```
 * In the above example, the Content Safety model is indicating it is `82.25%` confident that the spoken content is about Health Issues; however, it is measured at a low severity of `0.1509`. This means the model is very confident the content is about health issues, but the content was not severe in nature (ie, was likely about a minor health issue).
 */
export class ContentSafetyLabel {
  /**
   * The text description of the safety issue.
   */
  label?: string;
  /**
   * How confident the model was in predicting the label it predicted on a scale of 0-1.
   */
  confidence?: number;
  /**
   * A score that shows how severe the flagged content is on a scale of 0–1. For example, a natural disaster with mass casualties would be a 1, whereas a wind storm that broke a lamppost would be a 0.1.
   */
  severity?: number;
}
