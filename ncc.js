// NCC Event browser demo. This is not production authentication or storage.
const K = {
  users: "ncc_demo_users_v1",
  regs: "ncc_demo_regs_v1",
  session: "ncc_demo_session_v1",
  admin: "ncc_demo_admin_v1"
};
const FEE = 400;
const LABELS = { firing: "Firing", drill: "Drill" };
const VALID_EVENTS = new Set(["drill"]);

const $ = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);

function read(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
  return (
    "NCC-" +
    Math.random().toString(36).slice(2, 7).toUpperCase() +
    "-" +
    Date.now().toString(36).toUpperCase()
  );
}

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

function buildCsv(regs) {
  const rows = [
    ["Reference", "Name", "Email", "Event", "Fee", "Status", "Payment"],
    ...regs.map((r) => [
      r.id,
      r.name,
      r.email,
      LABELS[r.event] || r.event,
      r.fee,
      r.status,
      r.payment
    ])
  ];
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\r\n");
}

function computeStats(regs) {
  const active = regs.filter((r) => r.status !== "Cancelled");
  const paid = active.filter((r) => r.payment === "Demo paid").length;
  return {
    total: active.length,
    paid,
    pending: active.length - paid,
    cancelled: regs.length - active.length,
    feeTotal: active.reduce((sum, r) => sum + (Number(r.fee) || 0), 0)
  };
}

function showMessage(id, text, kind = "success") {
  const el = $(id);
  if (el) {
    el.textContent = text;
    el.className = "message" + (kind === "error" ? " error" : kind === "info" ? " info" : "");
    el.style.display = "block";
  }
  if (typeof window !== "undefined" && window.NCCUI && typeof window.NCCUI.showToast === "function") {
    window.NCCUI.showToast(text, kind);
  }
}

async function confirmAction(title, message, confirmLabel = "Confirm") {
  if (typeof window !== "undefined" && window.NCCUI && typeof window.NCCUI.confirmModal === "function") {
    return window.NCCUI.confirmModal(title, message, confirmLabel);
  }
  return window.confirm(message);
}

