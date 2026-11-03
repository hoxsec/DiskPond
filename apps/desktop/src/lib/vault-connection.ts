export function connectionErrorKey(code?: string) {
  switch (code) {
    case "INVALID_PASSWORD":
      return "password";
    case "REPOSITORY_EXISTS":
      return "exists";
    case "ALREADY_INITIALIZED":
    case "DESTINATION_NOT_EMPTY":
      return "notEmpty";
    case "NOT_INITIALIZED":
      return "missing";
    case "DUPLICATE_VAULT":
      return "duplicate";
    case "INVALID_REPOSITORY":
      return "invalid";
    case "STORAGE_MISSING":
      return "destinationMissing";
    default:
      return "unavailable";
  }
}
