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
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" },
    };
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceID } },
    };
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceID ? cameraConstraints : initialConstraints
        );
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

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("change", handleCameraChange);
getMedia();

document.getElementById('enterMeeting').addEventListener('click', function() {
    window.location.href = '/meeting';
});

/* MediaPipe Selfie Segmentation (가상 배경 적용) */
backgroundBtn.addEventListener("click", () => {
    isBackgroundEnabled = !isBackgroundEnabled; // 상태 변경
    backgroundBtn.innerText = isBackgroundEnabled ? "Background Off" : "Background On";
    
    console.log("가상 배경 상태:", isBackgroundEnabled ? "ON" : "OFF");

    // 캔버스 즉시 업데이트
    videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

    if (!isBackgroundEnabled) {
        // 가상 배경 OFF → 원본 비디오만 표시
        videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
    }
});

//selfieSegmentation을 window에서 가져옴
async function loadSelfieSegmentation() {
    console.log("SelfieSegmentation 모듈 로드 중...");

    try {
        if (!window.SelfieSegmentation) {
            throw new Error("window.SelfieSegmentation이 정의되지 않음");
        }

        const selfieSegmentation = new window.SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });

        selfieSegmentation.setOptions({
            modelSelection: 1, // 1: 높은 품질, 0: 빠른 성능
            selfieMode: true,
        });

        console.log("SelfieSegmentation 객체 생성 완료");
        return selfieSegmentation;

    } catch (error) {
        console.error("SelfieSegmentation 모듈 로드 실패:", error);
    }
}

const videoCanvas = document.createElement("canvas");
const videoCtx = videoCanvas.getContext("2d");

// 비디오 크기 설정
videoCanvas.width = myFace.width;
videoCanvas.height = myFace.height;

myFace.insertAdjacentElement("afterend", videoCanvas);
console.log("videoCanvas 생성됨", videoCanvas);

// 가상 배경 이미지 설정
const backgroundImg = new Image();
backgroundImg.src = "/public/background.jpg";

// 배경 이미지 로드 확인
backgroundImg.onload = () => console.log("가상 배경 이미지 로드 완료");
backgroundImg.onerror = () => console.error("가상 배경 이미지 로드 실패, 이미지 경로 확인 필요");



// async function applyVirtualBackground() {
//     const selfieSegmentation = await loadSelfieSegmentation();
//     if (!selfieSegmentation) return;

//     // 비디오가 로드될 때 크기를 설정
//     myFace.addEventListener("loadedmetadata", () => {
//         videoCanvas.width = myFace.videoWidth;
//         videoCanvas.height = myFace.videoHeight;
//         console.log("캔버스 크기 설정 완료:", videoCanvas.width, videoCanvas.height);
//     });

//     // 원본 비디오 숨기기
//     //myFace.style.display = "none";

//     selfieSegmentation.onResults((results) => {
//         console.log("SelfieSegmentation 결과 도착", results);

//         if (!results.segmentationMask) {
//             console.warn("segmentationMask가 없음, MediaPipe가 정상적으로 실행되고 있는지 확인 필요");
//             return;
//         }

//         videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

//         // 비디오 프레임을 캔버스에 좌우 반전하여 그리기
//         videoCtx.save();
//         videoCtx.translate(videoCanvas.width, 0);
//         videoCtx.scale(-1, 1);
//         videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
//         videoCtx.restore();

//         console.log("Segmentation Mask 적용 중");

//         // 마스크도 동일하게 좌우 반전 적용
//         videoCtx.save();
//         videoCtx.translate(videoCanvas.width, 0);
//         videoCtx.scale(-1, 1);
//         videoCtx.globalCompositeOperation = "destination-in";
//         videoCtx.drawImage(results.segmentationMask, 0, 0, videoCanvas.width, videoCanvas.height);
//         videoCtx.restore();

//         console.log("가상 배경 적용 중");

//         // 가상 배경도 동일하게 적용
//         videoCtx.globalCompositeOperation = "destination-over";
//         videoCtx.drawImage(backgroundImg, 0, 0, videoCanvas.width, videoCanvas.height);
//     });

//     async function processVideo() {
//         if (!myFace.srcObject) {
//             console.warn("myFace.srcObject가 없음, 비디오 스트림이 올바르게 로드되었는지 확인 필요");
//             return;
//         }
//         console.log("비디오 프레임 처리 중");

