// Presentation-only UI helpers + global crash guard (zero data storage here).
(function () {
  function showGlobalFallbackError(detail) {
    try {
      const main = document.querySelector("#main-content") || document.body;
      if (!main || document.querySelector("#ncc-global-error")) return;
      const box = document.createElement("section");
      box.id = "ncc-global-error";
      box.className = "global-error-card";
      box.setAttribute("role", "alert");

      const h = document.createElement("h2");
      h.textContent = "Unable to display this view";
      const p = document.createElement("p");
      p.style.margin = "8px 0 18px";
      p.style.color = "var(--ink-600)";
      p.textContent =
        detail ||
        "A network or browser script problem interrupted loading. Tap Reload to try again.";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-primary";
      btn.textContent = "Reload Page";
      btn.addEventListener("click", () => window.location.reload());

      box.append(h, p, btn);
      main.prepend(box);
    } catch {
      // Never throw inside fallback handler
    }
  }

  window.addEventListener("error", (evt) => {
    // Ignore minor cross-origin script errors if page already rendered cleanly; surface fatal ones
    if (evt && evt.error) {
      showGlobalFallbackError("Something went wrong loading the page. Please reload.");
    }
  });

  window.addEventListener("unhandledrejection", () => {
    showGlobalFallbackError("Could not reach the server cleanly. Check your connection and reload.");
  });

  function ensureToastRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
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
    toast.className = `toast toast--${kind}`;

    const body = document.createElement("span");
    body.textContent = text;

    const closeBtn = document.createElement("button");
    closeBtn.className = "toast-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.textContent = "✕";

    const removeToast = () => {
      toast.remove();
    };
    closeBtn.addEventListener("click", removeToast);
    toast.append(body, closeBtn);
    region.appendChild(toast);
    setTimeout(removeToast, 4000);
  }

  function confirmModal(title, message, confirmLabel = "Confirm") {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.setAttribute("role", "dialog");
      backdrop.setAttribute("aria-modal", "true");

      const card = document.createElement("div");
      card.className = "modal-card";

      const heading = document.createElement("h2");
      heading.textContent = title;
      const body = document.createElement("p");
      body.textContent = message;

      const actions = document.createElement("div");
      actions.className = "modal-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-secondary btn-sm";
      cancelBtn.textContent = "Cancel";

      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "btn btn-danger btn-sm";
      okBtn.textContent = confirmLabel;

      const finish = (result) => {
        document.removeEventListener("keydown", onKeyDown);
        backdrop.remove();
        resolve(result);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") finish(false);
      };

      cancelBtn.addEventListener("click", () => finish(false));
      okBtn.addEventListener("click", () => finish(true));
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) finish(false);
      });
      document.addEventListener("keydown", onKeyDown);

      actions.append(cancelBtn, okBtn);
      card.append(heading, body, actions);
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
      okBtn.focus();
    });
  }

  function initHeaderAndMenu() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector("#site-nav");
    const backdrop = document.querySelector(".nav-backdrop");

    const onScroll = () => {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!toggle || !nav) return;

    const setMenu = (open) => {
      nav.classList.add("is-animating");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (backdrop) backdrop.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setMenu(open);
    });

    backdrop?.addEventListener("click", () => setMenu(false));
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) setMenu(false);
    });
  }

  function initBackToTop() {
    const btn = document.getElementById("back-to-top");
    if (!btn) return;
    const toggleVisibility = () => {
      btn.classList.toggle("is-visible", window.scrollY > 360);
    };
    toggleVisibility();
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initRevealAndCountUp() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = document.querySelectorAll("[data-reveal]");

    if (reduced || !("IntersectionObserver" in window)) {
      reveals.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    reveals.forEach((el) => observer.observe(el));
  }

  function initPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((btn) => {
      const input = document.getElementById(btn.getAttribute("data-password-toggle"));
      if (!input) return;
      btn.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-pressed", String(show));
      });
    });
  }

  function initFaqAccordion() {
    const triggers = document.querySelectorAll("[data-faq-trigger]");
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        trigger.setAttribute("aria-expanded", String(!expanded));
        const icon = trigger.querySelector("[data-faq-icon]");
        if (icon) icon.textContent = expanded ? "+" : "−";
        if (panel) panel.hidden = expanded;
      });
    });
  }

  function initCountdown() {
    const box = document.querySelector("[data-countdown]");
    if (!box) return;

    const target = Date.now() + 45 * 24 * 60 * 60 * 1000;
    const daysEl = box.querySelector("[data-cd-days]");
    const hoursEl = box.querySelector("[data-cd-hours]");
    const minsEl = box.querySelector("[data-cd-mins]");
    const secsEl = box.querySelector("[data-cd-secs]");

    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (daysEl) daysEl.textContent = String(d).padStart(2, "0");
      if (hoursEl) hoursEl.textContent = String(h).padStart(2, "0");
      if (minsEl) minsEl.textContent = String(m).padStart(2, "0");
      if (secsEl) secsEl.textContent = String(s).padStart(2, "0");
    };
    tick();
    setInterval(tick, 1000);
  }

  window.NCCUI = {
    showToast,
    confirmModal,
    showGlobalFallbackError
  };

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderAndMenu();
    initBackToTop();
    initRevealAndCountUp();
    initPasswordToggles();
    initFaqAccordion();
    initCountdown();
  });
})();
