const CONFIG = {
  WS_URL: "ws://localhost:8080/ws/session",
  API_URL: "http://localhost:8080"
};

let isRecording = false;
let mediaRecorder = null;
let videoStream = null;

window.addEventListener("DOMContentLoaded", () => {
  initCamera();
  setupEvents();
});

/* CAMERA */
async function initCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById("video").srcObject = videoStream;
  } catch (err) {
    console.error("Camera error:", err);
  }
}

/* EVENTS */
function setupEvents() {
  document.getElementById("mic-btn").addEventListener("click", toggleMic);
  document.getElementById("snapshot-btn").addEventListener("click", takeSnapshot);
  document.getElementById("upload-btn").addEventListener("click", () =>
    document.getElementById("file-input").click()
  );
  document.getElementById("mock-btn").addEventListener("click", playMock);
  document.getElementById("stop-btn").addEventListener("click", stopSpeech);
  document.getElementById("explain-btn").addEventListener("click", explainSimply);

  document.getElementById("font-increase").addEventListener("click", increaseFont);
  document.getElementById("font-decrease").addEventListener("click", decreaseFont);
}

/* MIC */
async function toggleMic() {
  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    isRecording = true;
    addChat("Listening...", "user-message");
  } else {
    mediaRecorder.stop();
    isRecording = false;
  }
}

/* SNAPSHOT */
function takeSnapshot() {
  const video = document.getElementById("video");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  addChat("Snapshot captured.", "lexi-message");
}

/* MOCK VOICE */
function playMock() {
  const msg = "Hello. I am Lexi. I will read this text for you.";
  speak(msg);
  addChat(msg, "lexi-message");
}

function speak(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1;
  speechSynthesis.speak(u);
}

function stopSpeech() {
  speechSynthesis.cancel();
}

/* EXPLAIN */
function explainSimply() {
  const msg = "Here is a simpler explanation of the text.";
  speak(msg);
  addChat(msg, "lexi-message");
}

/* CHAT */
function addChat(text, className) {
  const chat = document.getElementById("chat-area");
  const div = document.createElement("div");
  div.className = `chat-message ${className}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

/* FONT CONTROL */
function increaseFont() {
  const el = document.getElementById("document-text");
  let size = parseFloat(window.getComputedStyle(el).fontSize);
  el.style.fontSize = size + 2 + "px";
}

function decreaseFont() {
  const el = document.getElementById("document-text");
  let size = parseFloat(window.getComputedStyle(el).fontSize);
  if (size > 16) {
    el.style.fontSize = size - 2 + "px";
  }
}