async function digest(value) {
  const input = String(value ?? "");
  if (globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.digest === "function") {
    const bytes = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  // Demo-only deterministic fallback when SubtleCrypto is unavailable on non-HTTPS LAN origins.
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return "demo-" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function getSession() {
  return read(K.session, null);
}

function addRegs(user, events) {
  const all = read(K.regs);
  let added = 0;
  const skipped = [];
  for (const ev of events) {
    if (!VALID_EVENTS.has(ev)) continue;
    const alreadyActive = all.some(
      (r) => r.userId === user.id && r.event === ev && r.status !== "Cancelled"
    );
    if (alreadyActive) {
      skipped.push(ev);
      continue;
    }
    all.push({
      id: generateId(),
      userId: user.id,
      name: user.name,
      email: user.email,
      event: ev,
      fee: FEE,
      createdAt: new Date().toISOString(),
      status: "Registered",
      payment: "Demo pending"
    });
    added += 1;
  }
  write(K.regs, all);
  return { added, skipped };
}

function updateRegisterTotal() {
  const totalEl = $("event-total");
  if (!totalEl) return;
  const count = document.querySelectorAll('input[name="event"]:checked:not(:disabled)').length;
  totalEl.textContent = "₹" + count * FEE;
}

function initRegister() {
  const form = $("register-form");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const preselected = params.get("event");
  const firingBox = document.querySelector('input[name="event"][value="firing"]');
  if (firingBox) {
    firingBox.checked = false;
    firingBox.disabled = true;
    const firingSmall = firingBox.closest("label")?.querySelector("small");
    if (firingSmall) firingSmall.textContent = "Registration not open (subject to approvals)";
  }
  if (preselected === "firing") {
    showMessage(
      "register-msg",
      "Firing registration is not open. This activity is subject to approvals.",
      "error"
    );
  } else if (preselected && VALID_EVENTS.has(preselected)) {
    const box = document.querySelector('input[name="event"][value="' + preselected + '"]');
    if (box && !box.disabled) box.checked = true;
  }

  const s = getSession();
  const accountFields = $("account-fields");
  const infoBanner = $("logged-in-register-info");

  if (s) {
    if (accountFields) accountFields.classList.add("hidden");
    ["reg-name", "reg-email", "reg-phone", "reg-password"].forEach((fieldId) => {
      const input = $(fieldId);
      if (input) {
        input.required = false;
        input.disabled = true;
      }
    });
    if ($("register-title")) $("register-title").textContent = "Add demo event(s)";
    if ($("register-sub")) {
      $("register-sub").textContent = "Select open demo category (Drill) to add to your active demo registrations.";
    }
    if ($("register-submit")) $("register-submit").textContent = "Add selected event(s) →";
    if ($("register-alt-link")) $("register-alt-link").classList.add("hidden");

    const activeUserEvents = new Set(
      read(K.regs)
        .filter((r) => r.userId === s.id && r.status !== "Cancelled")
        .map((r) => r.event)
    );
    document.querySelectorAll('input[name="event"]').forEach((box) => {
      if (activeUserEvents.has(box.value)) {
        box.checked = false;
        box.disabled = true;
        const small = box.closest("label")?.querySelector("small");
        if (small) small.textContent = "Already registered in your active demo list";
      }
    });

    if (infoBanner) {
      infoBanner.innerHTML =
        "Signed in as <strong>" +
        escapeHtml(s.name) +
        "</strong> (" +
        escapeHtml(s.email) +
        '). <button type="button" class="secondary" id="switch-account-btn" style="margin-left:8px;padding:4px 10px">Switch account</button>';
      infoBanner.classList.remove("hidden");
      infoBanner.style.display = "block";
      $("switch-account-btn")?.addEventListener("click", () => {
        localStorage.removeItem(K.session);
        window.location.href = "register.html";
      });
    }
  }

  document.querySelectorAll('input[name="event"]').forEach((box) => {
    box.addEventListener("change", updateRegisterTotal);
  });
  updateRegisterTotal();

  form.addEventListener("submit", signup);
}

async function signup(e) {
  e.preventDefault();
  const events = [...document.querySelectorAll('input[name="event"]:checked:not(:disabled)')].map(
    (x) => x.value
  );
  if (!events.length) {
    return showMessage("register-msg", "Select at least one available event.", "error");
  }

  const activeSession = getSession();
  if (activeSession) {
    const users = read(K.users);
    const currentUser = users.find((u) => u.id === activeSession.id) || activeSession;
    const result = addRegs(currentUser, events);
    if (result.added === 0) {
      return showMessage("register-msg", "Selected event(s) are already in your active list.", "info");
    }
    window.location.href = "participant.html";
    return;
  }

  const f = new FormData(e.target);
  const name = String(f.get("name") || "").trim();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  if (!name || !email || !email.includes("@") || password.length < 6) {
    return showMessage(
      "register-msg",
      "Enter a name, valid email and at least 6 password characters.",
      "error"
    );
  }

  const users = read(K.users);
  if (users.some((u) => u.email === email)) {
    sessionStorage.setItem("ncc_demo_pending", JSON.stringify(events));
    showMessage("register-msg", "A demo account already uses this email. Taking you to login…", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 700);
    return;
  }

  const user = {
    id: generateId(),
    name,
    email,
    phone: String(f.get("phone") || "").trim(),
    passwordHash: await digest(password)
  };
  users.push(user);
  write(K.users, users);
  write(K.session, { id: user.id, name: user.name, email: user.email });
  addRegs(user, events);
  window.location.href = "participant.html";
}

function initLogin() {
  const form = $("login-form");
  if (!form) return;

  const s = getSession();
  const banner = $("already-logged-in");
  if (s && banner) {
    banner.innerHTML =
      "Already logged in as <strong>" +
      escapeHtml(s.name) +
      '</strong>. <a href="participant.html" style="text-decoration:underline;font-weight:700">Open My Portal →</a>';
    banner.classList.remove("hidden");
    banner.style.display = "block";
  }

  form.addEventListener("submit", login);
}

async function login(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = String(f.get("email") || "").trim().toLowerCase();
  const hash = await digest(String(f.get("password") || ""));
  const user = read(K.users).find((u) => u.email === email && u.passwordHash === hash);
  if (!user) {
    return showMessage("login-msg", "Email or demo password did not match.", "error");
  }
  write(K.session, { id: user.id, name: user.name, email: user.email });
  let pending = [];
  try {
    pending = JSON.parse(sessionStorage.getItem("ncc_demo_pending") || "[]");
  } catch {
    pending = [];
  }
  if (Array.isArray(pending) && pending.length) {
    addRegs(user, pending);
    sessionStorage.removeItem("ncc_demo_pending");
  }
  window.location.href = "participant.html";
}

function logout() {
  localStorage.removeItem(K.session);
  localStorage.removeItem(K.admin);
  window.location.href = "index.html";
}

function renderParticipant() {
  const s = getSession();
  if (!s) {
    window.location.href = "login.html";
    return;
  }
  if ($("welcome")) $("welcome").textContent = "Welcome, " + s.name;
  if ($("user-email")) $("user-email").textContent = s.email;

  const regs = read(K.regs).filter((r) => r.userId === s.id);
  const stats = computeStats(regs);
  if ($("reg-count")) $("reg-count").textContent = String(stats.total);
  if ($("reg-total")) $("reg-total").textContent = "₹" + stats.feeTotal;

  const listEl = $("my-registrations");
  if (!listEl) return;

  if (!regs.length) {
    listEl.innerHTML =
      '<div class="empty">No demo events yet. <a href="register.html">Register now →</a></div>';
    return;
  }

  listEl.innerHTML = regs
    .map((r) => {
      const label = escapeHtml(LABELS[r.event] || r.event);
      const ref = escapeHtml(r.id);
      const status = escapeHtml(r.status);
      const payment = escapeHtml(r.payment);
      const isCancelled = r.status === "Cancelled";
      const isPaid = r.payment === "Demo paid";
      const statusPillClass = isCancelled ? "pill cancelled" : "pill";
      const payPillClass = isPaid ? "pill paid" : "pill";
      const actions = isCancelled
        ? '<span class="pill cancelled">Cancelled</span>'
        : '<div class="reg-actions">' +
          (!isPaid
            ? '<a class="secondary" href="payment.html?id=' + encodeURIComponent(r.id) + '">Simulate payment →</a>'
            : "") +
          '<button class="secondary danger" type="button" data-cancel="' +
          ref +
          '">Cancel</button></div>';

      return (
        '<article class="registration-item">' +
        "<div>" +
        "<h3>" +
        label +
        "</h3>" +
        "<p>Reference: " +
        ref +
        ' · <span class="' +
        statusPillClass +
        '">' +
        status +
        "</span></p>" +
        '<p style="margin-top:6px">Payment: <span class="' +
        payPillClass +
        '">' +
        payment +
        "</span></p>" +
        "</div>" +
        '<div class="reg-actions"><strong>₹' +
        escapeHtml(r.fee) +
        "</strong>" +
        actions +
        "</div>" +
        "</article>"
      );
    })
    .join("");

  listEl.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const regId = btn.dataset.cancel;
      const ok = await confirmAction(
        "Cancel registration?",
        "Cancel demo registration " + regId + "? This removes it from your active total.",
        "Cancel registration"
      );
      if (!ok) return;
      const all = read(K.regs);
      const target = all.find((x) => x.id === regId && x.userId === s.id);
      if (target) {
        target.status = "Cancelled";
        write(K.regs, all);
        showMessage("participant-msg", "Demo registration " + regId + " was cancelled.", "info");
        renderParticipant();
      }
    });
  });
}

