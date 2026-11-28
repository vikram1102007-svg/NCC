// KPRIET NCC Two-Day Event Frontend Controller (talks only to /api/*; zero localStorage data storage).
const $ = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeCsvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text.trimStart()) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function buildCsv(regs, eventsMap = {}) {
  const rows = [
    ["Reference", "Token", "Name", "Email", "RegimentalNo", "Event", "TeamName", "Status", "Attended"],
    ...regs.map((r) => [
      r.id || r._id,
      r.token || "",
      r.participantName || r.name || "",
      r.email || "",
      r.regimentalNo || "",
      eventsMap[r.eventId]?.title || r.eventTitle || r.eventId || "",
      r.teamName || "",
      r.status || "",
      r.attended ? "Present" : "Absent"
    ])
  ];
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\r\n");
}

function computeStats(regs, events = []) {
  const active = regs.filter((r) => r.status !== "Cancelled");
  const attended = active.filter((r) => Boolean(r.attended)).length;
  const seatsFilled = events.length
    ? events.reduce((sum, ev) => sum + (Number(ev.registeredCount) || 0), 0)
    : active.length;
  const totalCapacity = events.reduce((sum, ev) => sum + (Number(ev.capacity) || 0), 0);
  return {
    total: active.length,
    attended,
    cancelled: regs.length - active.length,
    seatsFilled,
    totalCapacity
  };
}

function showMessage(id, text, kind = "success") {
  const el = $(id);
  if (el) {
    el.textContent = text;
    el.className = "message" + (kind === "error" ? " error" : kind === "info" ? " info" : "");
    el.style.display = text ? "block" : "none";
  }
  if (text && typeof window !== "undefined" && window.NCCUI?.showToast) {
    window.NCCUI.showToast(text, kind);
  }
}

async function confirmAction(title, message, confirmLabel = "Confirm") {
  if (typeof window !== "undefined" && window.NCCUI?.confirmModal) {
    return window.NCCUI.confirmModal(title, message, confirmLabel);
  }
  return window.confirm(message);
}

async function apiJson(url, options = {}) {
  const fetchOpts = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(options.headers || {}) }
  };
  if (options.body !== undefined) {
    fetchOpts.headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, fetchOpts);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: "Unexpected response from server." };
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function applySettingsToDom(settings) {
  if (!settings || typeof document === "undefined") return;
  document.querySelectorAll("[data-setting]").forEach((el) => {
    const key = el.getAttribute("data-setting");
    if (key && settings[key]) {
      el.textContent = String(settings[key]);
    }
  });
}

function createEventCardHtml(ev, showSeatBar) {
  const isLocked = ev.id === "firing" || ev.requiresApproval || !ev.registrationOpen;
  const isFull = !isLocked && ev.seatsLeft <= 0;
  const pct = ev.capacity > 0 ? Math.min(100, Math.round((ev.registeredCount / ev.capacity) * 100)) : 0;

  let pillClass = "pill pill-olive";
  let badgeText = ev.teamSizeLabel || ev.type;
  if (isLocked) {
    pillClass = "pill pill-gold";
    badgeText = "Subject to approvals";
  }

  let statusText = "Open";
  if (isLocked) statusText = "Subject to approvals";
  else if (isFull) statusText = "Full";

  const registerBtn =
    !isLocked && !isFull
      ? `<a class="btn btn-primary btn-sm" href="register.html?event=${encodeURIComponent(ev.id)}">Register →</a>`
      : "";

  const meterHtml = showSeatBar
    ? `<div class="seat-meter">
        <div class="seat-meter-head">
          <span>${isLocked ? "Subject to approvals" : `${ev.seatsLeft} of ${ev.capacity} seats left`}</span>
          <span>${escapeHtml(ev.timeText || "")}</span>
        </div>
        <div class="seat-track"><div class="seat-fill" style="width:${Math.max(6, pct)}%"></div></div>
      </div>`
    : "";

  return `
    <article id="${escapeHtml(ev.id)}" class="card card-hover event-card" data-event-card data-day="${ev.day}" data-event-slug="${escapeHtml(ev.id)}">
      <div>
        <div class="reg-actions" style="justify-content:space-between">
          <span class="pill pill-navy">Day ${ev.day}</span>
          <span class="${pillClass}">${escapeHtml(badgeText)}</span>
        </div>
        <h3>${escapeHtml(ev.title)}${ev.id === "firing" ? " (Subject to approvals)" : ""}</h3>
        <p>${escapeHtml(ev.description)}</p>
        ${meterHtml}
      </div>
      <div class="event-card-footer">
        <strong>${escapeHtml(statusText)}</strong>
        <div class="reg-actions">
          <a class="btn btn-secondary btn-sm" href="event.html?id=${encodeURIComponent(ev.id)}">Criteria</a>
          ${registerBtn}
        </div>
      </div>
    </article>
  `;
}

async function initHomePage(bootstrap) {
  if (document.body.dataset.page !== "home") return;
  const events = bootstrap.events || [];

  const plannedEl = $("home-planned-count");
  const openEl = $("home-open-count");
  const exploreEl = $("home-explore-events-link");
  if (plannedEl) plannedEl.textContent = String(events.length);
  if (openEl) {
    const openCount = events.filter((e) => e.registrationOpen && !e.requiresApproval && e.id !== "firing").length;
    openEl.textContent = String(openCount);
  }
  if (exploreEl) exploreEl.textContent = `Explore all ${events.length} events →`;

  const grid = $("home-events-grid");
  if (grid) {
    grid.innerHTML = events.map((ev) => createEventCardHtml(ev, true)).join("");
  }

  const day1 = $("home-day1-list");
  const day2 = $("home-day2-list");
  const renderList = (list, darkText) =>
    list
      .map(
        (ev) => `
      <li>
        <span class="timeline-time">${escapeHtml(ev.timeText || "TBA")}</span>
        <div>
          <strong>${escapeHtml(ev.title)}${ev.requiresApproval || ev.id === "firing" ? " (Subject to approvals)" : ""}</strong>
          <p style="font-size:13px;color:${darkText ? "var(--ink-600)" : "var(--ink-on-dark-muted)"}">${escapeHtml(ev.venue || "")}</p>
        </div>
      </li>
    `
      )
      .join("");

  if (day1) day1.innerHTML = renderList(events.filter((e) => e.day === 1), false);
  if (day2) day2.innerHTML = renderList(events.filter((e) => e.day === 2), true);
}

