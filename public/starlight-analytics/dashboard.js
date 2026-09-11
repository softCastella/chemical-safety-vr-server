(function(){
  "use strict";
  const $=(selector)=>document.querySelector(selector),$$=(selector)=>[...document.querySelectorAll(selector)];
  const state={data:null,days:7,heatmap:null,heatmapView:null,miniHeatmaps:[]};
  const labels={
    landing_view:"랜딩 조회",landing_cta_click:"랜딩 CTA",game_open:"게임 열기",game_ready:"게임 준비",puzzle_start:"퍼즐 시작",
    demo_complete:"데모 완료",store_cta_click:"스토어 이동",cell_select:"셀 선택",number_input:"숫자 입력",wrong_input:"오답",
    erase:"삭제",memo_toggle:"메모 전환",memo_input:"메모 입력",hint_open:"힌트 열기",hint_used:"힌트 사용",restart:"다시 풀기",
    pause:"일시정지",resume:"계속 풀기",settings_open:"설정",language_open:"언어 열기",language_change:"언어 변경",
    home_click:"나가기",next_stage_click:"다음 단계",village_click:"마을 보기",web:"웹",android:"안드로이드",
    session_duration:"세션 시간",active_engagement_time:"활성 이용 시간",game_screen_time:"게임 화면 체류",
    active_play_time:"실제 플레이 시간",puzzle_clear_time:"퍼즐 완료 시간",time_to_first_action:"첫 조작까지",
    time_to_first_hint:"첫 힌트까지",time_to_exit:"이탈까지",
  };

  document.addEventListener("DOMContentLoaded",()=>{
    state.heatmap=new StarlightHeatmap($("#heatmap-canvas"),renderHotspot);
    bindNavigation();bindFilters();bindHeatmap();$("#refresh-data").addEventListener("click",load);
    setDateRange(7);load();
  });

  function bindNavigation(){
    $$(".nav-item").forEach((button)=>button.addEventListener("click",()=>{
      $$(".nav-item").forEach((item)=>item.classList.toggle("active",item===button));
      $$(".view").forEach((view)=>view.classList.toggle("active",view.id===`view-${button.dataset.view}`));
      $("#page-title").textContent=button.textContent;
      if(button.dataset.view==="heatmap")requestAnimationFrame(()=>{state.heatmap.resize();state.miniHeatmaps.forEach((entry)=>entry.map.resize());});
    }));
  }

  function bindFilters(){
    $$("#range-buttons button").forEach((button)=>button.addEventListener("click",()=>{
      $$("#range-buttons button").forEach((item)=>item.classList.toggle("active",item===button));
      const value=button.dataset.days;
      $$(".custom-only").forEach((item)=>item.classList.toggle("hidden",value!=="custom"));
      if(value!=="custom"){state.days=Number(value);setDateRange(state.days);load();}
    }));
    ["date-from","date-to","filter-platform","filter-locale","filter-source","filter-campaign","filter-stage"].forEach((id)=>$("#"+id).addEventListener("change",load));
  }

  function setDateRange(days){
    const end=new Date(),start=new Date();
    if(days>0)start.setDate(end.getDate()-days+1);
    $("#date-from").value=start.toISOString().slice(0,10);$("#date-to").value=end.toISOString().slice(0,10);
  }

  async function load(){
    const params=new URLSearchParams({
      from:$("#date-from").value,to:$("#date-to").value,platform:$("#filter-platform").value,
      locale:$("#filter-locale").value,source:$("#filter-source").value,campaign:$("#filter-campaign").value,stage:$("#filter-stage").value,
    });
    let data;
    try{
      const response=await fetch(`/api/starlight-analytics/dashboard?${params}`,{credentials:"same-origin"});
      if(response.status===401){location.assign("/server/login");return;}
      if(!response.ok)throw new Error(`dashboard ${response.status}`);
      const live=await response.json();
      data=live.meta?.has_any_data?live:window.STARLIGHT_SAMPLE_DASHBOARD;
    }catch(error){console.warn("Starlight dashboard API unavailable; showing sample data.",error);data=window.STARLIGHT_SAMPLE_DASHBOARD;}
    state.data=data;render(data);
  }

  function render(data){
    const sample=data.meta?.data_state==="sample";
    $("#data-badge").textContent=sample?"샘플 데이터":"실시간 데이터";
    $("#data-badge").className=`data-badge ${sample?"sample":"live"}`;
    $("#range-note").textContent=`${data.meta?.from||$("#date-from").value} ~ ${data.meta?.to||$("#date-to").value} · ${sample?"실데이터 수집 전 예시":"실제 익명 이벤트"}`;
    fillSelect("#filter-locale",data.filters?.locales,"전체 언어");fillSelect("#filter-source",data.filters?.sources,"전체 유입 경로");
    fillSelect("#filter-campaign",data.filters?.campaigns,"전체 캠페인");fillSelect("#filter-stage",data.filters?.stages,"전체 단계");
    renderOverview(data);renderAcquisition(data.acquisition||[]);renderFunnel(data.funnel||[]);renderPlay(data.play||[]);
    renderStages(data.stages||[]);renderInteractions(data);renderRetention(data.retention||[]);renderPlatforms(data.platforms||[]);renderHeatmapOptions();
  }

  function fillSelect(selector,values,allLabel){const select=$(selector),prior=select.value;select.innerHTML=`<option value="all">${escapeHtml(allLabel)}</option>`+(values||[]).map((item)=>`<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");if([...select.options].some((option)=>option.value===prior))select.value=prior;}
  function renderOverview(data){const value=data.overview||{};const cards=[["순 사용자",integer(value.users)],["세션",integer(value.sessions)],["게임 열기",integer(value.game_opens)],["퍼즐 시작",integer(value.puzzle_starts)],["데모 완료",integer(value.demo_completes)],["시작률",percent(value.start_rate)],["랜딩 완료율",percent(value.completion_rate)],["평균 실제 플레이",duration(value.active_play_time?.average)]];$("#overview-kpis").innerHTML=cards.map(([label,number])=>`<article class="kpi"><span>${label}</span><strong>${number}</strong><small>선택 기간</small></article>`).join("");renderDaily(data.daily||[]);renderJourney(data.funnel||[]);}
  function renderDaily(rows){const max=Math.max(1,...rows.map((row)=>Math.max(row.users||0,row.stage_clears||0)));$("#daily-chart").innerHTML=rows.map((row)=>`<div class="bar-col"><div class="bar-pair"><i style="height:${Math.max(2,(row.users||0)/max*100)}%"></i><i style="height:${Math.max(2,(row.stage_clears||0)/max*100)}%"></i></div><small>${escapeHtml(row.date?.slice(5)||"")}</small></div>`).join("")||emptyState();}
  function renderJourney(rows){$("#journey-summary").innerHTML=rows.filter((_,index)=>[0,1,4,6,10,15].includes(index)).map((row)=>`<div class="journey-row"><div><b>${escapeHtml(title(row.step))}</b><span>${integer(row.users)}명</span></div><div class="progress"><i style="width:${Math.min(100,(row.landing_conversion||0)*100)}%"></i></div></div>`).join("")||emptyState();}
  function renderAcquisition(rows){$("#acquisition-table").innerHTML=rows.map((row)=>`<tr><td>${escapeHtml(row.source)} / ${escapeHtml(row.medium)}</td><td>${escapeHtml(row.campaign)}</td><td>${integer(row.users)}</td><td>${percent(row.start_rate)}</td><td>${percent(row.complete_rate)}</td></tr>`).join("")||emptyRow(5);}
  function renderFunnel(rows){$("#funnel-table").innerHTML=rows.map((row,index)=>`<tr><td><div class="funnel-step"><span class="step-index">${index+1}</span>${escapeHtml(title(row.step))}</div></td><td>${integer(row.users)}</td><td>${percent(row.previous_conversion)}</td><td>${percent(row.landing_conversion)}</td><td>${integer(row.dropoff_users)}</td><td>${percent(row.dropoff_rate)}</td><td>${duration(row.avg_time_to_next)}</td></tr>`).join("")||emptyRow(7);}
  function renderPlay(rows){$("#play-metrics").innerHTML=rows.map((row)=>`<article class="metric-card"><span>${escapeHtml(title(row.metric))}</span><strong>${duration(row.average)}</strong><div class="quartiles"><div><b>${duration(row.median)}</b><small>중앙값</small></div><div><b>${duration(row.p75)}</b><small>P75</small></div><div><b>${duration(row.p90)}</b><small>P90</small></div></div></article>`).join("")||emptyState();}
  function renderStages(rows){const alerts=rows.filter((row)=>row.status!=="healthy");$("#stage-alerts").innerHTML=alerts.map((row)=>`<div class="stage-alert"><b>${row.stage}단계 병목 주의</b><span>점수 ${row.bottleneck_score}</span></div>`).join("");$("#stages-table").innerHTML=rows.map((row)=>`<tr><td>${row.stage}</td><td>${integer(row.start_users)}</td><td>${integer(row.clear_users)} · ${percent(row.clear_rate)}</td><td>${integer(row.exit_users)} · ${percent(row.exit_rate)}</td><td>${integer(row.restart_users)} · ${percent(row.restart_rate)}</td><td>${duration(row.average_clear_time)} / ${duration(row.median_clear_time)} / ${duration(row.p90_clear_time)}</td><td>${row.average_mistakes}</td><td>${integer(row.hint_users)} · ${row.hints_per_user}</td><td>${integer(row.memo_users)}</td><td>${integer(row.erase_count)}</td><td>${integer(row.attempt_count)} · ${row.average_attempts_to_clear}</td><td>${percent(row.next_stage_conversion)}</td><td>${row.exit_remaining_cells}칸 / ${duration(row.exit_elapsed_time)}</td><td><span class="status ${row.status}">${row.bottleneck_score}</span></td></tr>`).join("")||emptyRow(14);}
  function renderInteractions(data){$("#interaction-table").innerHTML=(data.interactions||[]).map((row)=>`<tr><td>${escapeHtml(title(row.event))}</td><td>${integer(row.count)}</td><td>${integer(row.users)}</td><td>${row.per_user}</td></tr>`).join("")||emptyRow(4);$("#expectation-list").innerHTML=(data.expectation||[]).map((row)=>`<div class="expectation-row"><b>${escapeHtml(title(row.screen_id))}</b><p>비기능 클릭 ${percent(row.non_interactive_click_rate)} · 사용자 ${integer(row.unique_users)}명 · 반복 ${integer(row.repeat_users)}명</p><small>${(row.top_targets||[]).map((item)=>`${escapeHtml(title(item.target))} ${integer(item.count)}회`).join(" · ")||"비기능 클릭 없음"}</small></div>`).join("")||emptyState();}
  function renderRetention(rows){$("#retention-table").innerHTML=rows.map((row)=>`<tr><td>${escapeHtml(row.cohort)}</td><td>${integer(row.users)}</td><td>${percent(row.d1)}</td><td>${percent(row.d7)}</td><td>${percent(row.d30)}</td></tr>`).join("")||emptyRow(5);}
  function renderPlatforms(rows){$("#platform-grid").innerHTML=rows.map((row)=>`<article class="platform-card ${row.state==="no_data"?"no-data":""}"><span>${row.state==="no_data"?"준비됨 · 데이터 없음":"실시간 데이터"}</span><h3>${escapeHtml(title(row.platform))}</h3><div class="platform-stats"><div><b>${integer(row.users)}</b><small> 사용자</small></div><div><b>${integer(row.sessions)}</b><small> 세션</small></div><div><b>${integer(row.starts)}</b><small> 시작</small></div><div><b>${integer(row.completes)}</b><small> 완료</small></div></div></article>`).join("");}

  function bindHeatmap(){["heatmap-type","heatmap-stage"].forEach((id)=>$("#"+id).addEventListener("change",renderHeatmap));$$("[data-heatmap-platform]").forEach((button)=>button.addEventListener("click",()=>setHeatmapPlatform(button.dataset.heatmapPlatform)));}
  function setHeatmapPlatform(platform){$$("[data-heatmap-platform]").forEach((button)=>{const active=button.dataset.heatmapPlatform===platform;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});$("#heatmap-web-content").classList.toggle("hidden",platform!=="web");$("#heatmap-app-content").classList.toggle("hidden",platform!=="android");if(platform==="web")requestAnimationFrame(()=>{renderHeatmap();state.heatmap.resize();state.miniHeatmaps.forEach((entry)=>entry.map.resize());});}
  function webCatalog(){return window.STARLIGHT_SCREEN_CATALOGS?.web||window.STARLIGHT_SCREEN_CATALOG||[];}
  function catalogViews(){return webCatalog().flatMap((group)=>group.items||[]);}
  function matchesView(point,view){return point.screen_id===view.screenId&&(view.overlayId===null?!point.overlay_id:point.overlay_id===view.overlayId);}
  function pointsForView(view,applyType=true){if(!state.data||!view)return[];const type=$("#heatmap-type").value,stage=$("#heatmap-stage").value;let points=(state.data.heatmap?.points||[]).filter((point)=>matchesView(point,view));if(applyType&&type!=="all"&&type!=="dwell")points=points.filter((point)=>point.category===type);if(view.screenId==="game"&&stage!=="all")points=points.filter((point)=>String(point.stage_id)===stage);return points;}
  function renderHeatmapOptions(){const groups=webCatalog(),views=catalogViews();if(!state.heatmapView||!views.some((view)=>view.key===state.heatmapView.key))state.heatmapView=views[0]||null;state.miniHeatmaps.forEach((entry)=>entry.map.destroy());state.miniHeatmaps=[];$("#heatmap-catalog").innerHTML=groups.map((group)=>`<section class="screen-row"><div class="screen-row-head"><h2>${escapeHtml(group.label)}</h2><span>같은 화면의 상태를 가로로 비교</span></div><div class="screen-row-items">${group.items.map((view)=>{const count=pointsForView(view,false).reduce((sum,point)=>sum+(point.count||1),0);return `<button type="button" class="screen-tile ${state.heatmapView?.key===view.key?"active":""}" data-heatmap-view="${escapeHtml(view.key)}"><span class="screen-thumb" style="--chrome-top:${view.chromeTop*100}%"><img src="${escapeHtml(view.image)}" alt="${escapeHtml(view.label)} 실제 배포 화면"><canvas></canvas></span><span class="screen-tile-meta"><b>${escapeHtml(view.label)}</b><small>이벤트 ${integer(count)}건</small></span></button>`;}).join("")}</div></section>`).join("");$$("[data-heatmap-view]").forEach((button)=>{const view=views.find((item)=>item.key===button.dataset.heatmapView),map=new StarlightHeatmap(button.querySelector("canvas"),()=>{});state.miniHeatmaps.push({view,map});button.addEventListener("click",()=>selectHeatmapView(view));});renderHeatmap();}
  function selectHeatmapView(view){state.heatmapView=view;$$("[data-heatmap-view]").forEach((button)=>button.classList.toggle("active",button.dataset.heatmapView===view.key));renderHeatmap();$("#screen-frame").scrollIntoView({behavior:"smooth",block:"center"});}
  function renderHeatmap(){if(!state.data||!state.heatmapView)return;const view=state.heatmapView,type=$("#heatmap-type").value;$("#heatmap-stage-wrap").classList.toggle("hidden",view.screenId!=="game");$("#heatmap-detail-title").textContent=view.label;const frame=$("#screen-frame"),image=$("#screen-background");frame.style.setProperty("--chrome-top",`${view.chromeTop*100}%`);image.src=view.image;image.alt=`${view.label} 실제 배포 화면`;state.heatmap.setPoints(pointsForView(view),type);state.miniHeatmaps.forEach((entry)=>entry.map.setPoints(pointsForView(entry.view),type));renderHotspot(null);}
  function renderHotspot(point){const box=$("#hotspot-detail");if(!point){box.className="empty-state";box.textContent="히트맵에서 밀집 영역을 클릭하면 이벤트 수, 사용자, 대상과 경과 시간을 표시합니다.";return;}const total=pointsForView(state.heatmapView,false).reduce((sum,item)=>sum+(item.count||1),0);box.className="hotspot-grid";box.innerHTML=`<div><b>${integer(point.count)}</b><small>이벤트 수</small></div><div><b>${integer(point.unique_users)}</b><small>순 사용자*</small></div><div><b>${percent(point.count/Math.max(1,total))}</b><small>화면 내 이벤트 비중</small></div><div><b>${duration(point.average_elapsed_time)}</b><small>평균 경과 시간</small></div><div><b>${escapeHtml(title(point.target_id))}</b><small>대상 요소</small></div><div><b>${point.is_interactive?"기능 요소":"비기능 요소"}</b><small>${escapeHtml(title(point.target_type))}</small></div>`;}

  function title(value){if(value===null||value===undefined)return"-";return labels[value]||String(value).replace(/^stage_(\d)_(start|clear)$/,(_,stage,action)=>`${stage}단계 ${action==="start"?"시작":"완료"}`).replaceAll("_"," ");}
  function integer(value){return Math.round(Number(value)||0).toLocaleString("ko-KR");}
  function percent(value){return `${round((Number(value)||0)*100,1)}%`;}
  function duration(value){if(value===null||value===undefined||!Number.isFinite(Number(value)))return"-";const seconds=Math.round(Number(value));return seconds>=60?`${Math.floor(seconds/60)}분 ${seconds%60}초`:`${seconds}초`;}
  function round(value,digits){return Number(value.toFixed(digits));}
  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]);}
  function emptyRow(columns){return `<tr><td colspan="${columns}" class="empty-state">선택 조건에 해당하는 데이터가 없습니다.</td></tr>`;}
  function emptyState(){return '<p class="empty-state">선택 조건에 해당하는 데이터가 없습니다.</p>';}
})();
