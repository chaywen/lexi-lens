// ===== CONFIG =====
const CONFIG = { WS_URL:'ws://localhost:8080/ws/session', API_URL:'http://localhost:8080' };

// ===== STATE =====
let ws=null, mediaRecorder=null, audioContext=null, currentMode=null, isRecording=false, videoStream=null;

// ===== MOCK WEBSOCKET =====
class MockWebSocket {
  constructor(url){ console.log("Mock WS connected:", url); this.readyState=1; }
  send(msg){ console.log("Mock WS send:", msg); }
}

// ===== INITIALIZATION =====
window.addEventListener('DOMContentLoaded', ()=>{
  setupEventListeners();
  initCamera();
  ws = new MockWebSocket(CONFIG.WS_URL); // 使用 Mock 测试 Phase1
  setupAudioContext();
});

// ===== CAMERA =====
async function initCamera(){
  try{
    const video = document.getElementById('video');
    videoStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    video.srcObject=videoStream;
  }catch(err){ console.error('Camera error:',err); alert('Camera access required'); }
}

// ===== AUDIO CONTEXT =====
function setupAudioContext(){ audioContext = new (window.AudioContext||window.webkitAudioContext)(); }

// ===== EVENT LISTENERS =====
function setupEventListeners(){
  document.querySelectorAll('.mode-btn').forEach(btn=>btn.addEventListener('click', selectMode));
  document.getElementById('mic-btn').addEventListener('click', toggleMicrophone);
  document.getElementById('mode-switch-btn').addEventListener('click', showModeSelector);
  document.getElementById('snapshot-btn').addEventListener('click', takeSnapshot);

  const dropZone=document.getElementById('drop-zone');
  const fileInput=document.getElementById('file-input');

  dropZone.addEventListener('click',()=>fileInput.click());
  dropZone.addEventListener('dragover',(e)=>{ e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop',(e)=>{
    e.preventDefault(); dropZone.classList.remove('dragging');
    if(e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change',(e)=>{ if(e.target.files[0]) handleFileUpload(e.target.files[0]); });

  // ===== ✅ Mock Response 按钮事件 =====
  const mockBtn = document.getElementById("mock-btn");
  mockBtn.addEventListener("click", () => {
    console.log("Mock button clicked!"); // 测试事件是否触发
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance("Hello! I am Lexi.");
      utterance.volume = 1;
      speechSynthesis.speak(utterance);
    } else {
      alert("SpeechSynthesis 不支持");
    }
  });

  // Mode 按钮也播放声音
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`You selected ${mode} mode`);
        speechSynthesis.speak(utterance);
      }
    });
  });
}

// ===== MODE SELECTION =====
function selectMode(e){
  currentMode=e.target.dataset.mode;
  console.log('Mode selected:', currentMode);
  document.getElementById('mode-selector-overlay').classList.add('hidden');
  sendMessage('mode_selected',{mode:currentMode});
}
function showModeSelector(){ document.getElementById('mode-selector-overlay').classList.remove('hidden'); }

// ===== MIC =====
async function toggleMicrophone(){
  if(!isRecording){
    try{
      const audioStream=await navigator.mediaDevices.getUserMedia({audio:true});
      mediaRecorder=new MediaRecorder(audioStream);
      mediaRecorder.ondataavailable=event=>{ if(event.data.size>0) sendAudioChunk(event.data); };
      mediaRecorder.start(100); isRecording=true;
      document.getElementById('mic-btn').textContent='🔴 Stop Mic';
    }catch(err){ console.error('Mic error:',err); }
  }else{
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track=>track.stop());
    isRecording=false;
    document.getElementById('mic-btn').textContent='🎤 Mic';
  }
}
function sendAudioChunk(blob){
  const reader=new FileReader();
  reader.onload=e=>{
    const base64=btoa(String.fromCharCode.apply(null,new Uint8Array(e.target.result)));
    sendMessage('audio_chunk',{data:base64});
  };
  reader.readAsArrayBuffer(blob);
}

// ===== SNAPSHOT =====
function takeSnapshot(){
  const video=document.getElementById('video');
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth; canvas.height=video.videoHeight;
  const ctx=canvas.getContext('2d'); ctx.drawImage(video,0,0);
  const base64=canvas.toDataURL('image/jpeg').split(',')[1];
  sendMessage('snapshot',{frame:base64});
}

// ===== FILE UPLOAD =====
function handleFileUpload(file){
  const words = ["This","is","a","mock","document"];
  renderDocument(words);
}
function renderDocument(words){
  const dropZone=document.getElementById('drop-zone');
  dropZone.innerHTML=words.map((w,i)=>`<span data-word-index="${i}">${w}</span> `).join('');
}

// ===== MESSAGE HELPER =====
function sendMessage(type,payload={}){ if(ws && ws.readyState===1) ws.send(JSON.stringify({type,...payload})); }