async function initEventsPage(bootstrap) {
  if (document.body.dataset.page !== "events") return;
  const grid = $("events-grid");
  const skeleton = $("events-skeleton");
  const empty = $("events-empty");
  if (!grid) return;

  const events = bootstrap.events || [];
  grid.innerHTML = events.map((ev) => createEventCardHtml(ev, true)).join("");
  if (skeleton) skeleton.classList.add("hidden");
  grid.classList.remove("hidden");

  const allChip = document.querySelector('[data-day-filter="all"]');
  if (allChip) allChip.textContent = `All Days (${events.length})`;

  let activeDay = "all";
  const search = $("events-search");
  const chips = document.querySelectorAll("[data-day-filter]");

  const applyFilter = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const cards = [...grid.querySelectorAll("[data-event-card]")];
    let visible = 0;
    cards.forEach((card) => {
      const dayMatch = activeDay === "all" || card.dataset.day === activeDay;
      const textMatch = !q || card.textContent.toLowerCase().includes(q);
      const show = dayMatch && textMatch;
      card.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });
    if (empty) empty.classList.toggle("hidden", visible > 0);
  };

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeDay = chip.dataset.dayFilter || "all";
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      applyFilter();
    });
  });
  search?.addEventListener("input", applyFilter);
}

async function initEventDetailPage(bootstrap) {
  if (document.body.dataset.page !== "event-detail") return;
  const events = bootstrap.events || [];
  const id = new URLSearchParams(window.location.search).get("id") || "drill";
  const ev = events.find((item) => item.id === id) || events[0];
  if (!ev) return;

  const isLocked = ev.id === "firing" || ev.requiresApproval || !ev.registrationOpen;
  const canRegister = !isLocked && ev.seatsLeft > 0;

  if ($("detail-badge")) $("detail-badge").textContent = `Day ${ev.day} · ${ev.statusLabel}`;
  if ($("detail-title")) {
    $("detail-title").textContent = `${ev.title}${isLocked && ev.id === "firing" ? " (Subject to approvals)" : ""}`;
  }
  if ($("detail-summary")) $("detail-summary").textContent = ev.description;
  if ($("detail-date")) $("detail-date").textContent = ev.dateText;
  if ($("detail-time")) $("detail-time").textContent = ev.timeText;
  if ($("detail-venue")) $("detail-venue").textContent = ev.venue;
  if ($("detail-type")) $("detail-type").textContent = `${ev.type} (${ev.teamSizeLabel})`;
  if ($("detail-status-pill")) $("detail-status-pill").textContent = ev.statusLabel;

  const seatsText = isLocked
    ? "Registration is not open (subject to approvals)"
    : `${ev.seatsLeft} of ${ev.capacity} seats remaining`;
  if ($("detail-seats")) $("detail-seats").textContent = seatsText;
  const bar = $("detail-seats-bar");
  if (bar && ev.capacity > 0) {
    bar.style.width = `${Math.max(8, Math.round((ev.registeredCount / ev.capacity) * 100))}%`;
  }

  const note = $("detail-approval-note");
  if (note && isLocked) {
    note.textContent = "Registration is not open. This activity is strictly subject to approvals from the organising unit and authorised safety officers.";
    note.classList.remove("hidden");
  }

  const btnDesktop = $("detail-register-btn");
  const mobileBar = $("detail-mobile-bar");
  const btnMobile = $("detail-mobile-register");
  if (canRegister) {
    const href = `register.html?event=${encodeURIComponent(ev.id)}`;
    if (btnDesktop) {
      btnDesktop.href = href;
      btnDesktop.classList.remove("hidden");
    }
    if (btnMobile && mobileBar) {
      btnMobile.href = href;
      mobileBar.classList.remove("hidden");
    }
  } else {
    btnDesktop?.classList.add("hidden");
    mobileBar?.classList.add("hidden");
  }

  const list = $("detail-criteria");
  if (list) {
    list.innerHTML = "";
    (ev.criteria || []).forEach((item) => {
      const li = document.createElement("li");
      const icon = document.createElement("span");
      icon.className = "criteria-check";
      icon.textContent = "✓";
      const text = document.createElement("span");
      text.textContent = item;
      li.append(icon, text);
      list.appendChild(li);
    });
  }
}

