const shareButton = document.querySelector(".detail-share-button");
const shareDialog = document.querySelector(".detail-share-dialog");
const shareBackdrop = document.querySelector(".detail-share-backdrop");
const shareStatus = document.querySelector(".detail-share-status");

if (shareButton && shareDialog && shareBackdrop && shareStatus) {
  const shareTitle = "화학물질 안전훈련 VR — TYCHE IMMERSA";
  const shareText = "PPE 착용 과정을 직접 수행하며 학습하는 화학물질 안전훈련 VR";
  const shareUrl = "https://immersa.tycheworks.com/chemical-safety-training";
  const nativeButton = shareDialog.querySelector("[data-share-native]");
  const copyButton = shareDialog.querySelector("[data-share-copy]");
  const closeButtons = document.querySelectorAll("[data-share-close]");
  const platformLinks = shareDialog.querySelectorAll("[data-share-platform]");
  let statusTimer;

  const platformUrls = {
    naver: `https://blog.naver.com/openapi/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
  };

  function showStatus(message) {
    window.clearTimeout(statusTimer);
    shareStatus.textContent = message;
    shareStatus.classList.add("is-visible");
    statusTimer = window.setTimeout(() => {
      shareStatus.classList.remove("is-visible");
    }, 2200);
  }

  function setDialogOpen(open) {
    shareDialog.hidden = !open;
    shareBackdrop.hidden = !open;
    shareButton.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("is-share-dialog-open", open);

    if (open) {
      shareDialog.querySelector(".detail-share-close")?.focus();
    } else {
      shareButton.focus();
    }
  }

  for (const link of platformLinks) {
    link.href = platformUrls[link.dataset.sharePlatform];
    link.addEventListener("click", () => {
      setDialogOpen(false);
    });
  }

  if (typeof navigator.share !== "function") {
    nativeButton.hidden = true;
  }

  shareButton.addEventListener("click", () => {
    setDialogOpen(true);
  });

  for (const closeButton of closeButtons) {
    closeButton.addEventListener("click", () => {
      setDialogOpen(false);
    });
  }

  nativeButton.addEventListener("click", async () => {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      setDialogOpen(false);
      showStatus("공유 메뉴를 열었습니다");
    } catch (error) {
      if (error?.name !== "AbortError") {
        showStatus("기기 공유를 사용할 수 없습니다");
      }
    }
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setDialogOpen(false);
      showStatus("링크를 복사했습니다");
    } catch {
      showStatus("주소창의 링크를 복사해주세요");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shareDialog.hidden) {
      setDialogOpen(false);
    }
  });
}
