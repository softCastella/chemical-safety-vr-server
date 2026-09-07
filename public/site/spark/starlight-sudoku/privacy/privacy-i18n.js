const translations = {
  ko: {
    pageTitle: "개인정보처리방침 | 별빛 스도쿠", back: "← 별빛 스도쿠 상세로", title: "개인정보처리방침", intro: "별빛 스도쿠 앱과 공식 웹페이지에서 처리하는 정보를 안내합니다.", effective: "시행일: 2026년 9월 4일",
    scopeTitle: "1. 적용 범위와 서비스 정보", scopeBody: "이 방침은 Tyche Works가 제공하는 별빛 스도쿠 체험판 Android 앱과 공식 웹페이지에 적용됩니다. 앱 ID는 com.tychespark.starlightsudoku입니다.",
    dataTitle: "2. 앱이 수집하지 않는 정보", dataBody: "앱은 계정, 이름, 이메일 주소, 전화번호, 위치, 사진, 광고 ID를 수집하지 않습니다. Google 로그인, Firebase Analytics와 AdMob도 사용하지 않습니다.",
    localTitle: "3. 기기에만 저장하는 정보", localBody: "퍼즐 진행과 이어하기, 별빛, 스테이지 클리어 상태, BGM·효과음 설정, 오프닝·체험판 안내 확인 여부를 기기의 앱 저장소에 보관합니다. 기기에서 생성한 SS- 형식의 익명 사용자 ID도 저장하지만 계정 식별자가 아니며, 이 정보들은 Tyche Works 서버로 전송하거나 서버에 백업하지 않습니다.",
    websiteTitle: "4. 웹페이지가 처리하는 정보", websiteBody: "웹페이지에는 회원가입과 사용자 정보 입력 기능이 없습니다. 선택한 언어는 브라우저의 starlight-sudoku-locale 항목에 저장되며 서버로 전송되지 않습니다. 보안과 장애 대응을 위한 일반 접속 로그에는 IP, 접속 시각, 요청 주소, 응답 상태, 리퍼러와 브라우저 정보가 자동으로 남을 수 있으며 최대 14일 후 삭제합니다.",
    sharingTitle: "5. 제3자 제공과 외부 전송", sharingBody: "앱에 광고 또는 분석 SDK가 없으며, 기기에 저장한 게임 데이터를 제3자에게 제공하거나 국외로 전송하지 않습니다. 사용자가 체험판 종료 후 선택적으로 ‘전송’을 누르면 앱은 Google Play 인앱 리뷰 흐름을 요청하며, 화면 표시 여부는 Google Play가 결정합니다. 리뷰 화면에 입력한 평점과 리뷰 문구는 Google Play가 수집해 스토어에 공개할 수 있고 전송 시 암호화되며, 사용자는 Google Play Store 또는 Google 계정에서 리뷰를 삭제할 수 있습니다.",
    deletionTitle: "6. 보유 기간과 삭제", deletionBody: "앱 데이터는 앱을 삭제하거나 기기 설정에서 앱 데이터를 삭제할 때까지 기기에 남습니다. 웹페이지의 언어 설정은 브라우저 사이트 데이터를 삭제하면 지울 수 있습니다. Tyche Works 서버에는 앱 데이터 백업이 없어 별도의 서버 삭제 요청 대상이 없습니다.",
    childrenTitle: "7. 아동의 이용", childrenBody: "별빛 스도쿠는 연령에 따라 이용을 제한하지 않는 퍼즐 게임입니다. 다만 만 14세 미만 아동을 주요 대상으로 기획하거나 홍보하는 서비스는 아니며 Google Play의 Designed for Families 프로그램 대상이 아닙니다. 앱은 이용자의 생년월일이나 연령 정보를 수집하지 않습니다.",
    rightsTitle: "8. 보호 조치와 문의", rightsBody: "공식 웹페이지는 일반 HTTPS 연결을 사용합니다. 개인정보 관련 문의는 tycheworks0101@gmail.com으로 보내주세요.",
    changesTitle: "9. 방침 변경", changesBody: "광고·분석 기능 등 서비스 또는 데이터 처리 방식이 바뀌면 Google Play 데이터 보안 양식과 이 페이지를 함께 갱신하고 변경된 시행일을 표시합니다.", references: "공식 참고", userDataReference: "Google Play 사용자 데이터 정책", dataSafetyReference: "Google Play 데이터 보안", reviewReference: "Google Play 인앱 리뷰", common: "TYCHE WORKS 공용 방침"
  },
  en: {
    pageTitle: "Privacy Policy | Starlight Sudoku", back: "← Back to Starlight Sudoku", title: "Privacy Policy", intro: "This policy explains how the Starlight Sudoku app and official website handle information.", effective: "Effective: September 4, 2026",
    scopeTitle: "1. Scope and service information", scopeBody: "This policy applies to the Starlight Sudoku trial Android app and official website provided by Tyche Works. The app ID is com.tychespark.starlightsudoku.",
    dataTitle: "2. Information the app does not collect", dataBody: "The app does not collect accounts, names, email addresses, phone numbers, locations, photos, or advertising IDs. It also does not use Google Sign-In, Firebase Analytics, or AdMob.",
    localTitle: "3. Information stored only on your device", localBody: "The app stores puzzle progress and resume data, starlight, stage completion status, BGM and sound-effect settings, and whether the opening and trial notices have been viewed in the app storage on your device. It also stores an anonymous user ID beginning with ss- that is generated on the device, but this is not an account identifier. This information is neither sent to nor backed up on Tyche Works servers.",
    websiteTitle: "4. Information handled by the website", websiteBody: "The website has no account registration or user-information form. Your language choice is stored in your browser under starlight-sudoku-locale and is not sent to the server. Standard access logs used for security and troubleshooting may automatically contain an IP address, access time, requested URL, response status, referrer, and browser information, and are deleted after no more than 14 days.",
    sharingTitle: "5. Third-party sharing and external transfers", sharingBody: "The app contains no advertising or analytics SDK, and game data stored on the device is not provided to third parties or transferred overseas. If you optionally tap ‘Submit’ after completing the trial, the app requests the Google Play in-app review flow; Google Play determines whether the review screen appears. Google Play collects any rating and review text entered there and may publish it on the store. The data is encrypted in transit, and you can delete your review through the Google Play Store or your Google Account.",
    deletionTitle: "6. Retention and deletion", deletionBody: "App data remains on your device until you uninstall the app or clear its data in the device settings. You can remove the website language setting by clearing browser site data. Tyche Works servers do not back up app data, so there is no server-held app data for which a separate deletion request is required.",
    childrenTitle: "7. Children", childrenBody: "Starlight Sudoku is a puzzle game that does not restrict use by age. However, it is not designed or marketed primarily for children under 14 and does not participate in the Google Play Designed for Families program. The app does not collect users’ dates of birth or age information.",
    rightsTitle: "8. Safeguards and contact", rightsBody: "The official website uses a standard HTTPS connection. For privacy questions, contact tycheworks0101@gmail.com.",
    changesTitle: "9. Changes", changesBody: "If the service or its data practices change, including the addition of advertising or analytics, the Google Play Data safety form and this page will be updated together and the revised effective date will be shown.", references: "Official references", userDataReference: "Google Play User Data policy", dataSafetyReference: "Google Play Data safety", reviewReference: "Google Play in-app reviews", common: "TYCHE WORKS general policy"
  },
  ja: {
    pageTitle: "プライバシーポリシー | 星明かりの数独", back: "← 星明かりの数独の詳細へ", title: "プライバシーポリシー", intro: "星明かりの数独アプリと公式ウェブページにおける情報の取り扱いについてご案内します。", effective: "施行日：2026年9月4日",
    scopeTitle: "1. 適用範囲とサービス情報", scopeBody: "本ポリシーは、Tyche Worksが提供する星明かりの数独の体験版Androidアプリと公式ウェブページに適用されます。アプリIDはcom.tychespark.starlightsudokuです。",
    dataTitle: "2. アプリが収集しない情報", dataBody: "本アプリは、アカウント、氏名、メールアドレス、電話番号、位置情報、写真、広告IDを収集しません。また、Googleログイン、Firebase Analytics、AdMobも使用しません。",
    localTitle: "3. 端末内にのみ保存する情報", localBody: "パズルの進行・再開データ、スターライト、ステージのクリア状況、BGM・効果音の設定、オープニング・体験版案内の確認状況を端末内のアプリストレージに保存します。端末で生成したss-から始まる匿名ユーザーIDも保存しますが、アカウント識別子ではありません。これらの情報をTyche Worksのサーバーへ送信したり、サーバーにバックアップしたりすることはありません。",
    websiteTitle: "4. ウェブページが取り扱う情報", websiteBody: "ウェブページには会員登録や利用者情報の入力機能がありません。選択した言語はブラウザのstarlight-sudoku-localeに保存され、サーバーには送信されません。セキュリティと障害対応のため、通常のアクセスログにIP、アクセス時刻、リクエストURL、応答状態、参照元、ブラウザ情報が自動記録される場合があり、最長14日後に削除します。",
    sharingTitle: "5. 第三者提供と外部送信", sharingBody: "本アプリには広告・分析SDKがなく、端末に保存されたゲームデータを第三者に提供したり、国外へ送信したりしません。体験版終了後、利用者が任意で「送信」をタップすると、アプリはGoogle Playのアプリ内レビューフローを要求し、画面を表示するかどうかはGoogle Playが決定します。入力された評価とレビュー文はGoogle Playが収集してストアに公開する場合があり、送信時に暗号化されます。レビューはGoogle Play StoreまたはGoogleアカウントから削除できます。",
    deletionTitle: "6. 保存期間と削除", deletionBody: "アプリデータは、アプリを削除するか端末設定でアプリデータを消去するまで端末に残ります。ウェブページの言語設定はブラウザのサイトデータを削除すると消去できます。Tyche Worksのサーバーにはアプリデータのバックアップがないため、サーバー上のアプリデータに対する個別の削除依頼は不要です。",
    childrenTitle: "7. 子どもの利用", childrenBody: "星明かりの数独は年齢による利用制限を設けていないパズルゲームです。ただし、14歳未満の子どもを主な対象として企画・宣伝するサービスではなく、Google PlayのDesigned for Familiesプログラムの対象ではありません。本アプリは利用者の生年月日や年齢情報を収集しません。",
    rightsTitle: "8. 保護措置とお問い合わせ", rightsBody: "公式ウェブページは一般的なHTTPS接続を使用します。プライバシーに関するお問い合わせはtycheworks0101@gmail.comまでお願いします。",
    changesTitle: "9. ポリシーの変更", changesBody: "広告・分析機能の追加など、サービスまたはデータ処理方法が変わる場合は、Google Playのデータセーフティ表示と本ページを同時に更新し、変更後の施行日を表示します。", references: "公式資料", userDataReference: "Google Playユーザーデータポリシー", dataSafetyReference: "Google Playデータセーフティ", reviewReference: "Google Playアプリ内レビュー", common: "TYCHE WORKS 共通ポリシー"
  },
  "zh-CN": {
    pageTitle: "隐私政策 | 星光数独", back: "← 返回星光数独详情", title: "隐私政策", intro: "本政策说明《星光数独》应用及其官方网站如何处理信息。", effective: "生效日期：2026年9月4日",
    scopeTitle: "1. 适用范围与服务信息", scopeBody: "本政策适用于Tyche Works提供的《星光数独》体验版Android应用及官方网站。应用ID为com.tychespark.starlightsudoku。",
    dataTitle: "2. 应用不收集的信息", dataBody: "本应用不收集账号、姓名、电子邮件地址、电话号码、位置信息、照片或广告ID，也不使用Google登录、Firebase Analytics或AdMob。",
    localTitle: "3. 仅存储在设备上的信息", localBody: "应用会将谜题进度与继续游戏数据、星光、关卡完成状态、背景音乐与音效设置，以及是否已查看开场和体验版提示保存在设备的应用存储中。设备还会生成并保存以ss-开头的匿名用户ID，但该ID不是账号标识。这些信息不会发送至Tyche Works服务器，也不会备份到服务器。",
    websiteTitle: "4. 网页处理的信息", websiteBody: "网页不提供账号注册，也不要求输入用户信息。所选语言以starlight-sudoku-locale保存在浏览器中，不会发送到服务器。用于安全和故障排查的常规访问日志可能自动记录IP、访问时间、请求地址、响应状态、来源页面和浏览器信息，并在最长14天后删除。",
    sharingTitle: "5. 第三方提供与外部传输", sharingBody: "本应用不含广告或分析SDK，也不会向第三方提供或向境外传输存储在设备上的游戏数据。用户在完成体验版后可选择点击“提交”，应用随后会请求Google Play应用内评价流程，是否显示评价页面由Google Play决定。Google Play会收集用户输入的评分和评价文字，并可能在商店公开；数据在传输时会加密，用户可通过Google Play商店或Google账号删除评价。",
    deletionTitle: "6. 保留期限与删除", deletionBody: "应用数据会保留在设备上，直至卸载应用或在设备设置中清除应用数据。清除浏览器网站数据即可删除网页的语言设置。Tyche Works服务器不备份应用数据，因此不存在需要另行申请删除的服务器端应用数据。",
    childrenTitle: "7. 儿童使用", childrenBody: "《星光数独》是一款不按年龄限制使用的益智游戏，但并非以14岁以下儿童为主要设计或宣传对象，也不参加Google Play的Designed for Families计划。本应用不收集用户的出生日期或年龄信息。",
    rightsTitle: "8. 安全措施与联系", rightsBody: "官方网站使用标准HTTPS连接。隐私相关问题请联系tycheworks0101@gmail.com。",
    changesTitle: "9. 政策变更", changesBody: "如增加广告或分析功能等导致服务或数据处理方式发生变化，我们将同步更新Google Play数据安全表单和本页面，并标明变更后的生效日期。", references: "官方参考", userDataReference: "Google Play用户数据政策", dataSafetyReference: "Google Play数据安全", reviewReference: "Google Play应用内评价", common: "TYCHE WORKS通用政策"
  },
  "zh-TW": {
    pageTitle: "隱私權政策 | 星光數獨", back: "← 返回星光數獨詳情", title: "隱私權政策", intro: "本政策說明星光數獨應用程式及其官方網頁如何處理資訊。", effective: "生效日期：2026年9月4日",
    scopeTitle: "1. 適用範圍與服務資訊", scopeBody: "本政策適用於Tyche Works提供的星光數獨體驗版Android應用程式與官方網頁。應用程式ID為com.tychespark.starlightsudoku。",
    dataTitle: "2. 應用程式不收集的資訊", dataBody: "本應用程式不收集帳號、姓名、電子郵件地址、電話號碼、位置資訊、照片或廣告ID，也不使用Google登入、Firebase Analytics或AdMob。",
    localTitle: "3. 僅儲存在裝置上的資訊", localBody: "應用程式會將謎題進度與繼續遊戲資料、星光、關卡完成狀態、背景音樂與音效設定，以及是否已查看開場和體驗版提示儲存在裝置的應用程式儲存空間中。裝置也會產生並儲存以ss-開頭的匿名使用者ID，但該ID不是帳號識別碼。這些資訊不會傳送至Tyche Works伺服器，也不會備份到伺服器。",
    websiteTitle: "4. 網頁處理的資訊", websiteBody: "網頁不提供帳號註冊，也不要求輸入使用者資訊。所選語言以starlight-sudoku-locale儲存在瀏覽器中，不會傳送至伺服器。用於安全與故障排查的一般存取日誌可能自動記錄IP、存取時間、請求網址、回應狀態、來源頁面與瀏覽器資訊，並於最長14天後刪除。",
    sharingTitle: "5. 第三方提供與外部傳輸", sharingBody: "本應用程式不含廣告或分析SDK，也不會向第三方提供或向境外傳輸儲存在裝置上的遊戲資料。使用者完成體驗版後可選擇點擊「提交」，應用程式隨後會要求Google Play應用程式內評論流程，是否顯示評論畫面由Google Play決定。Google Play會收集使用者輸入的評分與評論文字，並可能在商店公開；資料在傳輸時會加密，使用者可透過Google Play商店或Google帳戶刪除評論。",
    deletionTitle: "6. 保留期間與刪除", deletionBody: "應用程式資料會保留在裝置上，直到解除安裝應用程式或在裝置設定中清除應用程式資料。清除瀏覽器網站資料即可刪除網頁的語言設定。Tyche Works伺服器不備份應用程式資料，因此沒有需要另行申請刪除的伺服器端應用程式資料。",
    childrenTitle: "7. 兒童使用", childrenBody: "星光數獨是一款不依年齡限制使用的益智遊戲，但並非以14歲以下兒童為主要設計或宣傳對象，也不參加Google Play的Designed for Families計畫。本應用程式不收集使用者的出生日期或年齡資訊。",
    rightsTitle: "8. 安全措施與聯絡", rightsBody: "官方網頁使用標準HTTPS連線。隱私相關問題請聯絡tycheworks0101@gmail.com。",
    changesTitle: "9. 政策變更", changesBody: "如新增廣告或分析功能等導致服務或資料處理方式變更，我們將同步更新Google Play資料安全表單與本頁面，並標示變更後的生效日期。", references: "官方參考", userDataReference: "Google Play使用者資料政策", dataSafetyReference: "Google Play資料安全", reviewReference: "Google Play應用程式內評論", common: "TYCHE WORKS通用政策"
  }
};

