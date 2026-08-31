const contactForm = document.querySelector(".contact-form");

if (contactForm) {
  const submitButton = contactForm.querySelector(".contact-submit");
  const status = contactForm.querySelector(".contact-form-status");

  function showStatus(message, type = "") {
    status.textContent = message;
    status.className = `contact-form-status${type ? ` is-${type}` : ""}`;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!contactForm.reportValidity()) {
      return;
    }

    submitButton.disabled = true;
    contactForm.setAttribute("aria-busy", "true");
    showStatus("문의를 전송하고 있습니다.");

    try {
      const payload = Object.fromEntries(new FormData(contactForm).entries());
      const response = await fetch(contactForm.action, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body?.error?.message ??
            "문의를 전송하지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }

      contactForm.reset();
      showStatus("문의가 접수되었습니다. 확인 후 이메일로 답변드리겠습니다.", "success");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      submitButton.disabled = false;
      contactForm.removeAttribute("aria-busy");
    }
  });
}
