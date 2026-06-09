/** Frontend types for the flow YAML validation contract (`/api/flows/validate-yaml`). */

/** One validation error against a YAML flow document. */
export interface YamlError {
  /** Dot/bracket path into the document, e.g. `flow.nodes['drafter'].user_model`. */
  path: string;
  message: string;
}

/** Result of validating a YAML flow document. Always returned with HTTP 200. */
export interface YamlValidationResult {
  valid: boolean;
  errors: YamlError[];
}
