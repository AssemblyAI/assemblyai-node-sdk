/**
 * # Entity Detection
 *
 * With Entity Detection, you can identify a wide range of entities that are spoken in your audio files,
 * such as person and company names, email addresses, dates, and locations.
 *
 * To include Entity Detection in your transcript response, add the entity_detection parameter in your
 * POST request when submitting audio files for transcription, and set this parameter to true.
 *
 * When your transcription is complete, you will see an entities key in the JSON response, as shown on
 * the right. Below, we drill into the data that is returned within the list of results in the entities key.
 *
 * ## Entity Types Detected
 *
 * When Entity Detection is enabled, the entity types listed below are automatically detected and, if found
 * in the transcription text, will be included in the entities key as shown above.
 * They will be listed individually in the order that they appear in the transcript.
 *
 * |Entity Name|Description|
 * |:----|:----|
 * |`blood_type`|Blood type (e.g., O-, AB positive)|
 * |`credit_card_cvv`|Credit card verification code (e.g., CVV: 080)|
 * |`credit_card_expiration`|Expiration date of a credit card|
 * |`credit_card_number`|Credit card number|
 * |`date`|Specific calendar date (e.g., December 18)|
 * |`date_of_birth`|Date of Birth (e.g., Date of Birth: March 7, 1961)|
 * |`drug`|Medications, vitamins, or supplements (e.g., Advil, Acetaminophen, Panadol)|
 * |`event`|Name of an event or holiday (e.g., Olympics, Yom Kippur)|
 * |`email_address`|Email address (e.g., [support@assemblyai.com](mailto:support@assemblyai.com "undefined"))|
 * |`injury`|Bodily injury (e.g., I broke my arm, I have a sprained wrist)|
 * |`language`|Name of a natural language (e.g., Spanish, French)|
 * |`location`|Any Location reference including mailing address, postal code, city, state, province, or country|
 * |`medical_condition`|Name of a medical condition, disease, syndrome, deficit, or disorder (e.g., chronic fatigue syndrome, arrhythmia, depression)|
 * |`medical_process`|Medical process, including treatments, procedures, and tests (e.g., heart surgery, CT scan)|
 * |`money_amount`|Name and/or amount of currency (e.g., 15 pesos, $94.50)|
 * |`nationality`|Terms indicating nationality, ethnicity, or race (e.g., American, Asian, Caucasian)|
 * |`occupation`|Job title or profession (e.g., professor, actors, engineer, CPA)|
 * |`organization`|Name of an organization (e.g., CNN, McDonalds, University of Alaska)|
 * |`person_age`|Number associated with an age (e.g., 27, 75)|
 * |`person_name`|Name of a person (e.g., Bob, Doug Jones)|
 * |`phone_number`|Telephone or fax number|
 * |`political_affiliation`|Terms referring to a political party, movement, or ideology (e.g., Republican, Liberal)|
 * |`religion`|Terms indicating religious affiliation (e.g., Hindu, Catholic)|
 * |`us_social_security_number`|Social Security Number or equivalent|
 * |`drivers_license`|Driver’s license number (e.g., DL# 356933-540)|
 * |`banking_information`|Banking information, including account and routing numbers|
 */
export class Entity {
  /**
   * Starting timestamp, in milliseconds, of the entity in the transcript.
   */
  start?: number;
  /**
   * Ending timestamp, in milliseconds, of the entity in the transcript.
   */
  end?: number;
  /**
   * The text containing the entity.
   */
  text?: string;
  /**
   * The entity type detected.
   */
  entity_type?: string;
}
