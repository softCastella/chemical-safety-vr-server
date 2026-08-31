const shareButton = document.querySelector(".detail-share-button");
const shareStatus = document.querySelector(".detail-share-status");

if (shareButton && shareStatus) {
  let statusTimer;

  function showStatus(message) {
    window.clearTimeout(statusTimer);
    shareStatus.textContent = message;
    shareStatus.classList.add("is-visible");
    statusTimer = window.setTimeout(() => {
      shareStatus.classList.remove("is-visible");
    }, 2200);
  }

  shareButton.addEventListener("click", () => {
    if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
      showStatus("로컬 서버에서 공유를 확인해주세요");
      return;
    }

    const pageUrl = window.location.href.split("#", 1)[0];
    const gmailUrl = new URL("https://mail.google.com/mail/");
    gmailUrl.searchParams.set("view", "cm");
    gmailUrl.searchParams.set("fs", "1");
    gmailUrl.searchParams.set(
      "su",
      "화학물질 안전훈련 VR — TYCHE IMMERSA",
    );
    gmailUrl.searchParams.set(
      "body",
      `PPE 착용 과정을 직접 수행하며 학습하는 화학물질 안전훈련 VR\n\n${pageUrl}`,
    );

    window.open(gmailUrl.toString(), "_blank", "noopener,noreferrer");
    showStatus("Gmail 작성창을 열었습니다");
  });
}