async function initRegisterPage(bootstrap, currentUser) {
  if (document.body.dataset.page !== "register") return;
  const form = $("register-form");
  const listEl = $("register-events-list");
  if (!form || !listEl) return;

  const events = bootstrap.events || [];
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get("event");

  let myActiveEventIds = new Set();
  if (currentUser) {
    try {
      const mine = await apiJson("/api/my/registrations");
      myActiveEventIds = new Set(
        (mine.registrations || []).filter((r) => r.status !== "Cancelled").map((r) => r.eventId)
      );
    } catch {
      myActiveEventIds = new Set();
    }

    $("account-fields")?.classList.add("hidden");
    $("privacy-consent-block")?.classList.add("hidden");
    $("register-alt-link")?.classList.add("hidden");
    ["reg-name", "reg-regno", "reg-year", "reg-dept", "reg-phone", "reg-email", "reg-password", "reg-consent"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.required = false;
        el.disabled = true;
      }
    });
    if ($("register-title")) $("register-title").textContent = "Register for Additional Event";
    if ($("register-sub")) $("register-sub").textContent = "Select any open category to add to your portal.";
    if ($("register-submit")) $("register-submit").textContent = "Register Selected Event(s) →";

    const infoBanner = $("logged-in-register-info");
    if (infoBanner) {
      infoBanner.innerHTML = `Signed in as <strong>${escapeHtml(currentUser.name)}</strong> (${escapeHtml(currentUser.email)}). <button type="button" class="btn btn-secondary btn-sm" id="switch-account-btn" style="margin-left:8px">Switch account</button>`;
      infoBanner.classList.remove("hidden");
      infoBanner.style.display = "block";
      $("switch-account-btn")?.addEventListener("click", async () => {
        await apiJson("/api/auth/logout", { method: "POST" });
        window.location.reload();
      });
    }
  }

  listEl.innerHTML = events
    .map((ev) => {
      const isLocked = ev.id === "firing" || ev.requiresApproval || !ev.registrationOpen;
      const already = myActiveEventIds.has(ev.id);
      const isFull = !isLocked && ev.seatsLeft <= 0;
      const disabled = isLocked || already || isFull;
      let subtitle = `Day ${ev.day} · ${ev.type} · ${ev.seatsLeft} of ${ev.capacity} left`;
      if (isLocked) subtitle = "Registration not open (subject to approvals)";
      else if (already) subtitle = "Already registered in your active list";
      else if (isFull) subtitle = "Full";

      const checked = !disabled && preselected === ev.id;
      return `
        <label class="event-choice" for="event-${escapeHtml(ev.id)}">
          <input id="event-${escapeHtml(ev.id)}" type="checkbox" name="event" value="${escapeHtml(ev.id)}" data-type="${escapeHtml(ev.type)}" ${disabled ? "disabled" : ""} ${checked ? "checked" : ""}>
          <span>
            <strong>${escapeHtml(ev.title)}${ev.id === "firing" ? " *" : ""}</strong>
            <small>${escapeHtml(subtitle)}</small>
          </span>
        </label>
      `;
    })
    .join("");

  if (preselected === "firing") {
    showMessage("register-msg", "Firing registration is not open. This activity is subject to approvals.", "error");
  }

  const updateTeamVisibility = () => {
    const checkedBoxes = [...document.querySelectorAll('input[name="event"]:checked:not(:disabled)')];
    const needsTeam = checkedBoxes.some((box) => box.dataset.type === "Team");
    const teamWrap = $("team-name-field");
    const teamInput = $("reg-team");
    if (teamWrap && teamInput) {
      teamWrap.classList.toggle("hidden", !needsTeam);
      teamInput.required = needsTeam;
    }
  };
  listEl.querySelectorAll('input[name="event"]').forEach((box) => {
    box.addEventListener("change", updateTeamVisibility);
  });
  updateTeamVisibility();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("register-msg", "", "info");
    const selectedIds = [...document.querySelectorAll('input[name="event"]:checked:not(:disabled)')].map((x) => x.value);
    if (!selectedIds.length) {
      return showMessage("register-msg", "Select at least one open event.", "error");
    }

    const btn = $("register-submit");
    if (btn) btn.classList.add("is-loading");
    try {
      const f = new FormData(form);
      if (!currentUser) {
        await apiJson("/api/auth/signup", {
          method: "POST",
          body: {
            name: f.get("name"),
            regimentalNo: f.get("regimentalNo"),
            year: f.get("year"),
            department: f.get("department"),
            phone: f.get("phone"),
            email: f.get("email"),
            password: f.get("password"),
            privacyConsent: Boolean($("reg-consent")?.checked)
          }
        });
      }

      await apiJson("/api/registrations", {
        method: "POST",
        body: {
          eventIds: selectedIds,
          teamName: String(f.get("teamName") || "").trim()
        }
      });

      window.location.href = "participant.html";
    } catch (err) {
      showMessage("register-msg", err.message || "Registration failed.", "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  });
}

async function initLoginPage(currentUser) {
  if (document.body.dataset.page !== "login") return;
  const form = $("login-form");
  if (!form) return;

  if (currentUser && $("already-logged-in")) {
    const banner = $("already-logged-in");
    banner.innerHTML = `Already signed in as <strong>${escapeHtml(currentUser.name)}</strong>. <a href="${currentUser.role === "admin" ? "admin.html" : "participant.html"}" style="text-decoration:underline;font-weight:700">Continue →</a>`;
    banner.classList.remove("hidden");
    banner.style.display = "block";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("login-submit");
    if (btn) btn.classList.add("is-loading");
    try {
      const f = new FormData(form);
      const res = await apiJson("/api/auth/login", {
        method: "POST",
        body: { email: f.get("email"), password: f.get("password") }
      });
      window.location.href = res.user?.role === "admin" ? "admin.html" : "participant.html";
    } catch (err) {
      showMessage("login-msg", err.message || "Invalid email or password.", "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  });
}

function renderQrCanvasToElement(canvas, token) {
  if (!canvas || typeof window.qrcode !== "function") return;
  const qr = window.qrcode(0, "M");
  qr.addData(String(token));
  qr.make();
  const count = qr.getModuleCount();
  const cell = Math.max(4, Math.floor(156 / count));
  const size = cell * count + 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#0d1b2a";
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(8 + c * cell, 8 + r * cell, cell, cell);
      }
    }
  }
}

function downloadQrPassPng(reg, settings) {
  if (typeof window.qrcode !== "function") {
    showMessage("participant-msg", "QR library is still loading. Try again in a moment.", "error");
    return;
  }
  const qr = window.qrcode(0, "M");
  qr.addData(String(reg.token)); // Opaque random token ONLY inside QR!
  qr.make();
  const count = qr.getModuleCount();
  const cell = 7;
  const qrSize = cell * count;

  const out = document.createElement("canvas");
  out.width = 520;
  out.height = qrSize + 190;
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#0d1b2a";
  ctx.fillRect(0, 0, out.width, 82);
  ctx.fillStyle = "#d9a742";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(String(settings?.collegeName || "KPR Institute of Engineering and Technology"), 24, 34);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`${settings?.eventName || "NCC Two-Day Event"} · Check-In Pass`, 24, 62);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 82, out.width, out.height - 82);

  const qrX = (out.width - qrSize) / 2;
  const qrY = 104;
  ctx.fillStyle = "#0d1b2a";
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(qrX + c * cell, qrY + r * cell, cell, cell);
      }
    }
  }

  ctx.fillStyle = "#102030";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(reg.participantName, 28, qrY + qrSize + 36);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#4b5c34";
  ctx.fillText(`Event: ${reg.eventTitle}${reg.teamName ? ` (Team: ${reg.teamName})` : ""}`, 28, qrY + qrSize + 60);
  ctx.fillStyle = "#4a5a6b";
  ctx.font = "12px monospace";
  ctx.fillText(`Ref: ${reg.id} · Token: ${reg.token}`, 28, qrY + qrSize + 82);

  const a = document.createElement("a");
  a.href = out.toDataURL("image/png");
  a.download = `KPRIET-NCC-Pass-${reg.id}.png`;
  a.click();
}

