const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,18}[0-9]$/;

export function normalizeRegistrationPayload(input = {}) {
  return {
    eventSlug: String(input.eventSlug ?? "").trim().toLowerCase(),
    categoryCode: String(input.categoryCode ?? "").trim().toLowerCase(),
    idempotencyKey: String(input.idempotencyKey ?? "").trim(),
    contactName: String(input.contactName ?? "").trim(),
    contactEmail: String(input.contactEmail ?? "").trim().toLowerCase(),
    contactPhone: String(input.contactPhone ?? "").trim(),
    institutionName: String(input.institutionName ?? "").trim(),
    teamName: String(input.teamName ?? "").trim(),
    memberNames: Array.isArray(input.memberNames)
      ? input.memberNames.map((name) => String(name ?? "").trim())
      : input.memberNames
  };
}

export function validateRegistrationPayload(input) {
  const value = normalizeRegistrationPayload(input);
  const errors = {};

  if (!SLUG_PATTERN.test(value.eventSlug) || value.eventSlug.length > 80) {
    errors.eventSlug = "Choose a valid event.";
  }
  if (!SLUG_PATTERN.test(value.categoryCode) || value.categoryCode.length > 80) {
    errors.categoryCode = "Choose a valid category.";
  }
  if (!UUID_PATTERN.test(value.idempotencyKey)) {
    errors.idempotencyKey = "The registration session is invalid. Refresh and try again.";
  }
  if (value.contactName.length < 2 || value.contactName.length > 100) {
    errors.contactName = "Enter a name between 2 and 100 characters.";
  }
  if (value.contactEmail.length > 254 || !EMAIL_PATTERN.test(value.contactEmail)) {
    errors.contactEmail = "Enter a valid email address.";
  }
  if (!PHONE_PATTERN.test(value.contactPhone) || value.contactPhone.length > 20) {
    errors.contactPhone = "Enter a valid contact number.";
  }
  if (value.institutionName.length < 2 || value.institutionName.length > 160) {
    errors.institutionName = "Enter an institution name between 2 and 160 characters.";
  }
  if (value.teamName.length > 100) {
    errors.teamName = "Team name must be 100 characters or fewer.";
  }
  if (!Array.isArray(value.memberNames) || value.memberNames.length > 25) {
    errors.memberNames = "Enter a valid team member list.";
  } else if (value.memberNames.some((name) => name.length < 2 || name.length > 100)) {
    errors.memberNames = "Each team member name must be between 2 and 100 characters.";
  }

  return { ok: Object.keys(errors).length === 0, errors, value };
}
