// Presentation-only UI helpers: header scroll, mobile drawer, countdown, reveal, count-up, toasts, modal.
(function () {
  if (typeof document === "undefined") return;

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

  function initEventsFilter() {
    const grid = document.getElementById("events-grid");
    if (!grid) return;

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

    // Update demo seats-left progress bars for demo-active categories (firing, drill)
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
      if (slug && (slug === "firing" || slug === "drill")) {
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
    initEventsFilter();
  });
})();