function adminLogin(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  if (f.get("email") === "admin@ncc.test" && f.get("password") === "NCCDemo400") {
    write(K.admin, true);
    renderAdmin();
  } else {
    showMessage("admin-msg", "Demo credentials do not match.", "error");
  }
}

function renderAdmin() {
  if (!$("admin-panel")) return;
  if (!read(K.admin, false)) return;

  $("admin-login").classList.add("hidden");
  $("admin-panel").classList.remove("hidden");

  const all = read(K.regs);
  const stats = computeStats(all);
  $("admin-total").textContent = String(stats.total);
  $("admin-paid").textContent = String(stats.paid);
  $("admin-pending").textContent = String(stats.pending);

  const q = ($("admin-search")?.value || "").trim().toLowerCase();
  const rows = all.filter((r) => {
    const text = [r.id, r.name, r.email, LABELS[r.event] || r.event, r.status, r.payment]
      .join(" ")
      .toLowerCase();
    return text.includes(q);
  });

  const tbody = $("admin-rows");
  if (!tbody) return;

  tbody.innerHTML = rows.length
    ? rows
        .map((r) => {
          const ref = escapeHtml(r.id);
          const name = escapeHtml(r.name);
          const email = escapeHtml(r.email);
          const label = escapeHtml(LABELS[r.event] || r.event);
          return (
            "<tr>" +
            "<td>" +
            ref +
            "</td>" +
            "<td>" +
            name +
            "</td>" +
            "<td>" +
            email +
            "</td>" +
            "<td>" +
            label +
            "</td>" +
            "<td>₹" +
            escapeHtml(r.fee) +
            "</td>" +
            '<td><select aria-label="Status for ' +
            ref +
            '" data-id="' +
            ref +
            '" data-key="status">' +
            "<option " +
            (r.status === "Registered" ? "selected" : "") +
            ">Registered</option>" +
            "<option " +
            (r.status === "Confirmed" ? "selected" : "") +
            ">Confirmed</option>" +
            "<option " +
            (r.status === "Cancelled" ? "selected" : "") +
            ">Cancelled</option>" +
            "</select></td>" +
            '<td><select aria-label="Payment for ' +
            ref +
            '" data-id="' +
            ref +
            '" data-key="payment">' +
            "<option " +
            (r.payment === "Demo pending" ? "selected" : "") +
            ">Demo pending</option>" +
            "<option " +
            (r.payment === "Demo paid" ? "selected" : "") +
            ">Demo paid</option>" +
            "</select></td>" +
            '<td><button type="button" class="secondary danger" data-delete="' +
            ref +
            '">Delete</button></td>' +
            "</tr>"
          );
        })
        .join("")
    : '<tr><td colspan="8" class="empty">No matching demo registrations found.</td></tr>';

  tbody.querySelectorAll("select").forEach((el) => {
    el.addEventListener("change", () => {
      const list = read(K.regs);
      const r = list.find((x) => x.id === el.dataset.id);
      if (r) {
        r[el.dataset.key] = el.value;
        write(K.regs, list);
        showMessage(
          "admin-panel-msg",
          "Updated " + r.id + " (" + el.dataset.key + ": " + el.value + ")."
        );
        renderAdmin();
      }
    });
  });

  tbody.querySelectorAll("[data-delete]").forEach((el) => {
    el.addEventListener("click", async () => {
      const targetId = el.dataset.delete;
      const ok = await confirmAction(
        "Delete registration?",
        "Delete demo registration " + targetId + "? This action cannot be undone.",
        "Delete"
      );
      if (!ok) {
        return;
      }
      write(
        K.regs,
        read(K.regs).filter((r) => r.id !== targetId)
      );
      showMessage("admin-panel-msg", "Deleted demo registration " + targetId + ".", "info");
      renderAdmin();
    });
  });
}

