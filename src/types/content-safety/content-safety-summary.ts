/**
 * For each label that was predicted in the `results` set, the `summary` key provides the confidence of each label in relation to the entire audio file. For example, there could be a single result of `disasters` with `0.99` confidence, but if this was a single result in a 3 hour audio file, the `summary` would show a low confidence for `disasters` - indicating that `disasters` is not spoken of widely throughout the entire audio file.
 */
export type ContentSafetySummary = Record<string, number>;