async function downloadCertificatePdf(regId) {
  if (!window.jspdf?.jsPDF) {
    showMessage("participant-msg", "PDF library is still loading. Try again cleanly.", "error");
    return;
  }
  const { certificate: cert } = await apiJson(`/api/certificates/${encodeURIComponent(regId)}`);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, 297, 210, "F");
  doc.setFillColor(244, 245, 240);
  doc.rect(12, 12, 273, 186, "F");
  doc.setDrawColor(217, 167, 66);
  doc.setLineWidth(1.3);
  doc.rect(18, 18, 261, 174);

  doc.setTextColor(75, 92, 52);
  doc.setFontSize(12);
  doc.text(cert.collegeName.toUpperCase(), 148.5, 36, { align: "center" });
  doc.setFontSize(10);
  doc.text(cert.eventName.toUpperCase(), 148.5, 44, { align: "center" });

  doc.setTextColor(13, 27, 42);
  doc.setFontSize(28);
  doc.text("CERTIFICATE OF PARTICIPATION", 148.5, 66, { align: "center" });

  doc.setFontSize(13);
  doc.setTextColor(74, 90, 107);
  doc.text("This certifies that", 148.5, 86, { align: "center" });

  doc.setFontSize(24);
  doc.setTextColor(13, 27, 42);
  doc.text(cert.participantName, 148.5, 102, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(74, 90, 107);
  doc.text(
    `Regimental No: ${cert.regimentalNo}${cert.department ? ` · ${cert.department} (${cert.year})` : ""}`,
    148.5,
    114,
    { align: "center" }
  );
  doc.text(
    `participated in ${cert.eventTitle} (${cert.eventDate})`,
    148.5,
    124,
    { align: "center" }
  );

  doc.setFontSize(11);
  doc.text(`Certificate ID: ${cert.certificateId}`, 148.5, 138, { align: "center" });

  doc.line(42, 166, 112, 166);
  doc.line(185, 166, 255, 166);
  doc.setFontSize(10);
  doc.text(cert.signatoryLeft, 77, 173, { align: "center" });
  doc.text(cert.signatoryRight, 220, 173, { align: "center" });

  doc.save(`KPRIET-NCC-Certificate-${cert.certificateId}.pdf`);
}

