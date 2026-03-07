// ================= CONFIG =================
const CONFIG = {
  WS_URL: "ws://127.0.0.1:8080/ws/session",
  API_URL: "http://127.0.0.1:8080"
};
const ALLOWED_TYPES = ['application/pdf','image/png','image/jpeg','image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

// ================= STATE =================
let isRecording = false;
let mediaRecorder = null;
let videoStream = null;
let ws = null;
let SESSION_TOKEN = null;
let audioContext, analyser, dataArray;
let playbackContext = new AudioContext();
let mockWords = ["This","is","a","mock","text","for","highlighting","test"];
let currentWord = 0;

// ================= INIT =================
window.addEventListener("DOMContentLoaded", () => {
  setupEvents();

  if (!sessionStorage.getItem("privacy_consented")) {
    document.getElementById("privacy-modal").classList.add("show");
  } else {
    initSession();
  }
});

async function initSession() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/api/session`, { method: "POST" });
    const data = await res.json();
    SESSION_TOKEN = data.session_token;

    initCamera();
    initWebSocket();
  } catch (err) {
    console.error("Session init error:", err);
    addChat("Failed to initialize session.", "ai");
  }
}

// ================= CAMERA =================
async function initCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: {ideal:1280}, height:{ideal:720}, aspectRatio:16/9 }
    });
    const videoEl = document.getElementById("video");
    videoEl.srcObject = videoStream;
    videoEl.play();
  } catch (err) {
    console.error("Camera error:", err);
    showInlineError("Cannot access camera.");
  }
}

function takeSnapshot() {
  const video = document.getElementById("video");
  if(!videoStream) return showInlineError("No video stream");
  
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video,0,0);

  const snapshotImg = document.getElementById("snapshot-img");
  canvas.toBlob((blob)=>{
    snapshotImg.src = URL.createObjectURL(blob);
    document.getElementById("snapshot-thumb").style.display = "block";

    if (ws && ws.readyState === WebSocket.OPEN) {
      const reader = new FileReader();
      reader.onloadend = () => sendMessage("snapshot", { frame: reader.result });
      reader.readAsDataURL(blob);
    }
  },"image/jpeg");

  addChat("Snapshot taken.","user");
}

// ================= MIC =================
async function toggleMic() {
  const btn = document.getElementById("mic-btn");

  if (!isRecording) {
    try {
      btn.classList.add("recording");
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRecorder = new MediaRecorder(stream);

      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize=512; analyser.smoothingTimeConstant=0.8;
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      isRecording = true;

      function updateMicAnimation(){
        analyser.getByteFrequencyData(dataArray);
        let sum=0; for(let i=0;i<dataArray.length;i++){sum+=dataArray[i];}
        let avg = sum/dataArray.length;
        let normalized = avg/255;
        let energy = Math.min(normalized*1.5,1);
        btn.style.transform = `scale(${1+energy*0.4})`;
        btn.style.setProperty("--energy",energy);
        if(energy<0.05) btn.classList.add("silent"); else btn.classList.remove("silent");
        if(isRecording) requestAnimationFrame(updateMicAnimation); else btn.style.transform="scale(1)";
      }
      updateMicAnimation();

      mediaRecorder.ondataavailable = event => {
        if(event.data.size>0 && ws && ws.readyState===WebSocket.OPEN){
          ws.send(event.data);
        }
      };
      mediaRecorder.start(500);
      addChat("Listening...", "user");

    } catch(err){
      console.error("Mic error:", err);
      showInlineError("Cannot access microphone.");
    }
  } else {
    btn.classList.remove("recording","silent");
    btn.style.setProperty("--energy",0);
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t=>t.stop());
    audioContext.close();
    isRecording=false;
    btn.style.transform="scale(1)";
    addChat("Mic stopped.","user");
  }
}

// ================= FILE UPLOAD =================
function handleUpload(event){
  const files=event.target.files;
  for(let f of files){
    if(!validateFile(f)) return;
    addChat(`Uploaded: ${f.name}`,"user");
    const formData=new FormData(); formData.append("file",f);
    fetch(`${CONFIG.API_URL}/api/upload`,{method:"POST",body:formData})
    .then(r=>r.json()).then(d=>addChat("File processed.","ai"));
  }
}
function validateFile(file){
  if(!ALLOWED_TYPES.includes(file.type)){ showInlineError("Only PDF/PNG/JPG/WEBP allowed."); addChat("Invalid file type.","ai"); return false; }
  if(file.size>MAX_SIZE){ showInlineError("File too large (max 10MB)."); addChat("File too large.","ai"); return false; }
  return true;
}

// ================= CHAT LOG =================
function addChat(text,sender){
  const chatArea=document.getElementById("chat-scroll");
  const div=document.createElement("div"); div.className=`chat-message ${sender}`; div.textContent=text;
  chatArea.appendChild(div); chatArea.scrollTop=chatArea.scrollHeight;
}

// ================= FONT CONTROL =================
function increaseFont(){ const el=document.getElementById("reading-text"); let size=parseFloat(window.getComputedStyle(el).fontSize); el.style.fontSize=size+2+"px"; }
function decreaseFont(){ const el=document.getElementById("reading-text"); let size=parseFloat(window.getComputedStyle(el).fontSize); if(size>16) el.style.fontSize=size-2+"px"; }

// ================= MOCK / MODE =================
function renderMockText(){
  const container=document.getElementById("reading-text"); container.innerHTML="";
  mockWords.forEach((w,i)=>{ const span=document.createElement("span"); span.textContent=w+" "; span.dataset.index=i; container.appendChild(span); });
}
function renderMockTextForMode(mode){
  let words=[];
  if(mode=="book") words=["This","is","book","mode","reading","example"];
  if(mode=="form") words=["Please","fill","out","this","form","carefully"];
  if(mode=="study") words=["Study","mode","helps","you","learn","faster"];
  if(mode=="write") words=["Write","mode","assists","your","creativity"];
  mockWords=words; currentWord=0; renderMockText();
}
function highlightWord(index){
  const spans=document.querySelectorAll("#reading-text span"); spans.forEach(s=>s.classList.remove("active-word"));
  if(spans[index]){ spans[index].classList.add("active-word"); spans[index].scrollIntoView({behavior:"smooth",block:"center"}); }
}

// ================= INLINE ERROR =================
function showInlineError(msg){ const el=document.getElementById("inline-error"); el.textContent=msg; el.style.display="block"; setTimeout(()=>el.style.display="none",3000); }

// ================= WEBSOCKET =================
function initWebSocket(){
  ws=new WebSocket(CONFIG.WS_URL);
  ws.onopen=()=>{ if(SESSION_TOKEN) sendMessage("audio",{}); addChat("WebSocket connected.","ai"); };
  ws.onmessage=async(event)=>{
    if(event.data instanceof Blob){
      const arrayBuffer=await event.data.arrayBuffer(); playAudioChunk(arrayBuffer); return;
    }
    try{
      const parsed=JSON.parse(event.data);
      if(parsed.type=="text") addChat(parsed.message,"ai");
      if(parsed.type=="highlight") highlightWord(parsed.word_index);
      if(parsed.type=="mode") renderMockTextForMode(parsed.mode);
    }catch(err){ console.error(err); };
  };
  ws.onerror=()=>showStatus("Connection error. Please retry.");
  ws.onclose=()=>{ addChat("WebSocket disconnected. Reconnecting...","ai"); setTimeout(initWebSocket,2000); };
}
function sendMessage(type,payload={}){ if(!ws||ws.readyState!==WebSocket.OPEN)return; ws.send(JSON.stringify({ type, session_token:SESSION_TOKEN, ...payload })); }
function showStatus(msg){ addChat(msg,"ai"); }
async function playAudioChunk(buffer){
  const audioBuffer=await playbackContext.decodeAudioData(buffer);
  const source=playbackContext.createBufferSource(); source.buffer=audioBuffer; source.connect(playbackContext.destination); source.start();
}

// ================= CONTROL BUTTONS =================
function explainSimply(){ const msg="Here is a simpler explanation of the text."; speak(msg); addChat(msg,"ai"); }
function testVoice(){ const msg="This is a test voice playback."; speak(msg); addChat(msg,"ai"); }
function stopSpeech(){
  playbackContext.close();
  playbackContext=new AudioContext();
  speechSynthesis.cancel();  // ✅ 停止浏览器 TTS
  addChat("Stopped audio.","user");
}
function speak(text){
  const utter=new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utter);
}

// ================= EVENT BINDINGS =================
function setupEvents(){
  document.getElementById("mic-btn").addEventListener("click",toggleMic);
  document.getElementById("snapshot-btn").addEventListener("click",takeSnapshot);
  document.getElementById("upload-btn").addEventListener("click",()=>document.getElementById("file-input").click());
  document.getElementById("file-input").addEventListener("change",handleUpload);
  document.getElementById("mode-toggle").addEventListener("click",()=>{ 
    const menu=document.getElementById("mode-dropdown"); menu.style.display=(menu.style.display=="flex"?"none":"flex");
  });
  document.getElementById("mode-dropdown").addEventListener("click",(e)=>{
    const mode=e.target.dataset.mode; if(!mode)return;
    document.getElementById("mode-dropdown").style.display="none";
    renderMockTextForMode(mode); // ✅ 前端立即更新文本
    if(ws && ws.readyState===WebSocket.OPEN) sendMessage("mode",{mode});
  });
  document.getElementById("consent-btn")?.addEventListener("click",()=>{
    sessionStorage.setItem("privacy_consented","true");
    document.getElementById("privacy-modal").classList.remove("show");
    initSession();
  });
  document.getElementById("test-voice-btn")?.addEventListener("click",testVoice);
  document.getElementById("stop-btn")?.addEventListener("click",stopSpeech);
  document.getElementById("explain-btn")?.addEventListener("click",explainSimply);
  document.getElementById("font-increase")?.addEventListener("click",increaseFont);
  document.getElementById("font-decrease")?.addEventListener("click",decreaseFont);
}

renderMockText();
