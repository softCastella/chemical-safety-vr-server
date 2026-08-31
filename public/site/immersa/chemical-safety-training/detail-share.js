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
    naver: `https://blog.naver.com/openapi/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
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
        script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
        script.integrity = "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";
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
          imageUrl: "https://tycheworks.com/assets/metahorizon_og_banner_1200x630.png",
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

  prepareKakaoShare().catch((error) => {
    kakaoSdkError = error;
  });
}
