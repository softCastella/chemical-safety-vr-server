const form = document.querySelector(".login-form");
const errorBox = document.querySelector(".form-error");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    if (!response.ok) throw new Error("관리자 ID 또는 비밀번호를 확인해주세요.");
    window.location.assign("/server-status/");
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
  }
});