async function initParticipantPage(currentUser) {
  if (document.body.dataset.page !== "participant") return;
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const renderMine = async () => {
    const data = await apiJson("/api/my/registrations");
    const regs = data.registrations || [];
    const settings = data.settings || {};
    applySettingsToDom(settings);

    if ($("welcome")) $("welcome").textContent = `Welcome, ${currentUser.name}`;
    if ($("user-meta")) {
      $("user-meta").textContent = `${currentUser.regimentalNo} · ${currentUser.department} (${currentUser.year}) · ${currentUser.email}`;
    }

    const active = regs.filter((r) => r.status !== "Cancelled");
    const attended = active.filter((r) => r.attended);
    const certs = attended.filter((r) => r.certificateId);
    if ($("reg-count")) $("reg-count").textContent = String(active.length);
    if ($("reg-attended")) $("reg-attended").textContent = String(attended.length);
    if ($("reg-certs")) $("reg-certs").textContent = String(certs.length);

    const listEl = $("my-registrations");
    if (!listEl) return;

    if (!regs.length) {
      listEl.innerHTML = `<div class="empty-state">No event registrations yet. <a href="events.html" style="font-weight:700;text-decoration:underline">Browse events →</a></div>`;
      return;
    }

    listEl.innerHTML = regs
      .map((r) => {
        const isCancelled = r.status === "Cancelled";
        const statusPill = isCancelled ? "pill cancelled" : "pill";
        const attendPill = r.attended ? "pill paid" : "pill";
        const qrSection = isCancelled
          ? ""
          : `<div class="qr-pass-layout" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
              <div class="qr-frame">
                <canvas data-qr-canvas="${escapeHtml(r.id)}" aria-label="QR check-in pass"></canvas>
              </div>
              <div>
                <p class="eyebrow" style="margin-bottom:4px">Event Check-In QR Pass</p>
                <p><strong>${escapeHtml(r.participantName)}</strong></p>
                <p style="font-size:14px;color:var(--olive-700);font-weight:600">${escapeHtml(r.eventTitle)}${r.teamName ? ` · Team: ${escapeHtml(r.teamName)}` : ""}</p>
                <p style="font-size:13px;color:var(--ink-600)">${escapeHtml(settings.collegeName || "KPR Institute of Engineering and Technology")}</p>
                <p style="font-size:11px;font-family:monospace;color:var(--ink-600);margin-top:4px">Token: ${escapeHtml(r.token)}</p>
                <div class="reg-actions" style="margin-top:12px">
                  <button class="btn btn-secondary btn-sm" type="button" data-download-qr="${escapeHtml(r.id)}">Download QR Image</button>
                  ${
                    !r.attended
                      ? `<button class="btn btn-danger btn-sm" type="button" data-cancel-reg="${escapeHtml(r.id)}">Cancel Registration</button>`
                      : ""
                  }
                  ${
                    r.attended && r.certificateId
                      ? `<button class="btn btn-primary btn-sm" type="button" data-download-cert="${escapeHtml(r.certificateId)}">Certificate PDF</button>
                         <a class="btn btn-secondary btn-sm" href="certificate.html?id=${encodeURIComponent(r.certificateId)}">Verify Link</a>`
                      : ""
                  }
                </div>
              </div>
            </div>`;

        return `
          <article class="card" style="width:100%">
            <div class="registration-item" style="border:0;padding:0;box-shadow:none">
              <div>
                <h3>${escapeHtml(r.eventTitle)}</h3>
                <p>Ref: <strong>${escapeHtml(r.id)}</strong> · <span class="${statusPill}">${escapeHtml(r.status)}</span> · <span class="${attendPill}">${r.attended ? "Present" : "Not Checked In"}</span></p>
                ${r.certificateId ? `<p style="font-size:12px;color:var(--success);margin-top:4px">Certificate ID: <strong>${escapeHtml(r.certificateId)}</strong></p>` : ""}
              </div>
            </div>
            ${qrSection}
          </article>
        `;
      })
      .join("");

    regs.forEach((r) => {
      if (r.status === "Cancelled") return;
      const canvas = listEl.querySelector(`[data-qr-canvas="${CSS.escape(r.id)}"]`);
      renderQrCanvasToElement(canvas, r.token);
    });

    listEl.querySelectorAll("[data-download-qr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reg = regs.find((x) => x.id === btn.dataset.downloadQr);
        if (reg) downloadQrPassPng(reg, settings);
      });
    });

    listEl.querySelectorAll("[data-download-cert]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await downloadCertificatePdf(btn.dataset.downloadCert);
        } catch (err) {
          showMessage("participant-msg", err.message || "Could not generate PDF.", "error");
        }
      });
    });

    listEl.querySelectorAll("[data-cancel-reg]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const regId = btn.dataset.cancelReg;
        const ok = await confirmAction(
          "Cancel registration?",
          `Cancel registration ${regId}? Your seat will be released immediately.`,
          "Cancel Registration"
        );
        if (!ok) return;
        try {
          await apiJson(`/api/my/registrations/${encodeURIComponent(regId)}`, { method: "DELETE" });
          showMessage("participant-msg", `Registration ${regId} cancelled.`, "info");
          await renderMine();
        } catch (err) {
          showMessage("participant-msg", err.message || "Could not cancel registration.", "error");
        }
      });
    });
  };

  await renderMine();
}

async function initCertificatePage(bootstrap) {
  if (document.body.dataset.page !== "certificate") return;
  const form = $("cert-verify-form");
  const input = $("cert-id-input");
  const resultBox = $("cert-result");
  if (!form || !input || !resultBox) return;

  const lookup = async (certId) => {
    const clean = String(certId || "").trim();
    if (!clean) return;
    showMessage("cert-msg", "", "info");
    resultBox.classList.add("hidden");
    try {
      const { certificate: c } = await apiJson(`/api/certificates/${encodeURIComponent(clean)}`);
      resultBox.innerHTML = `
        <div class="notice" style="border-left:4px solid var(--success);background:var(--success-bg);color:var(--ink-900)">
          <p class="eyebrow" style="color:var(--success);margin-bottom:4px">✓ Verified Official Certificate</p>
          <h2 style="font-size:28px;margin-bottom:6px">${escapeHtml(c.participantName)}</h2>
          <p><strong>College:</strong> ${escapeHtml(c.collegeName)}</p>
          <p><strong>Event:</strong> ${escapeHtml(c.eventTitle)} (${escapeHtml(c.eventDate)})</p>
          <p><strong>Regimental No:</strong> ${escapeHtml(c.regimentalNo)}${c.department ? ` · ${escapeHtml(c.department)} (${escapeHtml(c.year)})` : ""}</p>
          <p><strong>Certificate ID:</strong> <span style="font-family:monospace">${escapeHtml(c.certificateId)}</span></p>
          <p><strong>Signatories:</strong> ${escapeHtml(c.signatoryLeft)} &amp; ${escapeHtml(c.signatoryRight)}</p>
        </div>
      `;
      resultBox.classList.remove("hidden");
    } catch (err) {
      showMessage("cert-msg", err.message || "Certificate not found.", "error");
    }
  };

  const paramId = new URLSearchParams(window.location.search).get("id");
  if (paramId) {
    input.value = paramId;
    await lookup(paramId);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await lookup(input.value);
  });
}

