import socket from "./socket.js"; 

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const backgroundBtn = document.getElementById("background");
const call = document.getElementById("call_meeting");
const welcome = document.getElementById("welcome");
const nicknameForm = document.getElementById("nicknameForm");
const meetingCodeDisplay = document.getElementById("meetingCodeDisplay");
const nicknameDisplay = document.getElementById("nickname");
const urlParams = new URLSearchParams(window.location.search);


// 캔버스들
const videoCanvas = document.createElement("canvas");
const videoCtx = videoCanvas.getContext("2d");
const processingCanvas = document.createElement("canvas");
const processingCtx = processingCanvas.getContext("2d");
myFace.insertAdjacentElement("afterend", videoCanvas);

// 가상 배경 화면 설정
const backgroundImg = new Image();
backgroundImg.src = "/public/background.jpg";
backgroundImg.onload = () => console.log("Background image loaded");

// 얼굴 감지를 위한 별도 캔버스 (최적화를 위해 주기적 감지)
const faceCanvas = document.createElement("canvas");
const faceCtx = faceCanvas.getContext("2d");
document.body.appendChild(faceCanvas);


let myStream;
let muted = urlParams.get('isMuted');
let cameraoff = urlParams.get('cameraOff');
let isBackgroundEnabled = urlParams.get('isBackgroundEnabled');
let isExplicit = false; // NSFW 감지 결과
let roomID;
let myPeerConnection;
let myNickname;
let roomName;

// NSFW 감지를 위한 offscreen 캔버스
const nsfwOffscreenCanvas = document.createElement("canvas");
const nsfwOffscreenCtx = nsfwOffscreenCanvas.getContext("2d");

let nsfwModel = null;
const nsfwCategories = ["porn", "sexy", "hentai"];
const nsfwThresholds = { 
    porn: 0.9, 
    sexy: 0.1,
    hentai: 0.3,  
};


// 세션에서 방 정보 및 닉네임 가져오기
window.addEventListener("DOMContentLoaded", () => {
    roomID = sessionStorage.getItem("roomID");
    roomName = sessionStorage.getItem("roomName"); 
    if (roomID) {
        meetingCodeDisplay.innerText = `회의 코드: ${roomID}`;
    } else {
        meetingCodeDisplay.innerText = `잘못된 접근`;
    }

    if (roomName) {
        document.getElementById("roomTitle").innerText = `회의실: ${roomName}`;
    } else {
        document.getElementById("roomTitle").innerText = `회의실 (알 수 없음)`;
    }
});

// FaceAPI 모델 로드
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/public/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/public/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/public/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/public/models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/public/models')
]).then(() => console.log("FaceAPI 모델 로드 완료"));


/* 화상 회의 기능 */
call.style.display = "none"; // 기본적으로 숨김
nicknameForm.style.display = "flex"; 

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];

        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if (currentCamera.label === camera.label) {
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    } catch (e) {
        console.log(e);
    }
}

