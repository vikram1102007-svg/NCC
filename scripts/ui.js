// Presentation-only UI helpers: header scroll, mobile drawer, countdown, reveal, count-up, toasts, modal.
(function () {
  const NCC_EVENTS = [
    {
      id: "drill",
      badge: "Day 1 · Squad / Individual",
      day: 1,
      title: "Drill",
      summary: "Precision foot drill and command execution judged on turnout, uniformity, and parade timing.",
      date: "Day 1 · Date To be announced",
      time: "09:30 IST (Tentative)",
      venue: "College Parade Ground (TBA)",
      type: "Squad / Individual",
      fee: "Fee to be announced",
      status: "Demo Open",
      capacity: 30,
      registrationOpen: true,
      requiresApproval: false,
      demoSlug: "drill",
      note: "Drill category rules and squad size are pending final committee confirmation.",
      criteria: [
        "Valid College ID and NCC enrollment check at reporting desk.",
        "Complete NCC uniform turnout, polished footwear, and parade discipline.",
        "Synchronisation, posture, and command clarity during squad inspection."
      ]
    },
    {
      id: "firing",
      badge: "Subject to approvals",
      day: 2,
      title: "Firing",
      detailTitle: "Firing (Subject to approvals)",
      summary: "Proposed range activity. Firing is not confirmed and requires formal organiser and safety approval.",
      date: "Day 2 · Date To be announced",
      time: "11:00 IST (Subject to approvals)",
      venue: "Authorised Range Facility (TBA)",
      type: "Individual",
      fee: "Fee to be announced",
      status: "Subject to approvals",
      capacity: 25,
      registrationOpen: false,
      requiresApproval: true,
      demoSlug: null,
      note: "Registration is not open. This activity is subject to approvals.",
      criteria: [
        "Mandatory safety briefing and officer supervision before range entry.",
        "Formal organiser and unit approval required prior to final scheduling.",
        "Strict adherence to range discipline and zero-tolerance safety rules."
      ]
    },
    {
      id: "quiz",
      badge: "Day 1 · Team (2 Cadets)",
      day: 1,
      title: "NCC & Defence Quiz",
      summary: "Written preliminary round followed by stage finals on NCC history, defence forces, and general awareness.",
      date: "Day 1 · Date To be announced",
      time: "13:30 IST (Tentative)",
      venue: "College Auditorium (TBA)",
      type: "Team (2 Cadets)",
      fee: "Fee to be announced",
      status: "Pending confirmation",
      capacity: 40,
      registrationOpen: true,
      requiresApproval: false,
      demoSlug: null,
      note: "Quiz category rules are pending official organiser confirmation.",
      criteria: [
        "Teams of two cadets from the same unit or institution (pending confirmation).",
        "Preliminary written screening round followed by top-team stage finals.",
        "No electronic devices permitted during the written or stage rounds."
      ]
    },
    {
      id: "map-reading",
      badge: "Day 2 · Individual / Pair",
      day: 2,
      title: "Map Reading",
      summary: "Practical field-craft test covering grid references, compass bearings, and route plotting.",
      date: "Day 2 · Date To be announced",
      time: "15:30 IST (Tentative)",
      venue: "Training Ground / Field Area (TBA)",
      type: "Individual / Pair",
      fee: "Fee to be announced",
      status: "Pending confirmation",
      capacity: 35,
      registrationOpen: true,
      requiresApproval: false,
      demoSlug: null,
      note: "Map Reading equipment rules and reporting details are pending confirmation.",
      criteria: [
        "Ability to read 6-figure grid references and topographic map symbols.",
        "Prismatic compass bearing and back-bearing accuracy under time limit.",
        "Own basic stationery (pencil, scale, eraser) as directed by organisers."
      ]
    },
    {
      id: "obstacle",
      badge: "Day 2 · Individual",
      day: 2,
      title: "Obstacle Course",
      summary: "Timed physical agility circuit covering standard cadet obstacles under officer supervision.",
      date: "Day 2 · Date To be announced",
      time: "08:00 IST (Tentative)",
      venue: "Obstacle Arena (TBA)",
      type: "Individual",
      fee: "Fee to be announced",
      status: "Pending confirmation",
      capacity: 40,
      registrationOpen: true,
      requiresApproval: false,
      demoSlug: null,
      note: "Medical fitness declaration and safety briefing are mandatory once confirmed.",
      criteria: [
        "Appropriate PT kit / sports footwear required for safety on the course.",
        "Completion of all standard obstacles within the allotted time window.",
        "Mandatory warm-up and medical clearance prior to starting."
      ]
    }
  ];

  if (typeof module === "object" && module.exports) {
    module.exports = { NCC_EVENTS };
  }

  if (typeof document === "undefined") return;
  window.NCC_EVENTS = NCC_EVENTS;

  function initHeaderAndMenu() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector("#site-nav");
    const backdrop = document.querySelector(".nav-backdrop");

    if (header) {
      const onScroll = () => {
        header.classList.toggle("is-scrolled", window.scrollY > 24);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (toggle && nav) {
      const setOpen = (open) => {
        nav.classList.add("is-animating");
        toggle.setAttribute("aria-expanded", String(open));
        nav.classList.toggle("is-open", open);
        if (backdrop) backdrop.classList.toggle("is-open", open);
        document.body.style.overflow = open ? "hidden" : "";
      };

      toggle.addEventListener("click", () => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        setOpen(!isOpen);
      });

      backdrop?.addEventListener("click", () => setOpen(false));
      nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => setOpen(false));
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && nav.classList.contains("is-open")) {
          setOpen(false);
          toggle.focus();
        }
      });
    }
  }

  function initBackToTop() {
    const btn = document.querySelector("#back-to-top");
    if (!btn) return;
    const onScroll = () => {
      btn.classList.toggle("is-visible", window.scrollY > 360);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initRevealAndCountUp() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = document.querySelectorAll("[data-reveal]");
    if (reduced || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("is-revealed"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      reveals.forEach((el) => io.observe(el));
    }

    const counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    const animateCount = (el) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target)) return;
      if (reduced) {
        el.textContent = String(target);
        return;
      }
      const start = performance.now();
      const duration = 600;
      const step = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (reduced || !("IntersectionObserver" in window)) {
      counters.forEach(animateCount);
    } else {
      const countIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              countIo.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.3 }
      );
      counters.forEach((el) => countIo.observe(el));
    }
  }

  function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.passwordToggle;
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        btn.textContent = isPassword ? "Hide" : "Show";
        btn.setAttribute("aria-pressed", String(isPassword));
      });
    });
  }

  function initFaqAccordion() {
    document.querySelectorAll("[data-faq-trigger]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        const panelId = btn.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        btn.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.hidden = expanded;
        const icon = btn.querySelector("[data-faq-icon]");
        if (icon) icon.textContent = expanded ? "+" : "−";
      });
    });
  }

  function initCountdown() {
    const box = document.querySelector("[data-countdown]");
    if (!box) return;
    // Target tentative event start: 45 days from page load if no fixed date is configured yet
    const targetAttr = box.dataset.targetDate;
    const targetMs = targetAttr ? Date.parse(targetAttr) : Date.now() + 45 * 24 * 60 * 60 * 1000;
    const dEl = box.querySelector("[data-cd-days]");
    const hEl = box.querySelector("[data-cd-hours]");
    const mEl = box.querySelector("[data-cd-mins]");
    const sEl = box.querySelector("[data-cd-secs]");

    const render = () => {
      const diff = Math.max(0, targetMs - Date.now());
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (dEl) dEl.textContent = String(days).padStart(2, "0");
      if (hEl) hEl.textContent = String(hours).padStart(2, "0");
      if (mEl) mEl.textContent = String(mins).padStart(2, "0");
      if (sEl) sEl.textContent = String(secs).padStart(2, "0");
    };
    render();
    setInterval(render, 1000);
  }

  function ensureToastRegion() {
    let region = document.getElementById("toast-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "toast-region";
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      document.body.appendChild(region);
    }
    return region;
  }

  function showToast(text, kind = "info") {
    const region = ensureToastRegion();
    const toast = document.createElement("div");
    toast.className = "toast toast--" + kind;
    const msg = document.createElement("span");
    msg.textContent = text;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toast-close";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => toast.remove());
    toast.append(msg, closeBtn);
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function confirmModal(title, message, confirmLabel = "Confirm") {
    return new Promise((resolve) => {
      const previouslyFocused = document.activeElement;
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.setAttribute("role", "dialog");
      backdrop.setAttribute("aria-modal", "true");
      backdrop.setAttribute("aria-labelledby", "modal-confirm-title");

      const card = document.createElement("div");
      card.className = "modal-card";

      const heading = document.createElement("h2");
      heading.id = "modal-confirm-title";
      heading.textContent = title;

      const body = document.createElement("p");
      body.textContent = message;

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-secondary btn-sm";
      cancelBtn.textContent = "Keep";

      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "btn btn-danger btn-sm";
      okBtn.textContent = confirmLabel;

      const cleanup = (result) => {
        document.removeEventListener("keydown", onKey);
        backdrop.remove();
        if (previouslyFocused && typeof previouslyFocused.focus === "function") {
          previouslyFocused.focus();
        }
        resolve(result);
      };

      const onKey = (e) => {
        if (e.key === "Escape") cleanup(false);
      };

      cancelBtn.addEventListener("click", () => cleanup(false));
      okBtn.addEventListener("click", () => cleanup(true));
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) cleanup(false);
      });
      document.addEventListener("keydown", onKey);

      actions.append(cancelBtn, okBtn);
      card.append(heading, body, actions);
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
      okBtn.focus();
    });
  }

  function createEventCard(ev, includeMeter) {
    const article = document.createElement("article");
    article.id = ev.id;
    article.className = "card card-hover event-card";
    article.dataset.eventCard = "";
    article.dataset.day = String(ev.day);
    article.dataset.eventSlug = ev.id;
    article.dataset.capacity = String(ev.capacity);

    const top = document.createElement("div");
    const badgeRow = document.createElement("div");
    badgeRow.className = "reg-actions";
    badgeRow.style.justifyContent = "space-between";

    const dayPill = document.createElement("span");
    dayPill.className = "pill pill-navy";
    dayPill.textContent = "Day " + ev.day;

    const tagPill = document.createElement("span");
    tagPill.className = ev.requiresApproval ? "pill pill-gold" : "pill pill-olive";
    tagPill.textContent = ev.requiresApproval ? "Subject to approvals" : ev.type;

    badgeRow.append(dayPill, tagPill);

    const h3 = document.createElement("h3");
    h3.textContent = ev.title;

    const p = document.createElement("p");
    p.textContent = ev.summary;

    top.append(badgeRow, h3, p);

    if (includeMeter) {
      const meter = document.createElement("div");
      meter.className = "seat-meter";
      const head = document.createElement("div");
      head.className = "seat-meter-head";
      const seatsSpan = document.createElement("span");
      seatsSpan.dataset.seatsText = "";
      seatsSpan.textContent = ev.demoSlug ? `${ev.capacity} of ${ev.capacity} demo slots left` : "Capacity TBA";
      const feeSpan = document.createElement("span");
      feeSpan.textContent = "Fee TBA";
      head.append(seatsSpan, feeSpan);

      const track = document.createElement("div");
      track.className = "seat-track";
      const fill = document.createElement("div");
      fill.className = "seat-fill";
      fill.dataset.seatsBar = "";
      fill.style.width = "8%";
      track.appendChild(fill);
      meter.append(head, track);
      top.appendChild(meter);
    }

    const footer = document.createElement("div");
    footer.className = "event-card-footer";
    const statusText = document.createElement("strong");
    statusText.textContent = ev.requiresApproval ? "Subject to approvals" : ev.fee;

    const actions = document.createElement("div");
    actions.className = "reg-actions";
    const criteriaLink = document.createElement("a");
    criteriaLink.className = "btn btn-secondary btn-sm";
    criteriaLink.href = "event.html?id=" + ev.id;
    criteriaLink.textContent = "Criteria";
    actions.appendChild(criteriaLink);

    if (ev.registrationOpen && !ev.requiresApproval) {
      const regLink = document.createElement("a");
      regLink.className = "btn btn-primary btn-sm";
      regLink.href = ev.demoSlug ? "register.html?event=" + ev.demoSlug : "register.html";
      regLink.textContent = "Register →";
      actions.appendChild(regLink);
    }

    footer.append(statusText, actions);
    article.append(top, footer);
    return article;
  }

  function initHomeEvents() {
    const grid = document.getElementById("home-events-grid");
    if (!grid) return;

    grid.innerHTML = "";
    NCC_EVENTS.forEach((ev) => {
      grid.appendChild(createEventCard(ev, false));
    });

    const countEl = document.getElementById("home-planned-count");
    if (countEl) {
      countEl.dataset.count = String(NCC_EVENTS.length);
      countEl.textContent = String(NCC_EVENTS.length);
    }

    const exploreLink = document.getElementById("home-explore-events-link");
    if (exploreLink) {
      exploreLink.textContent = `Explore all ${NCC_EVENTS.length} events →`;
    }

    const demoOpenEl = document.getElementById("home-demo-open-count");
    if (demoOpenEl) {
      const openCount = NCC_EVENTS.filter((ev) => ev.registrationOpen && !ev.requiresApproval).length;
      demoOpenEl.dataset.count = String(openCount);
      demoOpenEl.textContent = String(openCount);
    }
  }

  function initEventsFilter() {
    const grid = document.getElementById("events-grid");
    if (!grid) return;

    grid.innerHTML = "";
    NCC_EVENTS.forEach((ev) => {
      grid.appendChild(createEventCard(ev, true));
    });

    const allChip = document.querySelector('[data-day-filter="all"]');
    if (allChip) allChip.textContent = `All Days (${NCC_EVENTS.length})`;

    const chips = document.querySelectorAll("[data-day-filter]");
    const search = document.getElementById("events-search");
    const empty = document.getElementById("events-empty");
    const skeleton = document.getElementById("events-skeleton");
    const cards = [...grid.querySelectorAll("[data-event-card]")];

    // Show brief skeleton loading state for smooth polish (skipped when reduced motion)
    if (skeleton && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      skeleton.classList.remove("hidden");
      grid.classList.add("hidden");
      setTimeout(() => {
        skeleton.classList.add("hidden");
        grid.classList.remove("hidden");
      }, 180);
    }

    // Update demo seats-left progress bars for demo-active categories
    let regs = [];
    try {
      regs = JSON.parse(localStorage.getItem("ncc_demo_regs_v1") || "[]").filter(
        (r) => r.status !== "Cancelled"
      );
    } catch {
      regs = [];
    }
    cards.forEach((card) => {
      const slug = card.dataset.eventSlug;
      const cap = Number(card.dataset.capacity || 30);
      const countEl = card.querySelector("[data-seats-text]");
      const barEl = card.querySelector("[data-seats-bar]");
      if (slug && slug === "drill") {
        const taken = regs.filter((r) => r.event === slug).length;
        const left = Math.max(0, cap - taken);
        const pct = Math.min(100, Math.round((taken / cap) * 100));
        if (countEl) countEl.textContent = `${left} of ${cap} demo slots left`;
        if (barEl) barEl.style.width = `${Math.max(8, pct)}%`;
      }
    });

    let activeDay = "all";
    const applyFilter = () => {
      const q = (search?.value || "").trim().toLowerCase();
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

  function initEventDetail() {
    if (document.body.dataset.page !== "event-detail") return;
    const id = new URLSearchParams(window.location.search).get("id") || "drill";
    const ev = NCC_EVENTS.find((item) => item.id === id) || NCC_EVENTS[0];

    const setText = (elId, text) => {
      const el = document.getElementById(elId);
      if (el) el.textContent = text;
    };

    setText("detail-badge", `Day ${ev.day} · ${ev.status}`);
    setText("detail-title", ev.detailTitle || ev.title);
    setText("detail-summary", ev.summary);
    setText("detail-date", ev.date);
    setText("detail-time", ev.time);
    setText("detail-venue", ev.venue);
    setText("detail-type", ev.type);
    setText("detail-fee", ev.demoSlug ? `${ev.fee} (Demo ₹400)` : ev.fee);
    setText("detail-status-pill", ev.status);
    setText("detail-approval-note", ev.note);

    const canRegister = Boolean(ev.registrationOpen && !ev.requiresApproval);
    const regHref = ev.demoSlug ? "register.html?event=" + ev.demoSlug : "register.html";
    const btn1 = document.getElementById("detail-register-btn");
    const btn2 = document.getElementById("detail-mobile-register");
    const mobileBar = document.querySelector(".sticky-mobile-cta");

    if (canRegister) {
      if (btn1) btn1.href = regHref;
      if (btn2) btn2.href = regHref;
    } else {
      if (btn1) btn1.remove();
      if (btn2) btn2.remove();
      if (mobileBar) mobileBar.remove();
    }

    if (ev.demoSlug) {
      let taken = 0;
      try {
        taken = JSON.parse(localStorage.getItem("ncc_demo_regs_v1") || "[]").filter(
          (r) => r.event === ev.demoSlug && r.status !== "Cancelled"
        ).length;
      } catch {
        taken = 0;
      }
      const left = Math.max(0, ev.capacity - taken);
      setText("detail-seats", `${left} of ${ev.capacity} demo slots left`);
      const bar = document.getElementById("detail-seats-bar");
      if (bar) bar.style.width = `${Math.max(10, Math.round((taken / ev.capacity) * 100))}%`;
    } else {
      setText("detail-seats", "Capacity TBA");
    }

    const list = document.getElementById("detail-criteria");
    if (list) {
      list.innerHTML = "";
      ev.criteria.forEach((item) => {
        const li = document.createElement("li");
        const icon = document.createElement("span");
        icon.className = "criteria-check";
        icon.textContent = "✓";
        const span = document.createElement("span");
        span.textContent = item;
        li.append(icon, span);
        list.appendChild(li);
      });
    }
  }

  window.NCCUI = {
    showToast,
    confirmModal,
    animateCounter(el, value) {
      if (!el) return;
      el.textContent = String(value);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderAndMenu();
    initBackToTop();
    initRevealAndCountUp();
    initPasswordToggles();
    initFaqAccordion();
    initCountdown();
    initHomeEvents();
    initEventsFilter();
    initEventDetail();
  });
})();
