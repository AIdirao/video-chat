const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const backgroundBtn = document.getElementById("background");


let myStream;
let muted = false;
let cameraOff = false;
let isBackgroundEnabled = false; 
let isExplicit = false; // NSFW 감지 결과
//let faceurl;



// 캔버스들
const videoCanvas = document.createElement("canvas");
const videoCtx = videoCanvas.getContext("2d");
const processingCanvas = document.createElement("canvas");
const processingCtx = processingCanvas.getContext("2d");
myFace.insertAdjacentElement("afterend", videoCanvas);

// 가상 배경 화면 설정
const backgroundImg = new Image();
backgroundImg.src = "/public/background.png";
backgroundImg.onload = () => console.log("Background image loaded");

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

// 세션 유지
window.addEventListener("DOMContentLoaded", () => {
    const storedRoomID = sessionStorage.getItem("roomID");
    const storedRoomName = sessionStorage.getItem("roomName");
    const faceurl = localStorage.getItem("uploadedFaceUrl");
    console.log(`세션 유지 - faceurl: ${faceurl}`);

    if (storedRoomID && storedRoomName) {
        console.log(`[CLIENT] Waiting Room: ${storedRoomName} (Room ID: ${storedRoomID})`);
    } else {
        console.log("❌ No meeting information found.");
        window.location.href = "/";
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

// 미디어(카메라/오디오) 설정 함수
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        camerasSelect.innerHTML = ""; // 기존 옵션 제거
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
        console.error("카메라 목록 불러오기 실패:", e);
    }
}

async function getMedia(deviceID) {
    const constraints = deviceID ? 
        { audio: true, video: { deviceId: { exact: deviceID } } } : 
        { audio: true, video: { facingMode: "user" } };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(constraints);
        myFace.srcObject = myStream;
        if (!deviceID) await getCameras();
    } catch (e) {
        console.error("미디어 스트림 가져오기 실패:", e);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    muted = !muted;
    muteBtn.innerText = muted ? "Unmute" : "Mute";
}

function handleCameraClick() {
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    cameraOff = !cameraOff;
    cameraBtn.innerText = cameraOff ? "Turn Camera On" : "Turn Camera Off";
}

function handleBackgroundClick() {
    isBackgroundEnabled = !isBackgroundEnabled;
    backgroundBtn.innerText = isBackgroundEnabled ? "Turn Background Off" : "Turn Background On";
}
async function handleCameraChange() {
    await getMedia(camerasSelect.value);
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
backgroundBtn.addEventListener("click", handleBackgroundClick);
camerasSelect.addEventListener("change", handleCameraChange);
document.getElementById('enterMeeting').addEventListener('click', () => {
    window.location.href = `/meeting?muted=${encodeURIComponent(muted)}&cameraoff=${encodeURIComponent(cameraOff)}&isBackgroundEnabled=${encodeURIComponent(isBackgroundEnabled)}`;
});
getMedia();

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

// 얼굴 감지를 위한 별도 캔버스 (최적화를 위해 주기적 감지)
const faceCanvas = document.createElement("canvas");
const faceCtx = faceCanvas.getContext("2d");
document.body.appendChild(faceCanvas);

async function loadReferenceImage() {
    try {
        // localStorage에서 가져오기
        const faceUrl = localStorage.getItem("uploadedFaceUrl");

        if (!faceUrl) {
            console.error("저장된 참조 이미지 URL이 없습니다.");
            return null;
        }

        console.log("불러온 참조 이미지 URL:", faceUrl);

        const img = await faceapi.fetchImage(faceUrl);
        const detection = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.error(" 참조 이미지에서 얼굴 감지 실패.");
            return null;
        }

        return new faceapi.FaceMatcher(detection, 0.45);
    } catch (error) {
        console.error(" 참조 이미지 로드 오류:", error);
        return null;
    }
}

async function drawFaceBoxes() {
    const faceUrl = localStorage.getItem("uploadedFaceUrl");
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

// import { 
//     setCanvasSize, 
//     analyzeNSFWFrame, 
//     startNSFWCheck, 
//     applyVirtualBackground, 
//     drawFaceBoxes,
//     loadFaceAPIModels,
//     faceCanvas,
//     videoCanvas,
//     processingCanvas,
//     processingCtx,
//     videoCtx,
//     nsfwOffscreenCanvas,
//     nsfwOffscreenCtx
// } from "./background.js";

// const myFace = document.getElementById("myFace");
// const muteBtn = document.getElementById("mute");
// const cameraBtn = document.getElementById("camera");
// const camerasSelect = document.getElementById("cameras");
// const call = document.getElementById("call");
// const backgroundBtn = document.getElementById("background");

// let myStream;
// let muted = false;
// let cameraOff = false;
// let isBackgroundEnabled = false; 
// let isExplicit = false; // NSFW 감지 결과

// //background.js 용 
// // 가상 배경 화면 설정
// const backgroundImg = new Image();
// backgroundImg.src = "/public/background.jpg";
// backgroundImg.onload = () => {
//     console.log("✅ Background image loaded");

//     // 비디오가 로드된 후 applyVirtualBackground 실행
//     if (myFace && myFace.videoWidth !== 0) {
//         applyVirtualBackground(myFace, videoCanvas, processingCanvas, processingCtx, videoCtx, false, backgroundImg);
//     }
// };

// // NSFW 감지를 위한 offscreen 캔버스

// const nsfwCategories = ["porn", "sexy", "hentai"];
// const nsfwThresholds = { 
//     porn: 0.999, 
//     sexy: 0.1,
//     hentai: 0.3,  
// };



// // 세션 유지
// window.addEventListener("DOMContentLoaded", () => {
//     const storedRoomID = sessionStorage.getItem("roomID");
//     const storedRoomName = sessionStorage.getItem("roomName");

//     if (storedRoomID && storedRoomName) {
//         console.log(`[CLIENT] Waiting Room: ${storedRoomName} (Room ID: ${storedRoomID})`);
//     } else {
//         console.log("❌ No meeting information found.");
//         window.location.href = "/";
//     }


// });

// // FaceAPI 모델 로드
// // Promise.all([
// //     faceapi.nets.tinyFaceDetector.loadFromUri('/public/models'),
// //     faceapi.nets.faceLandmark68Net.loadFromUri('/public/models'),
// //     faceapi.nets.faceRecognitionNet.loadFromUri('/public/models'),
// //     faceapi.nets.faceExpressionNet.loadFromUri('/public/models'),
// //     faceapi.nets.ssdMobilenetv1.loadFromUri('/public/models')
// // ]).then(() => console.log("FaceAPI 모델 로드 완료"));



// // 미디어(카메라/오디오) 설정 함수
// async function getCameras() {
//     try {
//         const devices = await navigator.mediaDevices.enumerateDevices();
//         const cameras = devices.filter(device => device.kind === "videoinput");
//         const currentCamera = myStream.getVideoTracks()[0];
//         camerasSelect.innerHTML = ""; // 기존 옵션 제거
//         cameras.forEach(camera => {
//             const option = document.createElement("option");
//             option.value = camera.deviceId;
//             option.innerText = camera.label;
//             if (currentCamera.label === camera.label) {
//                 option.selected = true;
//             }
//             camerasSelect.appendChild(option);
//         });
//     } catch (e) {
//         console.error("카메라 목록 불러오기 실패:", e);
//     }
// }

// async function getMedia(deviceID) {
//     const constraints = deviceID ? 
//         { audio: true, video: { deviceId: { exact: deviceID } } } : 
//         { audio: true, video: { facingMode: "user" } };

//     try {
//         myStream = await navigator.mediaDevices.getUserMedia(constraints);
//         myFace.srcObject = myStream;
//         if (!deviceID) await getCameras();
//     } catch (e) {
//         console.error("미디어 스트림 가져오기 실패:", e);
//     }
// }

// function handleMuteClick() {
//     myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
//     muted = !muted;
//     muteBtn.innerText = muted ? "Unmute" : "Mute";
// }

// function handleCameraClick() {
//     myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
//     cameraOff = !cameraOff;
//     cameraBtn.innerText = cameraOff ? "Turn Camera On" : "Turn Camera Off";
// }

// function handleBackgroundClick() {
//     isBackgroundEnabled = !isBackgroundEnabled;
//     backgroundBtn.innerText = isBackgroundEnabled ? "Turn Background Off" : "Turn Background On";
// }
// async function handleCameraChange() {
//     await getMedia(camerasSelect.value);
// }



// muteBtn.addEventListener("click", handleMuteClick);
// cameraBtn.addEventListener("click", handleCameraClick);
// backgroundBtn.addEventListener("click", () => {
//     isBackgroundEnabled = !isBackgroundEnabled;
//     backgroundBtn.innerText = isBackgroundEnabled ? "Turn Background Off" : "Turn Background On";
//     console.log(`Background ${isBackgroundEnabled ? "On" : "Off"}`);

//     // ✅ 배경 상태 변경 시 applyVirtualBackground 재호출
//     applyVirtualBackground(myFace, videoCanvas, processingCanvas, processingCtx, videoCtx, isBackgroundEnabled, backgroundImg);
// });
// camerasSelect.addEventListener("change", handleCameraChange);
// document.getElementById('enterMeeting').addEventListener('click', () => {
//     window.location.href = '/meeting';
// });
// getMedia();





// myFace.insertAdjacentElement("afterend", videoCanvas);

// window.addEventListener("load", async () => {
//     await loadFaceAPIModels();
//     await startNSFWCheck();
// });

// // 가상 배경 적용
// myFace.addEventListener("loadedmetadata", () => {
//     console.log("✅ 비디오 메타데이터 로드 완료");
//     setCanvasSize(myFace);
//     drawFaceBoxes(myFace, videoCanvas);
// });
// myFace.addEventListener("loadedmetadata", setCanvasSize);

// // 창 크기 변경 시 캔버스 크기 업데이트
// window.addEventListener("resize", () => setCanvasSize(myFace));

