/**
 * Chat behavioral constants.
 *
 * `CONTINUE_PROMPT` is the literal user turn sent to resume an assistant
 * response that was cut off at the model's output limit (`finish_reason ===
 * 'length'`). It's a fixed protocol value, externalised here (per the
 * no-hardcoding rule) rather than inlined in the chat surface.
 */
export const CONTINUE_PROMPT = 'continue';
