// ================= CONFIG =================
const CONFIG = {
  WS_URL: "ws://localhost:8080/ws/session",
  API_URL: "http://localhost:8080"
};

// ================= STATE =================
let ws;
let isRecording = false;
let mediaRecorder = null;
let videoStream = null;
let audioContext = null;

// ================= INIT =================
window.addEventListener("DOMContentLoaded", () => {
  initWebSocket();
  initCamera();
  setupEvents();
});

// ================= WEBSOCKET =================
function initWebSocket() {
  ws = new WebSocket(CONFIG.WS_URL);

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

function sendMessage(type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

// ================= CAMERA =================
async function initCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById("video").srcObject = videoStream;
  } catch (err) {
    console.error("Camera error:", err);
  }
}

// ================= EVENTS =================
function setupEvents() {
  document.getElementById("mic-btn").addEventListener("click", toggleMic);
  document.getElementById("snapshot-btn").addEventListener("click", takeSnapshot);
  document.getElementById("upload-btn").addEventListener("click", () =>
    document.getElementById("file-input").click()
  );
  document.getElementById("file-input").addEventListener("change", handleUpload);
  document.getElementById("stop-btn").addEventListener("click", stopSpeech);
  document.getElementById("explain-btn").addEventListener("click", explainSimply);
  document.getElementById("font-increase").addEventListener("click", increaseFont);
  document.getElementById("font-decrease").addEventListener("click", decreaseFont);
}

// ================= MIC STREAM =================
async function toggleMic() {
  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const arrayBuffer = await event.data.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        sendMessage("audio_chunk", { chunk: base64 });
      }
    };

    mediaRecorder.start(250);
    isRecording = true;
    addChat("Listening...", "user");
  } else {
    mediaRecorder.stop();
    isRecording = false;
  }
}

// ================= AUDIO PLAYBACK =================
async function handleServerMessage(data) {
  if (data.type === "audio_chunk") {
    playAudio(data.chunk);
  }
}

async function playAudio(base64) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const response = await fetch(`data:audio/wav;base64,${base64}`);
  const buffer = await response.arrayBuffer();
  const decoded = await audioContext.decodeAudioData(buffer);
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  source.connect(audioContext.destination);
  source.start(0);
}

// ================= SNAPSHOT =================
function takeSnapshot() {
  const video = document.getElementById("video");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  sendMessage("snapshot", { frame: base64 });
  addChat("Snapshot captured.", "ai");
}

// ================= UPLOAD =================
function handleUpload(event) {
  const files = event.target.files;
  for (let f of files) {
    addChat(`Uploaded: ${f.name}`, "user");
  }
}

// ================= CHAT =================
function addChat(text, sender) {
  const chatArea = document.getElementById("chat-history");
  const div = document.createElement("div");
  div.className = `chat-message ${sender}`;
  div.textContent = text;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ================= OTHER =================
function stopSpeech() {
  sendMessage("stop");
}

function explainSimply() {
  sendMessage("explain");
}

function increaseFont() {
  const el = document.getElementById("reading-text");
  let size = parseFloat(window.getComputedStyle(el).fontSize);
  el.style.fontSize = size + 2 + "px";
}

function decreaseFont() {
  const el = document.getElementById("reading-text");
  let size = parseFloat(window.getComputedStyle(el).fontSize);
  if (size > 16) el.style.fontSize = size - 2 + "px";
}
