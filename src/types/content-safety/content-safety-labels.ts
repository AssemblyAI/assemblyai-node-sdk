import type { ContentSafetyResult } from './content-safety-result';
import type { ContentSafetySummary } from './content-safety-summary';
import type { SeverityScoreSummary } from './severity-score-summary';

/**
 * With **Content Safety Detection**, AssemblyAI can detect if any of the following sensitive content is spoken in your audio/video files, and pinpoint exactly when and what was spoken:
 *
 * | Label                   | Description                                                                                                                                                                                                      | Model Output            | Supported by Severity Scores |
 * |-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------|------------------------------|
 * | Accidents               | Any man-made incident that happens unexpectedly and results in damage, injury, or death.                                                                                                                         | accidents               | Yes                          |
 * | Alcohol                 | Content that discusses any alcoholic beverage or its consumption.                                                                                                                                                | alcohol                 | Yes                          |
 * | Company Financials      | Content that discusses any sensitive company financial information.                                                                                                                                              | financials              | No                           |
 * | Crime Violence          | Content that discusses any type of criminal activity or extreme violence that is criminal in nature.                                                                                                             | crime_violence          | Yes                          |
 * | Drugs                   | Content that discusses illegal drugs or their usage.                                                                                                                                                             | drugs                   | Yes                          |
 * | Gambling                | Includes gambling on casino-based games such as poker, slots, etc. as well as sports betting.                                                                                                                    | gambling                | Yes                          |
 * | Hate Speech             | Content that is a direct attack against people or groups based on their sexual orientation, gender identity, race, religion, ethnicity, national origin, disability, etc.                                        | hate_speech             | Yes                          |
 * | Health Issues           | Content that discusses any medical or health-related problems.                                                                                                                                                   | health_issues           | Yes                          |
 * | Manga                   | Mangas are comics or graphic novels originating from Japan with some of the more popular series being "Pokemon", "Naruto", "Dragon Ball Z", "One Punch Man", and "Sailor Moon".                                  | manga                   | No                           |
 * | Marijuana               | This category includes content that discusses marijuana or its usage.                                                                                                                                            | marijuana               | Yes                          |
 * | Natural Disasters       | Phenomena that happens infrequently and results in damage, injury, or death. Such as hurricanes, tornadoes, earthquakes, volcano eruptions, and firestorms.                                                      | disasters               | Yes                          |
 * | Negative News           | News content with a negative sentiment which typically will occur in the third person as an unbiased recapping of events.                                                                                        | negative_news           | No                           |
 * | NSFW (Adult Content)    | Content considered "Not Safe for Work" and consists of content that a viewer would not want to be heard/seen in a public environment.                                                                            | nsfw                    | No                           |
 * | Pornography             | Content that discusses any sexual content or material.                                                                                                                                                           | pornography             | Yes                          |
 * | Profanity               | Any profanity or cursing.                                                                                                                                                                                        | profanity               | Yes                          |
 * | Sensitive Social Issues | This category includes content that may be considered insensitive, irresponsible, or harmful to certain groups based on their beliefs, political affiliation, sexual orientation, or gender identity.            | sensitive_social_issues | No                           |
 * | Terrorism               | Includes terrorist acts as well as terrorist groups. Examples include bombings, mass shootings, and ISIS. Note that many texts corresponding to this topic may also be classified into the crime violence topic. | terrorism               | Yes                          |
 * | Tobacco                 | Text that discusses tobacco and tobacco usage, including e-cigarettes, nicotine, vaping, and general discussions about smoking.                                                                                  | tobacco                 | Yes                          |
 * | Weapons                 | Text that discusses any type of weapon including guns, ammunition, shooting, knives, missiles, torpedoes, etc.                                                                                                   | weapons                 | Yes                          |
 *
 * Simply include the `content_safety` parameter in your `POST` request when submitting audio files for transcription, and set this parameter to `true`.
 *
 * ## Interpreting Content Safety Detection Results
 *
 * Once the transcription is complete, and you [get the result](/walkthroughs#getting-the-transcription-result "null"), there will be an additional key `content_safety_labels` in the JSON response. Below, we'll drill into the data that is returned in the `content_safety_labels` key.
 *
 * ## Understanding Severity Scores and Confidence Scores
 *
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
 *
 * ## Understanding the Severity Score Summary
 *
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
 *
 * The value of the `low`, `medium`, and `high` keys reflect the API's confidence that the label is "low," "medium," or "high" in severity throughout the entire audio file. This score is based on the intersection of the length of the audio file, the frequency of `low`/`medium`/`high` severity tags through the file, and the `confidence` score for each of those occurrences.
 *
 * ## Controlling the Threshold of Surfaced Results
 *
 * By default, the content safety model will return any label with a confidence of 50% or greater. If you wish to set a higher or lower threshold, simply add the `content_safety_confidence: {number}` parameter to your `POST` request. This parameter will accept an integer value between `25` and `100`, inclusive.
 */
export class ContentSafetyLabels {
  /**
   * Will be either `"success"`, or `"unavailable"` in the rare case that the Content Safety Detection model failed.
   */
  status?: string;
  /**
   * A list of all the spoken audio the Content Safety Detection model flagged.
   */
  results?: ContentSafetyResult[];
  /**
   * For each label that was predicted in the `results` set, the `summary` key provides the confidence of each label in relation to the entire audio file. For example, there could be a single result of `disasters` with `0.99` confidence, but if this was a single result in a 3 hour audio file, the `summary` would show a low confidence for `disasters` - indicating that `disasters` is not spoken of widely throughout the entire audio file.
   */
  summary?: ContentSafetySummary;
  /**
   * For each label that was predicted in the `results` set, the `severity_score_summary` key provides the overall severity of each label in relation to the entire audio file.
   */
  severity_score_summary?: SeverityScoreSummary;
}
