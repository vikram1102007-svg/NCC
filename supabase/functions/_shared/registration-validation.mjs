const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,18}[0-9]$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeRegistrationPayload(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    eventSlug: String(source.eventSlug ?? "").trim().toLowerCase(),
    categoryCode: String(source.categoryCode ?? "").trim().toLowerCase(),
    idempotencyKey: String(source.idempotencyKey ?? "").trim(),
    contactName: String(source.contactName ?? "").trim(),
    contactEmail: String(source.contactEmail ?? "").trim().toLowerCase(),
    contactPhone: String(source.contactPhone ?? "").trim(),
    institutionName: String(source.institutionName ?? "").trim(),
    teamName: String(source.teamName ?? "").trim(),
    memberNames: Array.isArray(source.memberNames)
      ? source.memberNames.map((name) => String(name ?? "").trim())
      : source.memberNames
  };
}

export function validateRegistrationPayload(input) {
  const value = normalizeRegistrationPayload(input);
  const errors = {};
  if (!isPlainObject(input)) errors.payload = "Registration details must be sent as an object.";

  if (!SLUG_PATTERN.test(value.eventSlug) || value.eventSlug.length > 80) errors.eventSlug = "Choose a valid event.";
  if (!SLUG_PATTERN.test(value.categoryCode) || value.categoryCode.length > 80) errors.categoryCode = "Choose a valid category.";
  if (!UUID_PATTERN.test(value.idempotencyKey)) errors.idempotencyKey = "The registration session is invalid. Refresh and try again.";
  if (value.contactName.length < 2 || value.contactName.length > 100) errors.contactName = "Enter a name between 2 and 100 characters.";
  if (value.contactEmail.length > 254 || !EMAIL_PATTERN.test(value.contactEmail)) errors.contactEmail = "Enter a valid email address.";
  if (!PHONE_PATTERN.test(value.contactPhone) || value.contactPhone.length > 20) errors.contactPhone = "Enter a valid contact number.";
  if (value.institutionName.length < 2 || value.institutionName.length > 160) errors.institutionName = "Enter an institution name between 2 and 160 characters.";
  if (value.teamName.length > 100) errors.teamName = "Team name must be 100 characters or fewer.";
  if (!Array.isArray(value.memberNames) || value.memberNames.length > 25) {
    errors.memberNames = "Enter a valid team member list.";
  } else if (value.memberNames.some((name) => name.length < 2 || name.length > 100)) {
    errors.memberNames = "Each team member name must be between 2 and 100 characters.";
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}