//         try {
//             console.log("SelfieSegmentation 처리 요청됨");

//             // 좌우 반전된 영상 입력을 위해 새로운 캔버스 생성
//             const tempCanvas = document.createElement("canvas");
//             const tempCtx = tempCanvas.getContext("2d");
//             tempCanvas.width = myFace.videoWidth;
//             tempCanvas.height = myFace.videoHeight;

//             tempCtx.save();
//             tempCtx.translate(tempCanvas.width, 0);
//             tempCtx.scale(-1, 1);
//             tempCtx.drawImage(myFace, 0, 0, tempCanvas.width, tempCanvas.height);
//             tempCtx.restore();

//             // SelfieSegmentation이 정상적으로 실행되지 않으면 다시 실행
//             if (typeof selfieSegmentation.send !== "function") {
//                 console.warn("⚠ SelfieSegmentation이 실행되지 않음. 다시 초기화합니다.");
//                 await applyVirtualBackground(); // 가상 배경 초기화
//                 return;
//             }

//             await selfieSegmentation.send({ image: tempCanvas });


//         } catch (error) {
//             console.error("SelfieSegmentation 처리 중 오류 발생", error);
//         }

//         requestAnimationFrame(processVideo);
//     }

//     myFace.addEventListener("play", () => {
//         console.log("비디오 재생 감지됨, 가상 배경 적용 시작");
//         //processVideo();
//         drawFaceBoxes();
//     });
// }

async function applyVirtualBackground() {
    const selfieSegmentation = await loadSelfieSegmentation();
    if (!selfieSegmentation) return;

    // 비디오 크기를 캔버스에 설정
    function setCanvasSize() {
        videoCanvas.width = myFace.videoWidth;
        videoCanvas.height = myFace.videoHeight;
        console.log("캔버스 크기 설정 완료:", videoCanvas.width, videoCanvas.height);
    }

    myFace.style.display = "none";
    //myFace.hidden = true
    
    // 둘이 화면 크기 맞추기 실행
    myFace.addEventListener("loadedmetadata", setCanvasSize);
    window.addEventListener("resize", setCanvasSize);    

    let isProcessing = false;

    async function processVideo() {
        if (!myFace.srcObject || isProcessing) return;
        isProcessing = true;

        try {
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = videoCanvas.width;
            tempCanvas.height = videoCanvas.height;

            tempCtx.save();
            tempCtx.translate(tempCanvas.width, 0);
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(myFace, 0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.restore();

            if (typeof selfieSegmentation.send !== "function") {
                console.warn("⚠ SelfieSegmentation이 실행되지 않음. 다시 초기화합니다.");
                await applyVirtualBackground();
                return;
            }

            await selfieSegmentation.send({ image: tempCanvas });
        } catch (error) {
            console.error("SelfieSegmentation 처리 중 오류 발생", error);
        } finally {
            isProcessing = false;
        }

        requestAnimationFrame(processVideo);
    }

    myFace.addEventListener("play", () => {
        console.log("비디오 재생 감지됨, 가상 배경 적용 시작");
        processVideo(); //비디오 전송
        drawFaceBoxes(); //face 인식
    });


    selfieSegmentation.onResults((results) => {
        if (!results.segmentationMask) {
            console.warn("segmentationMask가 없음");
            return;
        }
    
        // 캔버스 초기화
        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
    
        if (!isBackgroundEnabled) {
            // 배경 OFF일 때 원본 비디오만 표시
            videoCtx.save();
            videoCtx.translate(videoCanvas.width, 0);
            videoCtx.scale(-1, 1);
            videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
            videoCtx.restore();
            return;  // 이후 배경 적용 코드 실행 안 함
        }
    
        // 가상 배경 적용 (ON 상태일 때만 실행)
        videoCtx.save();
        videoCtx.translate(videoCanvas.width, 0);
        videoCtx.scale(-1, 1);
        videoCtx.drawImage(myFace, 0, 0, videoCanvas.width, videoCanvas.height);
        videoCtx.restore();
    
        // Segmentation Mask 적용
        videoCtx.save();
        videoCtx.translate(videoCanvas.width, 0);
        videoCtx.scale(-1, 1);
        videoCtx.globalCompositeOperation = "destination-in";
        videoCtx.drawImage(results.segmentationMask, 0, 0, videoCanvas.width, videoCanvas.height);
        videoCtx.restore();
    
        // 가상 배경 적용 (isBackgroundEnabled === true일 때만 실행)
        if (isBackgroundEnabled) {
            videoCtx.globalCompositeOperation = "destination-over";
            videoCtx.drawImage(backgroundImg, 0, 0, videoCanvas.width, videoCanvas.height);
        }
    });
    



    // WebGL 컨텍스트 손실 감지 및 복구
    videoCanvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        console.warn("WebGL context lost. Attempting to restore...");
        setTimeout(() => {
            applyVirtualBackground();
        }, 1000);
    });
}