async function getMedia(deviceID) {
    const constraints = {
        audio: true,
        video: deviceID ? { deviceId: { exact: deviceID } } : { facingMode: "user" },
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(constraints);
        myFace.srcObject = myStream;
        if (!deviceID) {
            await getCameras();
        }
    } catch (e) {
        console.log(e);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    muteBtn.innerText = muted ? "Mute" : "Unmute";
    muted = !muted;
}

function handleCameraClick() {
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    cameraBtn.innerText = cameraoff ? "Turn Camera Off" : "Turn Camera On";
    cameraoff = !cameraoff;
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
}

function handleBackgroundClick() {
    isBackgroundEnabled = !isBackgroundEnabled;
    backgroundBtn.innerText = isBackgroundEnabled ? "Turn Background Off" : "Turn Background On";
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
backgroundBtn.addEventListener("click", handleBackgroundClick);
camerasSelect.addEventListener("change", handleCameraChange);

async function StartMedia() {
    // checking if makeConnection() has called - debugging
    console.log("Starting Media...");    
    await getMedia();
    makeConnection();
    
}

// SelfieSegmentation 모듈 로드
async function loadSelfieSegmentation() {
    try {
        if (!window.SelfieSegmentation) {
            throw new Error("SelfieSegmentation이 정의되지 않음");
        }
        const selfieSegmentation = new window.SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        selfieSegmentation.setOptions({
            modelSelection: 1, // 높은 품질
            selfieMode: true,
        });
        console.log("SelfieSegmentation 객체 생성 완료");
        return selfieSegmentation;
    } catch (error) {
        console.error("SelfieSegmentation 모듈 로드 실패:", error);
        return null;
    }
}

// 캔버스 크기 업데이트 함수
function setCanvasSize() {
    videoCanvas.width = myFace.videoWidth;
    videoCanvas.height = myFace.videoHeight;
    processingCanvas.width = videoCanvas.width;
    processingCanvas.height = videoCanvas.height;
    console.log("캔버스 크기 설정 완료:", videoCanvas.width, videoCanvas.height);
}

myFace.addEventListener("loadedmetadata", setCanvasSize);
window.addEventListener("resize", setCanvasSize);

// NSFW 감지 함수 (500ms 주기로 실행)
async function analyzeNSFWFrame() {
    if (!nsfwModel || !myFace.videoWidth || !myFace.videoHeight) return;
    nsfwOffscreenCanvas.width = myFace.videoWidth;
    nsfwOffscreenCanvas.height = myFace.videoHeight;
    nsfwOffscreenCtx.drawImage(myFace, 0, 0, nsfwOffscreenCanvas.width, nsfwOffscreenCanvas.height);
    
    try {
        const predictions = await nsfwModel.classify(nsfwOffscreenCanvas);
        isExplicit = predictions.some(pred => {
            const category = pred.className.toLowerCase();
            return nsfwCategories.includes(category) && pred.probability > nsfwThresholds[category];
        });
        if (isExplicit) {
            console.warn("NSFW 감지됨!");
        }
    } catch (error) {
        console.error("NSFW 분류 오류:", error);
    }
}

// NSFW.js 모델 로드 및 주기적 감지 시작
async function startNSFWCheck() {
    try {
        nsfwModel = await nsfwjs.load("/nsfw_model/", { size: 299 });
        console.log("NSFW.js 모델 로드 완료");
        setInterval(analyzeNSFWFrame, 500); // 500ms 주기로 감지
    } catch (error) {
        console.error("NSFW.js 모델 로드 실패:", error);
    }
}
window.addEventListener("load", startNSFWCheck);

// 가상 배경 및 NSFW 처리를 위한 함수
async function applyVirtualBackground() {
    const selfieSegmentation = await loadSelfieSegmentation();
    if (!selfieSegmentation) return;

    // 원본 영상 숨김
    myFace.style.display = "none";

    let isProcessing = false;
    async function processVideo() {
        if (!myFace.srcObject || isProcessing) return;
        isProcessing = true;
        try {
            // 처리용 캔버스 재사용
            processingCtx.save();
            processingCtx.clearRect(0, 0, processingCanvas.width, processingCanvas.height);
            processingCtx.translate(processingCanvas.width, 0);
            processingCtx.scale(-1, 1);
            processingCtx.drawImage(myFace, 0, 0, processingCanvas.width, processingCanvas.height);
            processingCtx.restore();
            if (typeof selfieSegmentation.send !== "function") {
                console.warn("SelfieSegmentation이 실행되지 않음. 재초기화합니다.");
                await applyVirtualBackground();
                return;
            }
            await selfieSegmentation.send({ image: processingCanvas });
        } catch (error) {
            console.error("SelfieSegmentation 처리 오류:", error);
        } finally {
            isProcessing = false;
        }
        requestAnimationFrame(processVideo);
    }

    myFace.addEventListener("play", () => {
        console.log("가상 배경 및 NSFW 감지 시작");
        processVideo();
        drawFaceBoxes();
    });

    selfieSegmentation.onResults((results) => {
        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
        if (!results.segmentationMask || !isBackgroundEnabled) {
            videoCtx.drawImage(processingCanvas, 0, 0, videoCanvas.width, videoCanvas.height);
            //console.log("background off");
        }else {
            videoCtx.save();
            videoCtx.translate(videoCanvas.width, 0);
            videoCtx.scale(-1, 1);
            videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
            videoCtx.restore();

            videoCtx.save();
            videoCtx.translate(videoCanvas.width, 0);
            videoCtx.scale(-1, 1);
            videoCtx.globalCompositeOperation = "destination-in";
            videoCtx.drawImage(results.segmentationMask, 0, 0, videoCanvas.width, videoCanvas.height);
            videoCtx.restore();

            videoCtx.globalCompositeOperation = "destination-over";
            videoCtx.drawImage(backgroundImg, 0, 0, videoCanvas.width, videoCanvas.height);
            videoCtx.globalCompositeOperation = "source-over";
    }
    
        // NSFW(노출) 감지 시 전체를 검은색 및 검열 이미지 오버레이
        if (isExplicit) {
            videoCtx.globalCompositeOperation = "source-over";
            videoCtx.fillStyle = 'rgba(0, 0, 0, 1)';
            videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
            const censoredImg = new Image();
            censoredImg.onload = () => {
                videoCtx.drawImage(censoredImg, 0, 0, videoCanvas.width, videoCanvas.height);
            };
        }
    });

    // WebGL 컨텍스트 손실 복구
    videoCanvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        console.warn("WebGL context lost. 재설정 시도...");
        setTimeout(applyVirtualBackground, 1000);
    });
}
console.log("applyVirtualBackground() 호출됨");
applyVirtualBackground();


