import type { CustomSpelling } from '../custom-spelling';

/**
 * The request object to create a Transcript used in the {@link AssemblyClient.createTranscript} function.
 *
 */
export class TranscriptRequest {
  /**
   * Creates an instance of TranscriptRequest.
   * @param audioUrl - The URL of your media file to transcribe.
   */
  constructor(audioUrl: string) {
    this.audio_url = audioUrl;
  }

  /**
   * The URL of your media file to transcribe.
   */
  audio_url: string;
  /**
   * The language of your audio file. Possible values are found in [Supported Languages](/#supported-languages "null"). The default value is `en_us`.
   */
  language_code?: string;
  /**
   * Enable Automatic Punctuation, can be `true` or `false`.
   */
  punctuate?: boolean;
  /**
   * Enable Text Formatting, can be `true` or `false`.
   */
  format_text?: boolean;
  /**
   * Enable Dual Channel transcription, can be `true` or `false`.
   */
  dual_channel?: boolean;
  /**
   * The URL we should send webhooks to when your transcript is complete.
   */
  webhook_url?: string;
  /**
   * The point in time, in milliseconds, to begin transcription from in your media file.
   */
  audio_start_from?: number;
  /**
   * The point in time, in milliseconds, to stop transcribing in your media file.
   */
  audio_end_at?: number;
  /**
   * A list of custom vocabulary to boost accuracy for.
   */
  word_boost?: string[];
  /**
   * The weight to apply to words/phrases in the `word_boost` array; can be `"low"`, `"default"`, or `"high"`.
   */
  boost_param?: string;
  /**
   * Filter profanity from the transcribed text, can be `true` or `false`.
   */
  filter_profanity?: boolean;
  /**
   * Redact PII from the transcribed text, can be `true` or `false`.
   *
   * With PII Redaction, the API can automatically remove **Personally Identifiable Information (PII)**, such as phone numbers and social security numbers, from the transcription text before it is returned to you.
   *
   * All redacted text will be replaced with `#` characters. For example, if the phone number `111-2222` was spoken in the audio, it would be transcribed as `###-####` in the text.
   */
  redact_pii?: boolean;
  /**
   * Generate a copy of the original media file with spoken PII "beeped" out, can be `true` or `false`.
   */
  redact_pii_audio?: boolean;
  /**
   * The list of PII Redaction policies to enable.
   *
   * To best-fit PII Redaction to your use case and data, you can select from a set of redaction policies when using PII Redaction. Simply include any or some of the below policy names in the `redact_pii_policies` array when making your POST request as shown on the right.
   *
   * | Policy Name               | Description                                                                                                                   |
   * |---------------------------|-------------------------------------------------------------------------------------------------------------------------------|
   * | medical_process           | Medical process, including treatments, procedures, and tests (e.g., heart surgery, CT scan)                                   |
   * | medical_condition         | Name of a medical condition, disease, syndrome, deficit, or disorder (e.g., chronic fatigue syndrome, arrhythmia, depression) |
   * | blood_type                | Blood type (e.g., O-, AB positive)                                                                                            |
   * | drug                      | Medications, vitamins, or supplements (e.g., Advil, Acetaminophen, Panadol)                                                   |
   * | injury                    | Bodily injury (e.g., I broke my arm, I have a sprained wrist)                                                                 |
   * | number_sequence           | A "lazy" rule that will redact any sequence of numbers equal to or greater than 2                                             |
   * | email_address             | Email address (e.g., [support@assemblyai.com](mailto:support@assemblyai.com "undefined")))                                                                                  |
   * | date_of_birth             | Date of Birth (e.g., Date of Birth: March 7,1961)                                                                             |
   * | phone_number              | Telephone or fax number                                                                                                       |
   * | us_social_security_number | Social Security Number or equivalent                                                                                          |
   * | credit_card_number        | Credit card number                                                                                                            |
   * | credit_card_expiration    | Expiration date of a credit card                                                                                              |
   * | credit_card_cvv           | Credit card verification code (e.g., CVV: 080)                                                                                |
   * | date                      | Specific calendar date (e.g., December 18)                                                                                    |
   * | nationality               | Terms indicating nationality, ethnicity, or race (e.g., American, Asian, Caucasian)                                           |
   * | event                     | Name of an event or holiday (e.g., Olympics, Yom Kippur)                                                                      |
   * | language                  | Name of a natural language (e.g., Spanish, French)                                                                            |
   * | location                  | Any Location reference including mailing address, postal code, city, state, province, or country                              |
   * | money_amount              | Name and/or amount of currency (e.g., 15 pesos, $94.50)                                                                       |
   * | person_name               | Name of a person (e.g., Bob, Doug Jones)                                                                                      |
   * | person_age                | Number associated with an age (e.g., 27, 75)                                                                                  |
   * | organization              | Name of an organization (e.g., CNN, McDonalds, University of Alaska)                                                          |
   * | political_affiliation     | Terms referring to a political party, movement, or ideology (e.g., Republican, Liberal)                                       |
   * | occupation                | Job title or profession (e.g., professor, actors, engineer, CPA)                                                              |
   * | religion                  | Terms indicating religious affiliation (e.g., Hindu, Catholic)                                                                |
   * | drivers_license           | Driver’s license number (e.g., DL# 356933-540)                                                                                |
   * | banking_information       | Banking information, including account and routing numbers                                                                    |
   */
  redact_pii_policies?: string[];
  /**
   * The replacement logic for detected PII, can be `"entity_type"` or `"hash"`.
   */
  redact_pii_sub?: string;
  /**
   * Enable Speaker Diarization, can be `true` or `false`.
   */
  speaker_labels?: boolean;
  /**
   * Enable Content Safety Detection, can be `true` or `false`.
   */
  content_safety?: boolean;
  /**
   * Enable Topic Detection, can be `true` or `false`.
   */
  iab_categories?: boolean;
  /**
   * Customize how words are spelled and formatted using `to` and `from` values.
   */
  custom_spelling?: CustomSpelling[];
  /**
   * Transcribe Filler Words, like "umm", in your media file; can be `true` or `false`.
   */
  disfluencies?: boolean;
  /**
   * Enable Sentiment Analysis, can be `true` or `false`.
   */
  sentiment_analysis?: boolean;
  /**
   * Enable Auto Chapters, can be `true` or `false`.
   */
  auto_chapters?: boolean;
  /**
   * Enable Entity Detection, can be `true` or `false`.
   */
  entity_detection?: boolean;
  /**
   * Enable Automatic Transcript Highlights, can be `true` or `false`.
   */
  auto_highlights?: boolean;
}
