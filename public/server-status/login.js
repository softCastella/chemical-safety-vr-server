const form = document.querySelector(".login-form");
const errorBox = document.querySelector(".form-error");
const dashboardDestinations = new Set([
  "/server/",
  "/starlight-sudoku/",
  "/chemical-safety-training-vr/",
]);

const requestedDestination = new URLSearchParams(window.location.search).get("next");
if (dashboardDestinations.has(requestedDestination)) {
  const option = form?.querySelector(`input[name="destination"][value="${requestedDestination}"]`);
  if (option) option.checked = true;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const formData = new FormData(form);
    const requested = formData.get("destination");
    const destination = dashboardDestinations.has(requested) ? requested : "/server/";
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    if (!response.ok) throw new Error("관리자 ID 또는 비밀번호를 확인해주세요.");
    window.location.assign(destination);
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
  }
});
