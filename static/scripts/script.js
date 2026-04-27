let autoMode = localStorage.getItem("tf-auto") !== "0";
let currentTheme = localStorage.getItem("tf-theme") || "dark";
let selRes = null,
  selFmt = "mp4",
  curUrl = "",
  hist = [],
  curJobId = null;
try {
  hist = JSON.parse(localStorage.getItem("tf-hist") || "[]");
} catch (e) {}

function getSys() {
  return window.matchMedia("(prefers-color-scheme:dark)").matches
    ? "dark"
    : "light";
}
function applyTheme(t) {
  document.getElementById("app").setAttribute("data-t", t);
  document.getElementById("themeSel").value = t;
}
function setTheme(t) {
  currentTheme = t;
  autoMode = false;
  localStorage.setItem("tf-theme", t);
  localStorage.setItem("tf-auto", "0");
  document.getElementById("sysBtn").classList.remove("on");
  applyTheme(t);
}
function toggleAuto() {
  autoMode = !autoMode;
  localStorage.setItem("tf-auto", autoMode ? "1" : "0");
  const b = document.getElementById("sysBtn");
  autoMode
    ? (b.classList.add("on"), applyTheme(getSys()))
    : (b.classList.remove("on"), applyTheme(currentTheme));
}
window
  .matchMedia("(prefers-color-scheme:dark)")
  .addEventListener("change", () => {
    if (autoMode) applyTheme(getSys());
  });
function setFmt(f, el) {
  selFmt = f;
  document.querySelectorAll(".fmt").forEach((x) => x.classList.remove("sel"));
  el.classList.add("sel");
}
function setStatus(msg, cls) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}

async function doFetch() {
  const url = document.getElementById("urlInp").value.trim();
  if (!url) return;
  curUrl = url;
  const btn = document.getElementById("fetchBtn");
  btn.disabled = true;
  btn.textContent = "Fetching…";
  setStatus("");
  try {
    const r = await fetch("/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    renderVideo(d);
  } catch (e) {
    setStatus(e.message, "err");
  }
  btn.disabled = false;
  btn.textContent = "Fetch Info";
}

function renderVideo(d) {
  document.getElementById("thumb").src = d.thumbnail || "";
  document.getElementById("tp").style.display = "block";
  document.getElementById("vTitle").textContent = d.title || "";
  const m = Math.floor((d.duration || 0) / 60),
    s = (d.duration || 0) % 60;
  document.getElementById("tDur").textContent =
    m + ":" + String(s).padStart(2, "0");
  document.getElementById("tMax").textContent = (d.max_resolution || "?") + "p";
  document.getElementById("vSub").textContent =
    (d.uploader || "") +
    (d.view_count
      ? " · " + Intl.NumberFormat().format(d.view_count) + " views"
      : "");
  document.getElementById("sRes").textContent = (d.max_resolution || "?") + "p";
  document.getElementById("sDur").textContent = m + "m" + s + "s";
  document.getElementById("sFmt").textContent = (d.resolutions || []).length;
  document.getElementById("sgrid").style.display = "grid";

  const grid = document.getElementById("cgrid");
  grid.innerHTML = "";
  (d.resolutions || []).forEach((r, i) => {
    const c = document.createElement("div");
    c.className = "chip" + (i === 0 ? " sel best" : "");
    c.textContent = r + "p";
    c.onclick = () => {
      document
        .querySelectorAll(".chip")
        .forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      selRes = r;
    };
    grid.appendChild(c);
  });
  selRes = (d.resolutions || [])[0];

  const ib = document.getElementById("infoBody");
  let rows = "";
  if (d.upload_date)
    rows += `<div class="irow"><span class="ik">Uploaded</span><span class="iv">${d.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}</span></div>`;
  if (d.like_count)
    rows += `<div class="irow"><span class="ik">Likes</span><span class="iv">${Intl.NumberFormat().format(d.like_count)}</span></div>`;
  if (d.view_count)
    rows += `<div class="irow"><span class="ik">Views</span><span class="iv">${Intl.NumberFormat().format(d.view_count)}</span></div>`;
  if (d.channel)
    rows += `<div class="irow"><span class="ik">Channel</span><span class="iv">${d.channel}</span></div>`;
  if (rows) {
    ib.innerHTML = rows;
    document.getElementById("infoPanel").style.display = "block";
  }
  document.getElementById("videoPanel").style.display = "block";
}

async function doDl() {
  if (!curUrl) return;
  const btn = document.getElementById("dlBtn");
  const pw = document.getElementById("progWrap");
  btn.disabled = true;
  pw.style.display = "block";
  setStatus("");
  setProgress(0, "Starting…", null);

  try {
    const r = await fetch("/start_download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: curUrl,
        resolution: selFmt === "audio" ? "audio" : selRes,
      }),
    });
    const { job_id, error } = await r.json();
    if (error) throw new Error(error);
    curJobId = job_id;
    await listenProgress(job_id);
  } catch (e) {
    pw.style.display = "none";
    setStatus(e.message, "err");
  }
  btn.disabled = false;
}

