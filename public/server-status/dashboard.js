const formatBytes=(value)=>{if(!Number.isFinite(value))return "—";const units=["B","KB","MB","GB","TB"];let size=value,index=0;while(size>=1024&&index<units.length-1){size/=1024;index+=1}return `${size.toFixed(index>1?1:0)} ${units[index]}`};
const setText=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value};
const setBar=(selector,value)=>{const node=document.querySelector(selector);if(node)node.style.width=`${Math.max(0,Math.min(100,value||0))}%`};

async function refresh(){
  try{
    const response=await fetch("/api/server-status/overview",{credentials:"same-origin",headers:{accept:"application/json"}});
    if(response.status===401){window.location.replace("/server-status/login");return}
    if(!response.ok)throw new Error("상태 정보를 불러오지 못했습니다.");
    const data=await response.json();
    const readOnly=data.currentUser?.role==="viewer";setText("[data-account-role]",readOnly?"VIEWER · 읽기 전용":"ADMIN");const addButton=document.querySelector("[data-add-ip]");if(addButton)addButton.hidden=readOnly;
    const memoryPercent=Math.round(data.memory.used/data.memory.total*100);
    const diskPercent=Math.round(data.disk.used/data.disk.total*100);
    setText("[data-memory-percent]",`${memoryPercent}%`);setText("[data-memory-used]",formatBytes(data.memory.used));setText("[data-memory-detail]",`${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)} · 잔여 ${formatBytes(data.memory.free)}`);setBar("[data-memory-bar]",memoryPercent);
    setText("[data-disk-percent]",`${diskPercent}%`);setText("[data-disk-used]",formatBytes(data.disk.used));setText("[data-disk-detail]",`${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)} · 잔여 ${formatBytes(data.disk.free)}`);setBar("[data-disk-bar]",diskPercent);
    setText("[data-uptime]",data.uptimeLabel);setText("[data-load]",`시스템 부하 ${data.load.join(" · ")}`);setText("[data-server-state]","정상");setText("[data-updated]",new Date(data.checkedAt).toLocaleString("ko-KR"));setText("[data-sync-state]","정상 연결");document.querySelector(".sync-state i")?.classList.add("online");
    const serviceGrid=document.querySelector("[data-services]");
    serviceGrid.replaceChildren(...data.services.map((service)=>{const card=document.createElement("article");card.className="service-card";const heading=document.createElement("div");const dot=document.createElement("span");dot.className=`service-dot ${service.status}`;const name=document.createElement("strong");name.textContent=service.name;heading.append(dot,name);const detail=document.createElement("p");detail.textContent=`${service.host}${service.path} · HTTP ${service.httpStatus??"실패"} · ${service.responseMs??"—"}ms`;card.append(heading,detail);return card}));
    const ports=document.querySelector("[data-ports]");
    ports.replaceChildren(...data.ports.map((port)=>{const row=document.createElement("tr");for(const value of [port.service,port.port,port.exposure,port.status==="online"?"정상":"확인 필요"]){const cell=document.createElement("td");cell.textContent=value;row.append(cell)}return row}));
    const certificates=document.querySelector("[data-certificates]");
    certificates.replaceChildren(...data.certificates.map((cert)=>{const card=document.createElement("article");card.className="certificate-card";const heading=document.createElement("div");const name=document.createElement("strong");name.textContent=cert.name;const state=document.createElement("span");state.className="status-pill";state.textContent=`${cert.daysRemaining}일 남음`;heading.append(name,state);const domains=document.createElement("p");domains.textContent=cert.domains.join(" · ");const meta=document.createElement("p");meta.textContent=`등록 ${new Date(cert.start).toLocaleDateString("ko-KR")} · 만료 ${new Date(cert.expiry).toLocaleDateString("ko-KR")} · 자동 갱신 ${cert.autoRenewal}`;card.append(heading,domains,meta);return card}));
    const ipList=document.querySelector("[data-ip-list]");
    ipList.replaceChildren(...data.trustedIps.map((entry)=>{const row=document.createElement("div");row.className="ip-row";const label=document.createElement("span");label.textContent=entry.label;const cidr=document.createElement("code");cidr.textContent=entry.cidr;const state=document.createElement("b");state.textContent=entry.enabled?"신뢰 위치":"비활성";row.append(label,cidr,state);if(!readOnly){const remove=document.createElement("button");remove.className="remove-ip";remove.type="button";remove.textContent="−";remove.disabled=data.trustedIps.filter((item)=>item.enabled).length<=1;remove.setAttribute("aria-label",`${entry.label} IP 삭제`);remove.addEventListener("click",()=>removeTrustedIp(entry.id));row.append(remove)}return row}));
    const events=Array.isArray(data.securityEvents)?data.securityEvents:[];
    const serverAlerts=Array.isArray(data.alerts)?data.alerts:[];
    const warning=document.querySelector("[data-security-warning]");
    const alertPanel=document.querySelector("[data-system-alerts-panel]");
    const alertList=document.querySelector("[data-system-alerts]");
    if(serverAlerts.length>0){alertPanel.hidden=false;alertList.replaceChildren(...serverAlerts.map((message)=>{const item=document.createElement("li");item.textContent=message;return item}));setText("[data-system-alert-count]",`${serverAlerts.length}건 확인 필요`)}else{alertPanel.hidden=true;alertList.replaceChildren()}
    const warningCount=events.length+serverAlerts.length;
    if(warningCount>0){warning.hidden=false;setText("[data-warning-title]",serverAlerts.length>0?"서버 이상 상태가 감지되었습니다.":"비정상 접속이 감지되었습니다.");setText("[data-warning-message]",`서버 경고 ${serverAlerts.length}건, 비정상 접속 ${events.length}건을 확인해주세요.`);setText("[data-security-event-count]",events.length?`${events.length}건 확인 필요`:"기록 없음")}else{warning.hidden=true;setText("[data-security-event-count]","기록 없음")}
    const eventRows=document.querySelector("[data-security-events]");
    if(events.length===0){const row=document.createElement("tr");const cell=document.createElement("td");cell.colSpan=5;cell.className="empty";cell.textContent="확인된 비정상 접속 이력이 없습니다.";row.append(cell);eventRows.replaceChildren(row)}else{eventRows.replaceChildren(...events.map((event)=>{const row=document.createElement("tr");for(const value of [new Date(event.createdAt).toLocaleString("ko-KR"),event.ipAddress,"확인 전","관리자 로그인 실패","기록됨"]){const cell=document.createElement("td");cell.textContent=value;row.append(cell)}return row}))}
  }catch(error){setText("[data-sync-state]","연결 실패");setText("[data-updated]",error.message)}
}

document.querySelector("[data-refresh]")?.addEventListener("click",refresh);
document.querySelector("[data-logout]")?.addEventListener("click",async()=>{await fetch("/api/server-status/logout",{method:"POST",credentials:"same-origin"});window.location.assign("/server-status/login")});
async function addTrustedIp(){const label=window.prompt("위치 이름을 입력하세요. (예: 집)");if(!label)return;const cidr=window.prompt("IPv4/CIDR을 입력하세요. (예: 123.123.123.123/32)");if(!cidr)return;const response=await fetch("/api/server-status/trusted-ips",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({label,cidr})});if(!response.ok){window.alert("IP를 추가하지 못했습니다.");return}await refresh()}
async function removeTrustedIp(id){if(!window.confirm("이 신뢰 IP를 삭제할까요?"))return;const response=await fetch(`/api/server-status/trusted-ips/${id}`,{method:"DELETE",credentials:"same-origin"});if(!response.ok){window.alert("마지막 신뢰 IP는 삭제할 수 없습니다.");return}await refresh()}
document.querySelector("[data-add-ip]")?.addEventListener("click",addTrustedIp);
refresh();setInterval(refresh,30000);