// applyVirtualBackground() 실행
console.log("applyVirtualBackground() 호출됨");
applyVirtualBackground();




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

/* Nudity_Checker */

// const nsfwCanvas = document.createElement("canvas");
// const nsfwCtx = nsfwCanvas.getContext("2d");

// nsfwCanvas.width = myFace.width;
// nsfwCanvas.height = myFace.height;

// myFace.insertAdjacentElement("afterend", nsfwCanvas);
// console.log("nsfwCanvas 생성됨", nsfwCanvas);

// // document.body.appendChild(nsfwCanvas)
// // nsfwCanvas.style.display = "none";

// let frameCount = 0;
// const frameSkip = 10;

// // Nudity Check 서버로 frame 전송 
// async function sendFrameToServer() {
//     frameCount++;
//     if(frameCount % frameSkip !== 0){
//         requestAnimationFrame(sendFrameToServer);
//     }
    
//     nsfwCtx.drawImage(myFace, 0, 0, nsfwCanvas.width, nsfwCanvas.height);
    
//     let frame = nsfwCanvas.toDataURL("image/jpeg"); // 프레임을 Base64로 변환

//     try {
//         let response = await fetch("http://172.20.10.11:5000/check_nudity", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ image: frame })
//         });

//         let result = await response.json();
//         if(result.mosaic_img){
//             updateMosaic(result.mosaic_img);
//         }

//     } catch (error) {
//         console.error("Nudity check API 호출 실패:", error);

//     }

//     requestAnimationFrame(sendFrameToServer);

// }

// // base64 이미지를 canvas에 업데이트 
// function updateMosaic(mosaicImageBase64) {
//     let mosaicImg = new Image();
//     mosaicImg.src = mosaicImageBase64;
//     mosaicImg.onload = () => {
//         nsfwCtx.clearRect(0, 0, nsfwCanvas.width, nsfwCanvas.height);
//         nsfwCtx.drawImage(mosaicImg, 0, 0, nsfwCanvas.width, nsfwCanvas.height);
//         console.log("모자이크 업데이트 완료");
//     };
// }

// // 비디오 재생 시 모자이크 적용 시작
// myFace.addEventListener("loadedmetadata", () => {
//     console.log("비디오 재생 감지됨, NSFW 필터링 시작");
//     sendFrameToServer();
// });


/*  Nudity_Checker */
const nsfwCanvas = document.createElement("canvas");
const nsfwCtx = nsfwCanvas.getContext("2d");
let nsfwModel = null; // NSFW 모델 변수
let nsfwCheckRunning = false; // NSFW 감지 루프 실행 여부

document.body.append(nsfwCanvas);

const nsfwBoundingCanvas = document.createElement("canvas");
const nsfwBoundingCtx = nsfwBoundingCanvas.getContext("2d");
document.body.appendChild(nsfwBoundingCanvas);

