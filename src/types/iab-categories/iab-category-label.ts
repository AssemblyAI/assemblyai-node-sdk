/**
 * A label that was predicted for this portion of text. The relevance key gives a score between 0 and 1.0 for how relevant each label is for the portion of text.
 */
export class IabCategoryLabel {
  /**
   * A score between 0 and 1.0 for how relevant the label is for the portion of text.
   */
  relevance?: number;
  /**
   * The label for the portion of text.
   */
  label?: string;
}
