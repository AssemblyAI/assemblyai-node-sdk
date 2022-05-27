/**
 * For each unique topic label detected in the `results` array, the `summary` key will show the relevancy for that label across the entire audio file. For example, if the `Science>Environment` label is detected only 1 time in a 60 minute audio file, the `summary` key will show a low relevancy score for that label, since the entire transcription was not found to consistently be about `Science>Environment`.
 */
export type IabCategoriesSummary = Record<string, number>;