function normalizeLocale(value) {
  const locale = String(value || "").toLowerCase();
  if (locale.startsWith("zh-tw") || locale.startsWith("zh-hk") || locale === "tw") return "zh-TW";
  if (locale.startsWith("zh")) return "zh-CN";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("en")) return "en";
  return "ko";
}

function applyLocale(locale, updateUrl = true) {
  const resolved = translations[locale] ? locale : "ko";
  const copy = translations[resolved];
  document.documentElement.lang = resolved;
  document.title = copy.pageTitle;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = copy[element.dataset.i18n];
    if (value) element.textContent = value;
  });
  document.querySelectorAll("[data-locale]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.locale === resolved)));
  const detailLink = document.querySelector("[data-detail-link]");
  if (detailLink) detailLink.href = resolved === "ko" ? "../" : `../?lang=${encodeURIComponent(resolved)}`;
  try { localStorage.setItem("starlight-sudoku-locale", resolved); } catch {}
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (resolved === "ko") url.searchParams.delete("lang"); else url.searchParams.set("lang", resolved);
    history.replaceState(null, "", url);
  }
}

const queryLocale = new URLSearchParams(window.location.search).get("lang");
let storedLocale = "";
try { storedLocale = localStorage.getItem("starlight-sudoku-locale") || ""; } catch {}
applyLocale(queryLocale ? normalizeLocale(queryLocale) : normalizeLocale(storedLocale || navigator.language), Boolean(queryLocale));
document.querySelectorAll("[data-locale]").forEach((button) => button.addEventListener("click", () => applyLocale(button.dataset.locale)));