async function initAdminPage(currentUser) {
  if (document.body.dataset.page !== "admin") return;
  const loginSection = $("admin-login");
  const panelSection = $("admin-panel");
  const adminForm = $("admin-form");
  if (!loginSection || !panelSection || !adminForm) return;

  let html5Scanner = null;
  let scannerActive = false;

  const stopScanner = async () => {
    const wrap = $("qr-reader-wrap");
    const toggleBtn = $("toggle-qr-scanner");
    if (html5Scanner && scannerActive) {
      try {
        await html5Scanner.stop();
      } catch {
        // ignore stop errors
      }
    }
    scannerActive = false;
    wrap?.classList.add("hidden");
    if (toggleBtn) toggleBtn.textContent = "Start Camera Scanner";
  };

  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("admin-login-btn");
    if (btn) btn.classList.add("is-loading");
    try {
      const f = new FormData(adminForm);
      const res = await apiJson("/api/auth/login", {
        method: "POST",
        body: { email: f.get("email"), password: f.get("password") }
      });
      if (res.user?.role !== "admin") {
        showMessage("admin-msg", "Access denied (403): Organiser / Admin privileges required.", "error");
        return;
      }
      window.location.reload();
    } catch (err) {
      showMessage("admin-msg", err.message || "Invalid email or password.", "error");
    } finally {
      if (btn) btn.classList.remove("is-loading");
    }
  });

  if (!currentUser) {
    return;
  }
  if (currentUser.role !== "admin") {
    showMessage(
      "admin-msg",
      `Signed in as ${currentUser.email}. Access denied (403): Admin privileges required.`,
      "error"
    );
    return;
  }

  loginSection.classList.add("hidden");
  panelSection.classList.remove("hidden");
  if ($("admin-identity")) $("admin-identity").textContent = `Signed in as ${currentUser.name} (${currentUser.email})`;

  let overview = null;

  const showCheckinResult = (valid, headline, detail = "") => {
    const box = $("checkin-result-box");
    if (!box) return;
    box.className = `checkin-result ${valid ? "checkin-result--valid" : "checkin-result--invalid"}`;
    box.innerHTML = `<strong>${escapeHtml(headline)}</strong>${detail ? ` — ${escapeHtml(detail)}` : ""}`;
    box.classList.remove("hidden");
  };

  const submitCheckinToken = async (rawToken) => {
    const clean = String(rawToken || "").trim();
    if (!clean) return;
    try {
      const res = await apiJson("/api/admin/checkin", {
        method: "POST",
        body: { token: clean }
      });
      showCheckinResult(
        true,
        "Valid",
        `${res.registration.participantName} · ${res.registration.eventTitle} · Cert ${res.registration.certificateId}`
      );
      await loadOverview();
    } catch (err) {
      showCheckinResult(false, "Invalid or already used", err.message || "");
    }
  };

  const renderRoster = () => {
    if (!overview) return;
    const regs = overview.registrations || [];
    const q = ($("admin-search")?.value || "").trim().toLowerCase();
    const evFilter = $("admin-filter-event")?.value || "all";
    const statusFilter = $("admin-filter-status")?.value || "all";

    const filtered = regs.filter((r) => {
      if (evFilter !== "all" && r.eventId !== evFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.id, r.token, r.participantName, r.email, r.regimentalNo, r.department, r.eventTitle, r.teamName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const tbody = $("admin-rows");
    const mobileList = $("admin-mobile-roster");

    if (tbody) {
      tbody.innerHTML = filtered.length
        ? filtered
            .map(
              (r) => `
          <tr>
            <td>
              <strong>${escapeHtml(r.id)}</strong>
              <div style="font-size:11px;font-family:monospace;color:var(--ink-600)">${escapeHtml(r.token)}</div>
            </td>
            <td>
              <strong>${escapeHtml(r.participantName)}</strong>
              <div style="font-size:12px;color:var(--ink-600)">${escapeHtml(r.regimentalNo)} · ${escapeHtml(r.department)} (${escapeHtml(r.year)})</div>
              <div style="font-size:11px;color:var(--ink-600)">${escapeHtml(r.email)} · ${escapeHtml(r.phone)}</div>
            </td>
            <td>
              <strong>${escapeHtml(r.eventTitle)}</strong>
              ${r.teamName ? `<div style="font-size:12px;color:var(--olive-700)">Team: ${escapeHtml(r.teamName)}</div>` : ""}
            </td>
            <td>
              <select aria-label="Status for ${escapeHtml(r.id)}" data-reg-status="${escapeHtml(r.id)}">
                <option value="Registered" ${r.status === "Registered" ? "selected" : ""}>Registered</option>
                <option value="Confirmed" ${r.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                <option value="Cancelled" ${r.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
              </select>
            </td>
            <td>
              <input type="checkbox" aria-label="Mark ${escapeHtml(r.participantName)} present" data-reg-attend="${escapeHtml(r.id)}" ${r.attended ? "checked" : ""} style="width:20px;height:20px">
            </td>
            <td>${r.certificateId ? `<span style="font-family:monospace;font-size:12px">${escapeHtml(r.certificateId)}</span>` : "—"}</td>
          </tr>
        `
            )
            .join("")
        : `<tr><td colspan="6" class="empty-state">No registrations match your filter.</td></tr>`;
    }

    if (mobileList) {
      mobileList.innerHTML = filtered.length
        ? filtered
            .map(
              (r) => `
          <article class="mobile-roster-card">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
              <div>
                <strong>${escapeHtml(r.participantName)}</strong>
                <div style="font-size:12px;color:var(--ink-600)">${escapeHtml(r.regimentalNo)} · ${escapeHtml(r.department)}</div>
              </div>
              <span class="pill pill-navy">${escapeHtml(r.eventTitle)}</span>
            </div>
            <div style="font-size:12px;color:var(--ink-600)">${escapeHtml(r.id)} · ${r.teamName ? `Team: ${escapeHtml(r.teamName)}` : escapeHtml(r.email)}</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
              <select aria-label="Mobile status for ${escapeHtml(r.id)}" data-reg-status="${escapeHtml(r.id)}" style="min-height:44px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff">
                <option value="Registered" ${r.status === "Registered" ? "selected" : ""}>Registered</option>
                <option value="Confirmed" ${r.status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                <option value="Cancelled" ${r.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
              </select>
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;min-height:44px">
                <input type="checkbox" data-reg-attend="${escapeHtml(r.id)}" ${r.attended ? "checked" : ""} style="width:20px;height:20px">
                Present
              </label>
            </div>
          </article>
        `
            )
            .join("")
        : `<div class="empty-state">No registrations match your filter.</div>`;
    }

    document.querySelectorAll("[data-reg-status]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await apiJson(`/api/admin/registrations/${encodeURIComponent(sel.dataset.regStatus)}`, {
            method: "PATCH",
            body: { status: sel.value }
          });
          showMessage("admin-panel-msg", `Updated status for ${sel.dataset.regStatus}.`);
          await loadOverview();
        } catch (err) {
          showMessage("admin-panel-msg", err.message, "error");
          await loadOverview();
        }
      });
    });

    document.querySelectorAll("[data-reg-attend]").forEach((chk) => {
      chk.addEventListener("change", async () => {
        try {
          await apiJson(`/api/admin/registrations/${encodeURIComponent(chk.dataset.regAttend)}`, {
            method: "PATCH",
            body: { attended: chk.checked }
          });
          showMessage(
            "admin-panel-msg",
            chk.checked ? "Attendance marked Present (certificate ID issued)." : "Attendance unmarked.",
            "info"
          );
          await loadOverview();
        } catch (err) {
          showMessage("admin-panel-msg", err.message, "error");
          await loadOverview();
        }
      });
    });
  };

  const renderEventsTab = () => {
    const listEl = $("admin-events-list");
    if (!listEl || !overview) return;
    listEl.innerHTML = (overview.events || [])
      .map(
        (ev) => `
      <article class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div>
            <h3>${escapeHtml(ev.title)}${ev.id === "firing" ? " (Subject to approvals)" : ""}</h3>
            <p style="font-size:13px;color:var(--ink-600)">Day ${ev.day} · ${escapeHtml(ev.type)} · ${ev.registeredCount}/${ev.capacity} filled · ${escapeHtml(ev.statusLabel)}</p>
          </div>
          <div class="reg-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-edit-ev="${escapeHtml(ev.id)}">Edit</button>
            <button class="btn btn-danger btn-sm" type="button" data-del-ev="${escapeHtml(ev.id)}">Delete</button>
          </div>
        </div>
      </article>
    `
      )
      .join("");

    listEl.querySelectorAll("[data-edit-ev]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ev = overview.events.find((x) => x.id === btn.dataset.editEv);
        if (!ev) return;
        $("ev-id").value = ev.id;
        $("ev-title").value = ev.title;
        $("ev-day").value = String(ev.day);
        $("ev-type").value = ev.type;
        $("ev-date").value = ev.dateText;
        $("ev-time").value = ev.timeText;
        $("ev-venue").value = ev.venue;
        $("ev-capacity").value = String(ev.capacity);
        $("ev-team-label").value = ev.teamSizeLabel;
        $("ev-open").checked = Boolean(ev.registrationOpen);
        $("ev-desc").value = ev.description;
        $("ev-criteria").value = (ev.criteria || []).join("\n");
        $("event-form-title").textContent = `Edit Event: ${ev.title}`;
        $("cancel-event-edit")?.classList.remove("hidden");
      });
    });

    listEl.querySelectorAll("[data-del-ev]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ev = overview.events.find((x) => x.id === btn.dataset.delEv);
        if (!ev) return;
        const ok = await confirmAction(
          "Delete event?",
          `Delete "${ev.title}" from the database? This cannot be undone.`,
          "Delete Event"
        );
        if (!ok) return;
        try {
          await apiJson(`/api/admin/events/${encodeURIComponent(ev.id)}`, { method: "DELETE" });
          showMessage("admin-panel-msg", `Deleted ${ev.title}.`, "info");
          await loadOverview();
        } catch (err) {
          showMessage("admin-panel-msg", err.message, "error");
        }
      });
    });
  };

  async function loadOverview() {
    overview = await apiJson("/api/admin/overview");
    applySettingsToDom(overview.settings);

    const s = overview.stats || {};
    if ($("admin-total")) $("admin-total").textContent = String(s.total || 0);
    if ($("admin-seats")) $("admin-seats").textContent = `${s.seatsFilled || 0} / ${s.totalCapacity || 0}`;
    if ($("admin-attended")) $("admin-attended").textContent = String(s.attended || 0);

    const evStats = $("admin-event-stats");
    if (evStats) {
      evStats.innerHTML = (overview.events || [])
        .map((ev) => {
          const evAttended = (overview.registrations || []).filter(
            (r) => r.eventId === ev.id && r.status !== "Cancelled" && r.attended
          ).length;
          return `
          <article class="card">
            <strong>${escapeHtml(ev.title)}</strong>
            <p style="font-size:13px;color:var(--ink-600);margin-top:4px">${ev.registeredCount} / ${ev.capacity} seats filled · ${evAttended} attended</p>
          </article>`;
        })
        .join("");
    }

    const evFilter = $("admin-filter-event");
    if (evFilter) {
      const current = evFilter.value || "all";
      evFilter.innerHTML =
        `<option value="all">All events</option>` +
        (overview.events || []).map((e) => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.title)}</option>`).join("");
      evFilter.value = current;
    }

    const sett = overview.settings || {};
    if ($("set-event-name")) $("set-event-name").value = sett.eventName || "";
    if ($("set-short-name")) $("set-short-name").value = sett.collegeShortName || "";
    if ($("set-college-name")) $("set-college-name").value = sett.collegeName || "";
    if ($("set-dates")) $("set-dates").value = sett.datesText || "";
    if ($("set-venue")) $("set-venue").value = sett.venueText || "";
    if ($("set-contact-name")) $("set-contact-name").value = sett.contactName || "";
    if ($("set-contact-phone")) $("set-contact-phone").value = sett.contactPhone || "";
    if ($("set-contact-email")) $("set-contact-email").value = sett.contactEmail || "";
    if ($("set-sig-left")) $("set-sig-left").value = sett.signatoryLeft || "";
    if ($("set-sig-right")) $("set-sig-right").value = sett.signatoryRight || "";

    const userSelect = $("reset-user-select");
    if (userSelect) {
      const participants = (overview.users || []).filter((u) => u.role !== "admin");
      userSelect.innerHTML = participants.length
        ? participants
            .map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} (${escapeHtml(u.email)} · ${escapeHtml(u.regimentalNo)})</option>`)
            .join("")
        : `<option value="">No participants registered yet</option>`;
    }

    renderRoster();
    renderEventsTab();
  }

  // Tabs switching
  const tabNames = ["registrations", "events", "settings", "users"];
  document.querySelectorAll("[data-admin-tab]").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const target = tabBtn.dataset.adminTab;
      document.querySelectorAll("[data-admin-tab]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === tabBtn));
      });
      tabNames.forEach((name) => {
        const panel = $(`admin-tab-${name}`);
        if (panel) panel.classList.toggle("hidden", name !== target);
      });
      if (target !== "registrations") stopScanner();
    });
  });

  $("admin-search")?.addEventListener("input", renderRoster);
  $("admin-filter-event")?.addEventListener("change", renderRoster);
  $("admin-filter-status")?.addEventListener("change", renderRoster);

  $("admin-checkin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("checkin-token-input");
    if (!input) return;
    await submitCheckinToken(input.value);
    input.value = "";
  });

  $("toggle-qr-scanner")?.addEventListener("click", async () => {
    if (scannerActive) {
      await stopScanner();
      return;
    }
    if (typeof window.Html5Qrcode !== "function") {
      showMessage("admin-panel-msg", "QR camera library is not loaded yet.", "error");
      return;
    }
    const wrap = $("qr-reader-wrap");
    const btn = $("toggle-qr-scanner");
    wrap?.classList.remove("hidden");
    try {
      html5Scanner = new window.Html5Qrcode("qr-reader");
      await html5Scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          await stopScanner();
          await submitCheckinToken(decodedText);
        },
        () => {}
      );
      scannerActive = true;
      if (btn) btn.textContent = "Stop Camera";
    } catch (err) {
      wrap?.classList.add("hidden");
      showMessage("admin-panel-msg", "Could not access camera. Use manual token entry below.", "error");
    }
  });

  $("cancel-event-edit")?.addEventListener("click", () => {
    $("admin-event-form")?.reset();
    $("ev-id").value = "";
    $("event-form-title").textContent = "Add Event";
    $("cancel-event-edit")?.classList.add("hidden");
  });

  $("admin-event-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("ev-id").value.trim();
    const payload = {
      title: $("ev-title").value,
      day: Number($("ev-day").value),
      type: $("ev-type").value,
      dateText: $("ev-date").value,
      timeText: $("ev-time").value,
      venue: $("ev-venue").value,
      capacity: Number($("ev-capacity").value),
      teamSizeLabel: $("ev-team-label").value,
      registrationOpen: Boolean($("ev-open").checked),
      description: $("ev-desc").value,
      criteriaText: $("ev-criteria").value
    };
    try {
      if (id) {
        await apiJson(`/api/admin/events/${encodeURIComponent(id)}`, { method: "PUT", body: payload });
        showMessage("admin-panel-msg", "Updated event.");
      } else {
        await apiJson("/api/admin/events", { method: "POST", body: payload });
        showMessage("admin-panel-msg", "Created new event.");
      }
      $("admin-event-form").reset();
      $("ev-id").value = "";
      $("event-form-title").textContent = "Add Event";
      $("cancel-event-edit")?.classList.add("hidden");
      await loadOverview();
    } catch (err) {
      showMessage("admin-panel-msg", err.message, "error");
    }
  });

  $("admin-settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await apiJson("/api/admin/settings", {
        method: "PUT",
        body: {
          eventName: f.get("eventName"),
          collegeShortName: f.get("collegeShortName"),
          collegeName: f.get("collegeName"),
          datesText: f.get("datesText"),
          venueText: f.get("venueText"),
          contactName: f.get("contactName"),
          contactPhone: f.get("contactPhone"),
          contactEmail: f.get("contactEmail"),
          signatoryLeft: f.get("signatoryLeft"),
          signatoryRight: f.get("signatoryRight")
        }
      });
      showMessage("admin-panel-msg", "Settings saved to database.");
      await loadOverview();
    } catch (err) {
      showMessage("admin-panel-msg", err.message, "error");
    }
  });

  $("admin-reset-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = $("reset-user-select")?.value;
    const newPassword = $("reset-new-pass")?.value;
    if (!userId) return;
    try {
      await apiJson(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: "POST",
        body: { newPassword }
      });
      $("reset-new-pass").value = "";
      showMessage("admin-panel-msg", "Participant password updated.");
    } catch (err) {
      showMessage("admin-panel-msg", err.message, "error");
    }
  });

  await loadOverview();
}

async function bootApp() {
  const y = $("year");
  if (y) y.textContent = String(new Date().getFullYear());

  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiJson("/api/auth/logout", { method: "POST" });
      } finally {
        window.location.href = "index.html";
      }
    });
  });

  const [bootstrap, auth] = await Promise.all([
    apiJson("/api/bootstrap"),
    apiJson("/api/auth/me").catch(() => ({ user: null }))
  ]);

  applySettingsToDom(bootstrap.settings);
  const currentUser = auth?.user || null;

  await initHomePage(bootstrap);
  await initEventsPage(bootstrap);
  await initEventDetailPage(bootstrap);
  await initRegisterPage(bootstrap, currentUser);
  await initLoginPage(currentUser);
  await initParticipantPage(currentUser);
  await initCertificatePage(bootstrap);
  await initAdminPage(currentUser);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    bootApp().catch((err) => {
      if (window.NCCUI?.showGlobalFallbackError) {
        window.NCCUI.showGlobalFallbackError(
          err?.message || "Could not load event data. Please tap Reload."
        );
      }
    });
  });
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    escapeHtml,
    sanitizeCsvCell,
    buildCsv,
    computeStats
  };
}