function listenProgress(jobId) {
  return new Promise((resolve, reject) => {
    const es = new EventSource("/progress/" + jobId);
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);

      if (d.status === "downloading") {
        const msg = d.total
          ? `Downloading  ${d.downloaded} / ${d.total} MB`
          : "Downloading…";
        setProgress(d.percent, msg, d);
      } else if (d.status === "merging") {
        setProgress(95, "Merging video + audio…", null);
      } else if (d.status === "done") {
        setProgress(100, "Complete", null);
        es.close();
        triggerSave(jobId);
        resolve();
      } else if (d.status === "error") {
        es.close();
        reject(new Error(d.error || "Download failed"));
      }
    };
    es.onerror = () => {
      es.close();
      reject(new Error("Connection lost"));
    };
  });
}

function setProgress(pct, msg, meta) {
  document.getElementById("progFill").style.width = pct + "%";
  document.getElementById("progPct").textContent = pct + "%";
  document.getElementById("progMsg").textContent = msg;
  const m = document.getElementById("progMeta");
  if (meta && meta.speed) {
    m.innerHTML = `<span class="pm">Speed <strong>${meta.speed} MB/s</strong></span><span class="pm">ETA <strong>${meta.eta}s</strong></span>`;
  } else {
    m.innerHTML = "";
  }
}

async function triggerSave(jobId) {
  try {
    const res = await fetch("/serve/" + jobId);
    if (!res.ok) throw new Error("Serve failed");
    const blob = await res.blob();
    const disp = res.headers.get("Content-Disposition");
    let fname = "video.mp4";
    if (disp) {
      const m = disp.match(/filename="?(.+?)"?$/);
      if (m) fname = m[1];
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    setStatus("Download started", "ok");
    saveHist({
      title: document.getElementById("vTitle").textContent,
      thumb: document.getElementById("thumb").src,
      res: selRes,
      url: curUrl,
    });
    setTimeout(() => {
      document.getElementById("progWrap").style.display = "none";
      setProgress(0, "", null);
    }, 3500);
  } catch (e) {
    setStatus(e.message, "err");
  }
}

function saveHist(item) {
  hist.unshift(item);
  if (hist.length > 6) hist = hist.slice(0, 6);
  try {
    localStorage.setItem("tf-hist", JSON.stringify(hist));
  } catch (e) {}
  renderHist();
}
function renderHist() {
  const panel = document.getElementById("histPanel");
  if (!hist.length) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";
  const body = document.getElementById("histBody");
  body.innerHTML = `<div class="sl-hdr"><span class="sl-lbl">Downloads</span><button class="clr" onclick="clearHist()">Clear</button></div>`;
  hist.forEach((h) => {
    const el = document.createElement("div");
    el.className = "hi";
    el.innerHTML = `<img src="${h.thumb}"/><div style="flex:1;min-width:0"><div class="ht">${h.title}</div><div class="hm">${h.res ? h.res + "p" : "audio"}</div></div>`;
    el.onclick = () => {
      document.getElementById("urlInp").value = h.url;
      doFetch();
    };
    body.appendChild(el);
  });
}
function clearHist() {
  hist = [];
  try {
    localStorage.removeItem("tf-hist");
  } catch (e) {}
  renderHist();
}

if (autoMode) {
  document.getElementById("sysBtn").classList.add("on");
  applyTheme(getSys());
} else applyTheme(currentTheme);
renderHist();
