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
    showStatus("Gmail 작성창을 엽니다");
  });
}
