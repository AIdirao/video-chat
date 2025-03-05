const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const backgroundBtn = document.getElementById("background");


let myStream;
let muted = false;
let cameraoff = false;
let isBackgroundEnabled = true; 



/* 세션 유지 */
window.addEventListener("DOMContentLoaded", () => {
    const storedRoomID = sessionStorage.getItem("roomID");
    const storedRoomName = sessionStorage.getItem("roomName");

    if (storedRoomID && storedRoomName) {
        console.log(`[CLIENT] Waiting Room: ${storedRoomName} (Room ID: ${storedRoomID})`);
    } else {
        console.log("❌ No meeting information found.");
        window.location.href = "/";
    }
});




// 모델 로드를 끝 마치면 startVideo 함수 실행 
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/public/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/public/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/public/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/public/models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/public/models')
  ]).then(() => console.log("FaceAPI 모델 로드 완료"));

  

/* 화상 회의 */
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
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: deviceID ? { deviceId: { exact: deviceID } } : { facingMode: "user" },
        });
        myFace.srcObject = myStream;

        // ✅ 비디오 메타데이터가 로드되면 updateCanvasSize() 실행
        myFace.addEventListener("loadedmetadata", updateCanvasSize);

        // ✅ 캔버스 크기 강제 업데이트 (비동기 문제 방지)
        setTimeout(updateCanvasSize, 1000);

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

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("change", handleCameraChange);
getMedia();

document.getElementById('enterMeeting').addEventListener('click', function() {
    window.location.href = '/meeting';
});





/* MediaPipe Selfie Segmentation (가상 배경 적용) */

// 정의
const videoCanvas = document.createElement("canvas");
const videoCtx = videoCanvas.getContext("2d");
document.body.appendChild(videoCanvas);
document.body.appendChild(faceCanvas);

// 가상 배경 이미지 설정
const backgroundImg = new Image();
backgroundImg.src = "/public/background.jpg";

// 배경 이미지 로드 확인
backgroundImg.onload = () => console.log("가상 배경 이미지 로드 완료");
backgroundImg.onerror = () => console.error("가상 배경 이미지 로드 실패, 이미지 경로 확인 필요");



/** 비디오 및 배경 크기 동기화 */
function updateCanvasSize() {
    if (!myFace.videoWidth || !myFace.videoHeight) return; // 크기가 없으면 무시
    videoCanvas.width = myFace.videoWidth;
    videoCanvas.height = myFace.videoHeight;
    faceCanvas.width = myFace.videoWidth;
    faceCanvas.height = myFace.videoHeight;
}


//버튼 on/off로 배경 껐다 켜기
// backgroundBtn.addEventListener("click", () => {
//     isBackgroundEnabled = !isBackgroundEnabled; 
//     backgroundBtn.innerText = isBackgroundEnabled ? "Background ON" : "Background Odd";
    
//     console.log("가상 배경 상태:", isBackgroundEnabled ? "Off" : "ON");

//     // 캔버스 즉시 업데이트
//     videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

//     if (!isBackgroundEnabled) {
//         // 가상 배경 OFF → 원본 비디오만 표시
//         videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
//     }
// });
function toggleBackground() {
    isBackgroundEnabled = !isBackgroundEnabled;
    backgroundBtn.innerText = isBackgroundEnabled ? "Background OFF" : "Background ON";
    console.log("가상 배경 상태:", isBackgroundEnabled ? "ON" : "OFF");

    videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
    if (!isBackgroundEnabled) {
        videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
    } else {
        applyVirtualBackground();
    }
}

backgroundBtn.addEventListener("click", toggleBackground);

/* 가상 배경 적용 */
async function applyVirtualBackground(selfieSegmentation) {
    myFace.style.display = "none";
    
    async function processVideo() {
        if (!myFace.srcObject) return;

        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
        videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);

        await selfieSegmentation.send({ image: videoCanvas });
        requestAnimationFrame(processVideo);
    }

    selfieSegmentation.onResults((results) => {
        if (!results.segmentationMask) return;
        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

        if (!isBackgroundEnabled) {
            videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
            return;
        }

        videoCtx.globalCompositeOperation = "destination-in";
        videoCtx.drawImage(results.segmentationMask, 0, 0, videoCanvas.width, videoCanvas.height);
        videoCtx.globalCompositeOperation = "destination-over";
        videoCtx.drawImage(backgroundImg, 0, 0, videoCanvas.width, videoCanvas.height);
    });

    requestAnimationFrame(processVideo);
}


/** 얼굴 감지 및 타인 제거 */
async function detectFaces() {
    const faceMatcher = await loadReferenceImage();
    if (!faceMatcher) return;
    
    async function processFaceDetection() {
        const detections = await faceapi.detectAllFaces(myFace).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, { width: videoCanvas.width, height: videoCanvas.height });
        faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        
        resizedDetections.forEach(detection => {
            const box = detection.detection.box;
            faceCtx.fillStyle = 'black';
            faceCtx.fillRect(box.x, box.y, box.width, box.height);
        });
        
        requestAnimationFrame(processFaceDetection);
    }
    processFaceDetection();
}

/** Selfie Segmentation 초기화 */
async function loadSelfieSegmentation() {
    const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });
    selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: true });
    return selfieSegmentation; // 반환 추가
}

async function bg_fc_main(){
    myFace.addEventListener("loadedmetadata", updateCanvasSize);
    const selfieSegmentation = await loadSelfieSegmentation(); 
    applyVirtualBackground(selfieSegmentation); // selfieSegmentation을 전달
    await detectFaces();
}


bg_fc_main();
// // applyVirtualBackground() 실행
// console.log("applyVirtualBackground() 호출됨");
// applyVirtualBackground();




//얼굴 감지를 위한 별도의 캔버스 (얼굴 박스만 표시)
const faceCanvas = document.createElement("canvas");
const faceCtx = faceCanvas.getContext("2d");
document.body.appendChild(faceCanvas);


async function loadReferenceImage() {
    const img = await faceapi.fetchImage('/public/myFace.jpg');
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
        console.error("참조 이미지에서 얼굴을 감지할 수 없습니다.");
        return null;
    }

    // FaceMatcher에 유사도 측정
    return new faceapi.FaceMatcher(detection, 0.45);  // 기본값 0.6 
}

async function drawFaceBoxes() {
    const faceMatcher = await loadReferenceImage();
    if (!faceMatcher) {
        console.error("FaceMatcher를 로드할 수 없습니다.");
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

            // 좌우 반전 처리
            const reversedX = canvas.width - (box.x + box.width); // x 좌표 반전
            const reversedBox = {
                x: reversedX,
                y: box.y,
                width: box.width,
                height: box.height
            };

            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            const isMatch = bestMatch.label === "unknown" ? false : true;

            // ctx.strokeStyle = "black";
            // ctx.lineWidth = 3;
            // ctx.fillStyle = 'blue'; 
            // ctx.fillRect(reversedBox.x, reversedBox.y,reversedBox.width, reversedBox.height);
            // ctx.strokeRect(reversedBox.x, reversedBox.y, reversedBox.width, reversedBox.height); 

            if (!isMatch) {
                // ctx.fillStyle = "red";
                // ctx.font = "20px Arial";
                // ctx.fillText("True", reversedBox.x, reversedBox.y - 10); // 반전된 위치에 텍스트 표시

                //ctx.strokeStyle = "black";
                //ctx.lineWidth = 3;
                ctx.fillStyle = 'white';
                ctx.fillRect(reversedBox.x, reversedBox.y, reversedBox.width, reversedBox.height);
                
            }
        });

        requestAnimationFrame(detectFaces);
    }

    detectFaces();
}
