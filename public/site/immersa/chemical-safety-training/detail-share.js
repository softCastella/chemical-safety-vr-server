const shareButton = document.querySelector(".detail-share-button");
const shareDialog = document.querySelector(".detail-share-dialog");
const shareBackdrop = document.querySelector(".detail-share-backdrop");
const shareStatus = document.querySelector(".detail-share-status");

if (shareButton && shareDialog && shareBackdrop && shareStatus) {
  const shareTitle = "화학물질 안전훈련 VR — TYCHE IMMERSA";
  const shareText = "PPE 착용 과정을 직접 수행하며 학습하는 화학물질 안전훈련 VR";
  const shareUrl = "https://immersa.tycheworks.com/chemical-safety-training";
  const copyButton = shareDialog.querySelector("[data-share-copy]");
  const kakaoButton = shareDialog.querySelector("[data-share-kakao]");
  const closeButtons = document.querySelectorAll("[data-share-close]");
  const platformLinks = shareDialog.querySelectorAll("[data-share-platform]");
  let kakaoSdk;
  let kakaoSdkError;
  let statusTimer;

  const platformUrls = {
    naver: `https://share.naver.com/web/shareView?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
    email: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
  };

  async function prepareKakaoShare() {
    const configResponse = await fetch("/api/public-site-config", {
      headers: { accept: "application/json" },
    });

    if (!configResponse.ok) {
      throw new Error("Kakao share configuration is unavailable.");
    }

    const { kakaoJavaScriptKey } = await configResponse.json();

    if (!kakaoJavaScriptKey) {
      throw new Error("KAKAO_JAVASCRIPT_KEY is missing.");
    }

    if (!window.Kakao) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
        script.integrity = "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";
        script.crossOrigin = "anonymous";
        script.addEventListener("load", resolve, { once: true });
        script.addEventListener("error", reject, { once: true });
        document.head.append(script);
      });
    }

    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(kakaoJavaScriptKey);
    }

    kakaoSdk = window.Kakao;
  }

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

  async function copyShareUrl() {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      } catch {
        // 권한 거부나 미지원 환경에서는 아래 선택 복사 방식으로 다시 시도한다.
      }
    }

    const copyField = document.createElement("textarea");
    copyField.value = shareUrl;
    copyField.setAttribute("readonly", "");
    copyField.setAttribute("aria-hidden", "true");
    copyField.style.position = "fixed";
    copyField.style.left = "-9999px";
    copyField.style.opacity = "0";
    copyField.style.pointerEvents = "none";
    document.body.append(copyField);
    copyField.focus({ preventScroll: true });
    copyField.select();
    copyField.setSelectionRange(0, copyField.value.length);

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      copyField.remove();
    }
  }

  for (const link of platformLinks) {
    link.href = platformUrls[link.dataset.sharePlatform];
    link.addEventListener("click", () => {
      setDialogOpen(false);
    });
  }

  shareButton.addEventListener("click", () => {
    setDialogOpen(true);
  });

  kakaoButton.addEventListener("click", () => {
    if (kakaoSdkError) {
      showStatus("카카오톡 공유 설정을 확인해주세요");
      return;
    }

    if (!kakaoSdk) {
      showStatus("카카오톡 공유를 준비하고 있습니다");
      return;
    }

    try {
      kakaoSdk.Share.sendDefault({
        objectType: "feed",
        content: {
          title: shareTitle,
          description: shareText,
          imageUrl: "https://tycheworks.com/assets/Immersa/Chemical%20Safety%20Training%20VR/metahorizon_og_banner_1200x630.png",
          imageWidth: 1200,
          imageHeight: 630,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [
          {
            title: "VR 상세페이지 보기",
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
        ],
      });
      setDialogOpen(false);
    } catch {
      showStatus("카카오톡 공유를 열지 못했습니다");
    }
  });

  for (const closeButton of closeButtons) {
    closeButton.addEventListener("click", () => {
      setDialogOpen(false);
    });
  }

  copyButton.addEventListener("click", async () => {
    const copied = await copyShareUrl();

    if (copied) {
      setDialogOpen(false);
      showStatus("링크를 복사했습니다");
    } else {
      copyButton.focus();
      showStatus("주소창의 링크를 복사해주세요");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shareDialog.hidden) {
      setDialogOpen(false);
    }
  });

  prepareKakaoShare().catch((error) => {
    kakaoSdkError = error;
  });
}
