const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation.classList.toggle("is-open", !isOpen);
  });
  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuButton.setAttribute("aria-expanded", "false");
      navigation.classList.remove("is-open");
    });
  });
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());

const registrationForm = document.querySelector("#registration-form");

if (registrationForm) {
  initialiseRegistration();
}

function initialiseRegistration() {
  const config = window.NCC_CONFIG || {};
  const fieldset = document.querySelector("#registration-fields");
  const status = document.querySelector("#registration-status");
  const heading = document.querySelector("#registration-heading");
  const categorySelect = document.querySelector("#registration-category");
  const teamFields = document.querySelector("#team-fields");
  const teamNameInput = document.querySelector("#team-name");
  const memberNamesInput = document.querySelector("#member-names");
  const submitButton = document.querySelector("#registration-submit");
  const resultPanel = document.querySelector("#registration-result");
  const referenceOutput = document.querySelector("#registration-reference");
  let idempotencyKey = null;
  let activeEvent = null;
  let categories = [];

  const setStatus = (message, kind = "info") => {
    status.textContent = message;
    status.dataset.state = kind;
  };

  const setFormEnabled = (enabled) => {
    fieldset.disabled = !enabled;
    submitButton.disabled = !enabled;
  };

  if (config.registrationEnabled !== true) {
    setStatus("Registration is closed. The event committee must approve the event details, participant fields and privacy notice before this form can collect information.");
    return;
  }

  if (!config.supabaseUrl || !config.publishableKey || !config.eventSlug || config.privacyNoticeApproved !== true) {
    setStatus("Registration setup is incomplete. The organiser must approve the privacy notice and the public database configuration before registration can open.", "warning");
    return;
  }

  let apiBase;
  try {
    const parsed = new URL(config.supabaseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("Supabase URL must use HTTPS.");
    }
    apiBase = parsed.origin;
  } catch {
    setStatus("The registration service URL is invalid. Please contact the event organiser.", "error");
    return;
  }

  async function fetchRows(table, params) {
    const url = new URL(`${apiBase}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      method: "GET",
      headers: { apikey: config.publishableKey, Accept: "application/json" },
      credentials: "omit"
    });
    if (!response.ok) throw new Error("Could not load event registration settings.");
    return response.json();
  }

  function updateCategoryFields() {
    const category = categories.find((item) => item.code === categorySelect.value);
    const isTeam = category?.registration_mode === "team";
    teamFields.hidden = !isTeam;
    teamNameInput.required = Boolean(isTeam);
    memberNamesInput.required = Boolean(isTeam);
    if (!isTeam) {
      teamNameInput.value = "";
      memberNamesInput.value = "";
    }
    if (category && isTeam) {
      memberNamesInput.setAttribute(
        "aria-description",
        `Enter between ${category.min_team_size} and ${category.max_team_size} names, one per line.`
      );
    } else {
      memberNamesInput.removeAttribute("aria-description");
    }
  }

  async function loadRegistrationSettings() {
    setStatus("Checking the event's published registration settings…");
    try {
      const events = await fetchRows("events", {
        slug: `eq.${config.eventSlug}`,
        is_published: "eq.true",
        select: "id,slug,name,registration_open,registration_starts_at,registration_ends_at",
        limit: "1"
      });
      activeEvent = events[0];
      if (!activeEvent || activeEvent.registration_open !== true) {
        setStatus("Registration is currently closed. Please wait for the official event committee announcement.");
        return;
      }

      const now = Date.now();
      if (activeEvent.registration_starts_at && now < Date.parse(activeEvent.registration_starts_at)) {
        setStatus("Registration has not started yet. Please check the official announcement.");
        return;
      }
      if (activeEvent.registration_ends_at && now > Date.parse(activeEvent.registration_ends_at)) {
        setStatus("The registration window has ended. Please contact the event organiser if you need assistance.");
        return;
      }

      categories = await fetchRows("event_categories", {
        event_id: `eq.${activeEvent.id}`,
        is_active: "eq.true",
        select: "code,name,registration_mode,min_team_size,max_team_size",
        order: "name.asc"
      });
      if (!categories.length) {
        setStatus("Registration is not available because no approved categories are currently open.");
        return;
      }

      for (const category of categories) {
        const option = document.createElement("option");
        option.value = category.code;
        option.textContent = category.name;
        categorySelect.append(option);
      }
      categorySelect.addEventListener("change", updateCategoryFields);
      updateCategoryFields();
      heading.textContent = `Register for ${activeEvent.name}`;
      setStatus("Registration is open. Complete the required fields and review your details before submitting.", "success");
      setFormEnabled(true);
    } catch (error) {
      console.error("NCC registration settings could not be loaded", error);
      setStatus("The registration service is temporarily unavailable. No information has been submitted. Please try again later.", "error");
    }
  }

  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeEvent || !registrationForm.reportValidity()) return;

    const category = categories.find((item) => item.code === categorySelect.value);
    if (!category) {
      setStatus("Choose an available event category.", "error");
      return;
    }

    const formData = new FormData(registrationForm);
    const memberNames = category.registration_mode === "team"
      ? String(formData.get("memberNames") ?? "").split("\n").map((name) => name.trim()).filter(Boolean)
      : [];

    if (category.registration_mode === "team" &&
        (memberNames.length < category.min_team_size || memberNames.length > category.max_team_size)) {
      setStatus(`This category requires ${category.min_team_size}–${category.max_team_size} team member names.`, "error");
      memberNamesInput.focus();
      return;
    }

    if (!idempotencyKey) {
      idempotencyKey = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : createFallbackUuid();
    }

    const payload = {
      eventSlug: activeEvent.slug,
      categoryCode: category.code,
      idempotencyKey,
      contactName: formData.get("contactName"),
      contactEmail: formData.get("contactEmail"),
      contactPhone: formData.get("contactPhone"),
      institutionName: formData.get("institutionName"),
      teamName: category.registration_mode === "team" ? formData.get("teamName") : "",
      memberNames,
      website: formData.get("website")
    };

    setFormEnabled(false);
    setStatus("Submitting securely. Please keep this page open…");
    try {
      const response = await fetch(`${apiBase}/functions/v1/register`, {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          "Content-Type": "application/json"
        },
        credentials: "omit",
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const messages = {
          duplicate_registration: "A registration already exists for this email and category. If you think this is a mistake, contact the event organiser.",
          registration_closed_or_full: "Registration is closed or this category has reached capacity.",
          rate_limit_exceeded: "Too many attempts. Please wait before trying again.",
          registration_not_enabled: "The organiser has temporarily closed registration.",
          registration_temporarily_unavailable: "The registration service is temporarily unavailable. Your details were not confirmed."
        };
        setStatus(messages[data.error] || "We could not submit this registration. Check the details and try again.", "error");
        setFormEnabled(true);
        return;
      }

      referenceOutput.textContent = data.registrationRef;
      resultPanel.hidden = false;
      heading.textContent = "Registration received";
      setStatus(data.created === false
        ? "This submission was already received. Your existing reference is shown below."
        : "Your registration has been received. Keep the reference shown below.", "success");
      registrationForm.reset();
      idempotencyKey = null;
      setFormEnabled(true);
      updateCategoryFields();
    } catch (error) {
      console.error("NCC registration submission failed", error);
      setStatus("We could not reach the registration service. Your submission may not have been received; retry safely using the same page.", "error");
      setFormEnabled(true);
    }
  });

  loadRegistrationSettings();
}

function createFallbackUuid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
