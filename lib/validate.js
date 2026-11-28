function cleanStr(value, maxLen = 200) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function isValidPhone(phone) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 7 && digits.length <= 16;
}

function validateSignupInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request payload." };
  }

  const name = cleanStr(body.name, 100);
  const regimentalNo = cleanStr(body.regimentalNo, 40).toUpperCase();
  const year = cleanStr(body.year, 30);
  const department = cleanStr(body.department, 80);
  const phone = cleanStr(body.phone, 24);
  const email = cleanStr(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const privacyConsent = body.privacyConsent === true;

  if (name.length < 2) return { error: "Enter your full name (at least 2 characters)." };
  if (regimentalNo.length < 3) return { error: "Enter a valid NCC regimental number." };
  if (!year) return { error: "Select your year of study." };
  if (department.length < 2) return { error: "Enter your department." };
  if (!isValidPhone(phone)) return { error: "Enter a valid phone number." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (password.length < 6 || password.length > 100) {
    return { error: "Password must be between 6 and 100 characters." };
  }
  if (!privacyConsent) {
    return { error: "Please accept the privacy notice before creating an account." };
  }

  return {
    data: { name, regimentalNo, year, department, phone, email, password, privacyConsent: true }
  };
}

function validateLoginInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid login payload." };
  }
  const email = cleanStr(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!isValidEmail(email) || !password || password.length > 100) {
    return { error: "Invalid email or password." };
  }
  return { data: { email, password } };
}

function validateRegistrationInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid registration payload." };
  }
  const rawList = Array.isArray(body.eventIds)
    ? body.eventIds
    : typeof body.eventId === "string"
      ? [body.eventId]
      : [];

  const eventIds = [...new Set(rawList.map((x) => cleanStr(x, 64).toLowerCase()).filter(Boolean))];
  if (eventIds.length === 0 || eventIds.length > 10) {
    return { error: "Select at least one valid event." };
  }
  const teamName = cleanStr(body.teamName || "", 80);
  return { data: { eventIds, teamName } };
}

function validateEventInput(body, existingId = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid event payload." };
  }
  const title = cleanStr(body.title, 120);
  if (title.length < 2) return { error: "Event title must be at least 2 characters." };

  const slug =
    existingId ||
    cleanStr(body.id || title, 60)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { error: "Event ID must contain only letters, numbers, and hyphens." };
  }

  const day = Number(body.day) === 2 ? 2 : 1;
  const dateText = cleanStr(body.dateText || `Day ${day} · Date TBA`, 80);
  const timeText = cleanStr(body.timeText || "TBA", 80);
  const venue = cleanStr(body.venue || "KPRIET Campus (TBA)", 120);
  const type = body.type === "Team" ? "Team" : "Individual";
  const teamSizeLabel = cleanStr(body.teamSizeLabel || type, 60);
  const capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) {
    return { error: "Capacity must be a whole number between 1 and 5000." };
  }
  const description = cleanStr(body.description || "", 600);
  const criteria = Array.isArray(body.criteria)
    ? body.criteria.map((c) => cleanStr(c, 220)).filter(Boolean).slice(0, 12)
    : typeof body.criteriaText === "string"
      ? body.criteriaText
          .split(/\r?\n/)
          .map((c) => cleanStr(c, 220))
          .filter(Boolean)
          .slice(0, 12)
      : [];

  // Enforce Firing lock: never allow firing to be marked open/approved automatically.
  const isFiring = slug === "firing";
  const requiresApproval = isFiring ? true : Boolean(body.requiresApproval);
  const registrationOpen = isFiring ? false : requiresApproval ? false : body.registrationOpen !== false;
  const statusLabel = isFiring || requiresApproval
    ? "Subject to approvals"
    : registrationOpen
      ? "Open"
      : "Closed";

  return {
    data: {
      _id: slug,
      title,
      day,
      dateText,
      timeText,
      venue,
      type,
      teamSizeLabel,
      capacity,
      registrationOpen,
      requiresApproval,
      statusLabel,
      description,
      criteria
    }
  };
}

function validateSettingsInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid settings payload." };
  }
  const eventName = cleanStr(body.eventName, 120);
  const collegeName = cleanStr(body.collegeName, 160);
  const collegeShortName = cleanStr(body.collegeShortName, 30);
  const datesText = cleanStr(body.datesText, 120);
  const venueText = cleanStr(body.venueText, 160);
  const contactName = cleanStr(body.contactName, 100);
  const contactEmail = cleanStr(body.contactEmail, 254);
  const contactPhone = cleanStr(body.contactPhone, 40);
  const signatoryLeft = cleanStr(body.signatoryLeft, 120);
  const signatoryRight = cleanStr(body.signatoryRight, 120);

  if (!eventName || !collegeName) {
    return { error: "Event name and college name are required." };
  }

  return {
    data: {
      eventName,
      collegeName,
      collegeShortName: collegeShortName || "KPRIET",
      datesText: datesText || "Dates To be announced",
      venueText: venueText || "Campus Venue (TBA)",
      contactName: contactName || "Associate NCC Officer",
      contactEmail: contactEmail || "ncc@kpriet.ac.in",
      contactPhone: contactPhone || "+91 00000 00000",
      signatoryLeft: signatoryLeft || "Associate NCC Officer",
      signatoryRight: signatoryRight || "Senior Under Officer"
    }
  };
}

module.exports = {
  cleanStr,
  isValidEmail,
  isValidPhone,
  validateSignupInput,
  validateLoginInput,
  validateRegistrationInput,
  validateEventInput,
  validateSettingsInput
};
