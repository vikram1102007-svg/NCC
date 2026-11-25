// NCC public preview: no account, participant, payment or admin data is stored in the browser.
function showPreviewMessage(id, message) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.className = "message error";
  element.style.display = "block";
}
function blockPreviewSubmit(formId, messageId, message) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showPreviewMessage(messageId, message);
  });
}
blockPreviewSubmit("register-form", "register-msg", "Registration is not open. This preview is not connected to secure participant storage. Please wait for the official registration link.");
blockPreviewSubmit("login-form", "login-msg", "Participant login is not enabled yet. Secure authentication will be connected after the NCC backend is configured.");
blockPreviewSubmit("admin-form", "admin-msg", "Admin login is not enabled in this preview. Organiser access will use server-side authentication and roles.");
blockPreviewSubmit("event-register-form", "reg-msg", "Event registration is not open yet. No participant information has been submitted.");
blockPreviewSubmit("registration-form", "registration-status", "Registration is currently closed. No participant information has been submitted.");
const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