function exportCsv() {
  const all = read(K.regs);
  if (!all.length) {
    showMessage("admin-panel-msg", "No demo registrations to export yet.", "info");
    return;
  }
  const content = buildCsv(all);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  a.download = "ncc-demo-registrations.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  showMessage("admin-panel-msg", "Exported " + all.length + " demo registration(s) to CSV.");
}

function initPayment() {
  const select = $("payment-registration");
  const btn = $("simulate-payment");
  if (!select || !btn) return;

  const s = getSession();
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");

  function getActiveUserRegs() {
    if (!s) return [];
    return read(K.regs).filter((r) => r.userId === s.id && r.status !== "Cancelled");
  }

  function populateSelect(preserveValue) {
    if (!s) {
      select.innerHTML = '<option value="">Please log in first</option>';
      select.disabled = true;
      btn.disabled = true;
      if ($("payment-current-status")) $("payment-current-status").textContent = "Not logged in";
      if ($("payment-amount")) $("payment-amount").textContent = "₹0";
      showMessage("payment-msg", "Log in to see your demo registrations.", "error");
      return;
    }

    const regs = getActiveUserRegs();
    if (!regs.length) {
      select.innerHTML = '<option value="">No active registrations yet</option>';
      select.disabled = true;
      btn.disabled = true;
      if ($("payment-current-status")) $("payment-current-status").textContent = "No active registrations";
      if ($("payment-amount")) $("payment-amount").textContent = "₹0";
      return;
    }

    select.disabled = false;
    btn.disabled = false;
    const selectedId = preserveValue || requestedId || select.value;
    select.innerHTML = regs
      .map(
        (r) =>
          '<option value="' +
          escapeHtml(r.id) +
          '">' +
          escapeHtml((LABELS[r.event] || r.event) + " · " + r.id + " (" + r.payment + ")") +
          "</option>"
      )
      .join("");
    if (selectedId && regs.some((r) => r.id === selectedId)) {
      select.value = selectedId;
    }
    updateSummary();
  }

  function updateSummary() {
    const regs = getActiveUserRegs();
    const r = regs.find((x) => x.id === select.value);
    if ($("payment-amount")) $("payment-amount").textContent = r ? "₹" + r.fee : "₹0";
    if ($("payment-current-status")) {
      $("payment-current-status").textContent = r ? r.payment : "Not selected";
    }
  }

  select.addEventListener("change", updateSummary);
  btn.addEventListener("click", () => {
    if (!s) {
      showMessage("payment-msg", "Log in first to simulate demo payment status.", "error");
      return;
    }
    const all = read(K.regs);
    const r = all.find((x) => x.id === select.value && x.userId === s.id && x.status !== "Cancelled");
    if (!r) {
      showMessage("payment-msg", "Register for an active demo event first.", "error");
      return;
    }
    if (r.payment === "Demo paid") {
      showMessage(
        "payment-msg",
        "This demo registration is already marked Demo paid. No real payment occurred.",
        "info"
      );
      return;
    }
    r.payment = "Demo paid";
    write(K.regs, all);
    populateSelect(r.id);
    showMessage(
      "payment-msg",
      "Demo status updated to Demo paid only in this browser. No money was transferred."
    );
  });

  populateSelect();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initRegister();
    initLogin();
    $("admin-form")?.addEventListener("submit", adminLogin);
    $("admin-search")?.addEventListener("input", renderAdmin);
    $("admin-export")?.addEventListener("click", exportCsv);
    document.querySelectorAll("[data-logout]").forEach((x) => x.addEventListener("click", logout));
    if (document.body.dataset.page === "participant") renderParticipant();
    if (document.body.dataset.page === "admin") renderAdmin();
    initPayment();
    const y = $("year");
    if (y) y.textContent = String(new Date().getFullYear());
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