async function loadReferenceImage() {
    try {
        const img = await faceapi.fetchImage('/public/myFace.jpg');
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        if (!detection) {
            console.error("참조 이미지에서 얼굴 감지 실패.");
            return null;
        }
        return new faceapi.FaceMatcher(detection, 0.45);
    } catch (error) {
        console.error("참조 이미지 로드 오류:", error);
        return null;
    }
}

async function drawFaceBoxes() {
    const faceMatcher = await loadReferenceImage();
    if (!faceMatcher) {
        console.error("FaceMatcher 로드 실패");
        return;
    }
    const canvas = faceapi.createCanvasFromMedia(myFace);
    videoCanvas.parentElement.appendChild(canvas);
    canvas.style.position = "absolute";
    canvas.style.top = videoCanvas.offsetTop + "px";
    canvas.style.left = videoCanvas.offsetLeft + "px";
    canvas.width = videoCanvas.width;
    canvas.height = videoCanvas.height;
    const displaySize = { width: videoCanvas.width, height: videoCanvas.height };
    faceapi.matchDimensions(canvas, displaySize);
    
    async function detectFaces() {
        const detections = await faceapi.detectAllFaces(myFace)
            .withFaceLandmarks()
            .withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        resizedDetections.forEach(detection => {
            const box = detection.detection.box;
            const reversedX = canvas.width - (box.x + box.width);
            const reversedBox = {
                x: reversedX,
                y: box.y,
                width: box.width,
                height: box.height
            };
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            if (bestMatch.label === "unknown") {
                ctx.fillStyle = 'white';
                ctx.fillRect(reversedBox.x, reversedBox.y, reversedBox.width, reversedBox.height);
            }
        });
        setTimeout(detectFaces); // 200ms마다 얼굴 감지
    }
    detectFaces();
}


// 닉네임 입력
async function handleNicknameSubmit(event) {
    event.preventDefault();

    const nicknameInput = nicknameForm.querySelector("input");
    if (nicknameInput.value.trim() !== "") {
        myNickname = nicknameInput.value.trim();
        sessionStorage.setItem("nickname", myNickname); // 닉네임 저장
        nicknameDisplay.innerText = myNickname;

        nicknameForm.style.display = "none";
        welcome.style.display = "none"; // 닉네임 입력 화면 숨기기

        // `#call_meeting` 활성화
        call.hidden=false;
        call.style.display = "flex"; 
        call.style.pointerEvents = "auto"; // 클릭 가능하도록 설정
        console.log("call_meeting 활성화됨"); 
        await StartMedia();
        
    } else {
        alert("닉네임을 입력하세요.");
    } 
    //join_room     
    socket.emit("join_room", roomID, myNickname, (response) => {
        if (response.error) {
            alert("[CLIENT] Join room error:", response.error);
        } else {
            console.log(`[CLIENT] Successfully joined room: ${roomID}`);
        }
    });
    
}