// 비디오 요소 크기 동기화
myFace.addEventListener("loadedmetadata", () => {
    nsfwCanvas.width = myFace.videoWidth;
    nsfwCanvas.height = myFace.videoHeight;

    nsfwBoundingCanvas.width = nsfwCanvas.width;
    nsfwBoundingCanvas.height = nsfwCanvas.height;

    console.log("✅ NSFW Canvas 크기 설정 완료:", nsfwCanvas.width, nsfwCanvas.height);
    console.log("✅ Bounding Box Canvas 크기 설정 완료:", nsfwBoundingCanvas.width, nsfwBoundingCanvas.height);
    // NSFW 캔버스 스타일 적용
    nsfwCanvas.style.position = 'relative'; // 부모 기준 위치 설정
    nsfwCanvas.style.display = 'block';

    // NSFW Bounding Canvas를 NSFW 캔버스 위에 겹치도록 설정
    nsfwBoundingCanvas.style.position = 'absolute'; // 부모를 기준으로 정확히 덮음
    nsfwBoundingCanvas.style.top = '0';
    nsfwBoundingCanvas.style.left = '0';
    nsfwBoundingCanvas.style.width = '100%';
    nsfwBoundingCanvas.style.height = '100%';
    nsfwBoundingCanvas.style.pointerEvents = 'none'; // 클릭 방지
    nsfwBoundingCanvas.style.zIndex = '10'; // nsfwCanvas 위에 배치

    // NSFW 캔버스와 Bounding 캔버스를 포함하는 컨테이너 생성
    const nsfwContainer = document.createElement('div');
    nsfwContainer.style.position = 'relative'; // 부모 기준 위치
    nsfwContainer.style.width = nsfwCanvas.width + 'px';
    nsfwContainer.style.height = nsfwCanvas.height + 'px';
    nsfwContainer.style.display = 'inline-block'; // 블록 레벨 정렬 유지

    // 부모 요소에 추가 (기존 위치 유지)
    const myFaceParent = myFace.parentElement;
    myFaceParent.appendChild(nsfwContainer);

    // 카메라와 NSFW 감지 캔버스를 나란히 배치 (myFace와 nsfwContainer)
    const containerWrapper = document.createElement('div');
    containerWrapper.style.display = 'flex'; // 가로 정렬
    containerWrapper.style.alignItems = 'center';
    containerWrapper.style.gap = '10px';

    containerWrapper.appendChild(myFace);  // 기존 카메라 유지
    containerWrapper.appendChild(nsfwContainer);
    myFaceParent.appendChild(containerWrapper);

    // NSFW 캔버스를 컨테이너에 추가
    nsfwContainer.appendChild(nsfwCanvas);
    nsfwContainer.appendChild(nsfwBoundingCanvas);


});


/* ✅ NSFW 감지 함수 */
const nsfwCategories = ["porn", "sexy", "hentai"];
const nsfwThresholds = { 
    //porn: 0.4, 
    sexy: 0.1,
    hentai: 0.3,  
};

/* ✅ 감지된 경우 화면 전체를 반투명 검정으로 덮음 */
function coverNudity(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // 반투명 검정
    ctx.fillRect(0, 0, nsfwBoundingCanvas.width, nsfwBoundingCanvas.height);
}

/* ✅ NSFW.js 모델 로드 */
async function loadNSFWModel() {
    try {
        const modelPath = "http://localhost:3000/models/model.json"; 
        nsfwModel = await nsfwjs.load(modelPath, { size: 299 }); 
        console.log("✅ NSFW.js 모델 로드 완료");
    } catch (error) {
        console.error("❌ NSFW.js 모델 로드 실패:", error);
    }
}

async function analyzeNSFWFrame() {
    if (!nsfwModel) {
        console.warn("🚨 NSFW 모델이 없음! 감지 불가.");
        return;
    }

    nsfwCtx.drawImage(myFace, 0, 0, nsfwCanvas.width, nsfwCanvas.height);
    const predictions = await nsfwModel.classify(nsfwCanvas);
    console.log("🔍 NSFW 예측 결과:", predictions);

    let isExplicit = false;

    for (const pred of predictions) {
        const category = pred.className.toLowerCase();
        if (nsfwCategories.includes(category) && pred.probability > nsfwThresholds[category]) {
            console.warn(`🚨 NSFW 감지됨! [${category}] 확률: ${pred.probability}`);
            isExplicit = true;
        }
    }

    if (isExplicit) {
        nsfwBoundingCtx.clearRect(0, 0, nsfwBoundingCanvas.width, nsfwBoundingCanvas.height);
        coverNudity(nsfwBoundingCtx); // 화면 전체 덮기
    } else {
        nsfwBoundingCtx.clearRect(0, 0, nsfwBoundingCanvas.width, nsfwBoundingCanvas.height);
    }

    if (nsfwCheckRunning) {
        requestAnimationFrame(analyzeNSFWFrame);
        console.log(" 계속 탐지 진행 중....");
    }
}

/* ✅ NSFW 감지 시작 */
async function startNSFWCheck() {
    try {
        await loadNSFWModel();
        if (!nsfwModel) return;

        nsfwCheckRunning = true;
        analyzeNSFWFrame();
    } catch (error) {
        console.error("❌ NSFW 감지 시스템 초기화 실패:", error);
    }
}

window.addEventListener("load", startNSFWCheck);


