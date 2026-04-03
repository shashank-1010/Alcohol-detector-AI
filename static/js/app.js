let stream = null;
let cameraActive = false;
let videoReady = false;
const API_BASE = window.location.origin;

const video = document.getElementById("videoFeed");
const canvas = document.getElementById("snapCanvas");
const overlay = document.getElementById("videoOverlay");
const startBtn = document.getElementById("startCameraBtn");
const stopBtn = document.getElementById("stopCameraBtn");
const detectBtn = document.getElementById("detectBtn");
const detectHint = document.getElementById("detectHint");
const cameraIndicator = document.getElementById("cameraIndicator");
const cameraLabel = document.getElementById("cameraLabel");
const resultDisplay = document.getElementById("resultDisplay");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const resultLabel = document.getElementById("resultLabel");
const resultStatus = document.getElementById("resultStatus");
const resultIcon = document.getElementById("resultIcon");
const faceDetectedEl = document.getElementById("faceDetected");
const confidenceEl = document.getElementById("confidence");
const timestampEl = document.getElementById("timestamp");
const logBody = document.getElementById("logBody");
const toast = document.getElementById("toast");

video.addEventListener("loadedmetadata", () => {
  videoReady = true;
});

video.addEventListener("playing", () => {
  videoReady = true;
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;
    videoReady = false;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
      video.oncanplay = resolve;
      setTimeout(resolve, 2000);
    });

    overlay.style.display = "none";
    cameraActive = true;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    detectBtn.disabled = false;
    detectHint.textContent = "Camera active — click Detect to analyze.";

    const dot = cameraIndicator.querySelector(".dot");
    dot.classList.remove("inactive");
    dot.classList.add("active");
    cameraLabel.textContent = "Live";

    addLog("Camera started", "info");
    showToast("Camera started successfully");
  } catch (err) {
    addLog("Camera access denied: " + err.message, "error");
    showToast("Could not access camera: " + err.message);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
  overlay.style.display = "flex";
  cameraActive = false;
  videoReady = false;

  startBtn.disabled = false;
  stopBtn.disabled = true;
  detectBtn.disabled = true;
  detectHint.textContent = "Start the camera first to run detection.";

  const dot = cameraIndicator.querySelector(".dot");
  dot.classList.remove("active");
  dot.classList.add("inactive");
  cameraLabel.textContent = "Offline";

  addLog("Camera stopped", "info");
  showToast("Camera stopped");
}

function captureFrame() {
  return new Promise((resolve, reject) => {
    const w = video.videoWidth;
    const h = video.videoHeight;

    if (!w || !h) {
      reject(new Error("Video stream not ready yet. Please wait a moment and try again."));
      return;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = canvas.toDataURL("image/jpeg", 0.95);

    if (!imageData || imageData === "data:,") {
      reject(new Error("Failed to capture frame from camera."));
      return;
    }

    resolve(imageData);
  });
}

async function runDetection() {
  if (!cameraActive || !stream) {
    showToast("Start the camera first.");
    return;
  }

  detectBtn.disabled = true;
  detectBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
  addLog("Running detection...", "info");

  try {
    let imageData;
    try {
      imageData = await captureFrame();
    } catch (capErr) {
      await new Promise(r => setTimeout(r, 800));
      imageData = await captureFrame();
    }

    const response = await fetch(`${API_BASE}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageData })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    displayResult(data);

    const badge = data.status === "drunk" ? "drunk"
      : data.status === "sober" ? "sober"
      : data.status === "unknown" ? "unknown"
      : "error";

    const faceInfo = data.face_detected ? ` (${data.face_count} face${data.face_count !== 1 ? "s" : ""})` : "";
    addLog(`Result: ${data.result}${faceInfo} — Confidence: ${data.confidence}%`, badge);
    showToast(`Result: ${data.result}`);

  } catch (err) {
    addLog("Detection failed: " + err.message, "error");
    showToast(err.message || "Detection failed.");
    console.error(err);
  } finally {
    detectBtn.disabled = false;
    detectBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg> Run Detection`;
  }
}

function displayResult(data) {
  resultPlaceholder.style.display = "none";
  resultDisplay.style.display = "flex";

  const statusMap = {
    drunk:   { icon: "🍺", label: "DRUNK",            cls: "drunk" },
    sober:   { icon: "✅", label: "NOT DRUNK",         cls: "sober" },
    unknown: { icon: "⚠️", label: "NO FACE DETECTED", cls: "unknown" },
    error:   { icon: "❌", label: "ERROR",             cls: "error" }
  };

  const s = statusMap[data.status] || statusMap.error;
  resultIcon.textContent = s.icon;
  resultLabel.textContent = s.label;
  resultLabel.className = "result-label " + s.cls;
  resultStatus.textContent = data.message || "";

  faceDetectedEl.textContent = data.face_detected
    ? `Yes (${data.face_count} face${data.face_count !== 1 ? "s" : ""})`
    : "No";
  confidenceEl.textContent = data.confidence !== undefined ? data.confidence + "%" : "—";
  timestampEl.textContent = new Date().toLocaleTimeString();
}

function addLog(message, type = "info") {
  const empty = logBody.querySelector(".log-empty");
  if (empty) empty.remove();

  const entry = document.createElement("div");
  entry.className = "log-entry";

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = new Date().toLocaleTimeString();

  const msg = document.createElement("span");
  msg.className = "log-msg";
  msg.textContent = message;

  const badge = document.createElement("span");
  badge.className = "log-badge " + type;
  badge.textContent = type === "info" ? "INFO" : type === "error" ? "ERR" : type.toUpperCase();

  entry.appendChild(time);
  entry.appendChild(msg);
  entry.appendChild(badge);
  logBody.insertBefore(entry, logBody.firstChild);
}

function clearLog() {
  logBody.innerHTML = '<div class="log-empty">No events recorded yet.</div>';
}

let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