nicknameForm.addEventListener("submit", handleNicknameSubmit);

// Socket Code
/*Socket.IO WebRTC 핸들링*/
const peerNicknameDisplay = document.getElementById("peerNickname");
let peername=""

socket.on("welcome", async ({ user }) => {    
    console.log("[CLIENT] 상대방 입장:", user);
    peername=user;
    if (peerNicknameDisplay && peername) {
        peerNicknameDisplay.innerText = peername;
        peerNicknameDisplay.style.display = "block";
        console.log("[CLIENT] 상대방 닉네임 표시:", peername);
    }

    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);    
    socket.emit("offer", offer, roomID);
    console.log("[CLIENT] Sent offer to room:", roomID);
});



//모든 event log 확인 
socket.onAny((event, ...args) => {
    console.log(`[CLIENT] Socket received event: ${event}`, args);
});

socket.on("offer", async (offer) => {
    console.log("received the offer");
    await myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    
    socket.emit("answer", answer, roomID);
    console.log(" [CLIENT] sent the answer");//debugging
});

socket.on("answer", answer => {
    
    myPeerConnection.setRemoteDescription(answer);
    console.log("[CLIENT] received the answer");
});

socket.on("ice", ice => {
    console.log("[CLIENT] Received ICE Candidate:", ice);
    myPeerConnection.addIceCandidate(ice);
});



/* Peer 연결 설정 */
function makeConnection() {
    myPeerConnection = new RTCPeerConnection();
    console.log("RTCPeerConnection created", myPeerConnection);

    // ICE Candidate와 track 이벤트 핸들러 등록
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("track", handleTrack);

    // 캔버스에 적용된 필터링 화면을 MediaStream으로 캡처 (예: 30fps)
    const filteredStream = videoCanvas.captureStream();

    // 원본 스트림에서 오디오 트랙을 가져와 추가 (필터링 처리는 하지 않으므로)

    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                ],
            },
            {
                urls: "turn:52.79.72.173:3478"
            },
            {
                urls: "turns:52.79.72.173:5349"
            }
        ],
    });

    console.log("RTCPeerConnection created", myPeerConnection);

    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("track", handleTrack);


    // 캡처한 필터링된 스트림에서 비디오 트랙을 추가
    if (filteredStream) {
        filteredStream.getVideoTracks().forEach(track => {
            myPeerConnection.addTrack(track, filteredStream);
        });
    } else {
        console.error("Filtered stream not available");
    }
}


function handleIce(event) {
    console.log("sent candidate ICE");
    if (event.candidate) {
        socket.emit("ice", event.candidate, roomID);
    }
}

function handleTrack(event) {    
    const peerFace = document.getElementById("peerFace");
    if (peerFace) {
        peerFace.srcObject = event.streams[0];
    } else {
        console.error("PeerFace element not found");
    }
}

/*  팝업 기능 */
function openPopup(popupType) {
    document.querySelector(`.popup[data-popup='${popupType}']`).style.display = "block";
}

function closePopup(popupType) {
    document.querySelector(`.popup[data-popup='${popupType}']`).style.display = "none";
}
document.getElementById("yesBtn").addEventListener("click", function() {
    window.location.href = "/"; 
});


document.getElementById("leaveMeeting").addEventListener("click", function() {
    openPopup("leave-meeting");
    
});

document.getElementById("meetingcode").addEventListener("click", function() {
    openPopup("meeting-code");
});

document.querySelectorAll(".popup .close").forEach(button => {
    button.addEventListener("click", function() {
        const popup = button.closest(".popup");
        popup.style.display = "none";
    });
});

document.querySelectorAll(".popup").forEach(popup => {
    popup.addEventListener("mousedown", function(event) {
        if (!event.target.closest(".window")) {
            popup.style.display = "none";
        }
    });
});

