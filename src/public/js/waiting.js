const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

let myStream;
let muted = false;
let cameraoff = false;


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
    muteBtn.innerText = muted ? "Unmute" : "Mute";
    muted = !muted;
}

function handleCameraClick() {
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    cameraBtn.innerText = cameraoff ? "Turn Camera On" : "Turn Camera Off";
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
        videoCanvas.width = myFace.clientWidth;
        videoCanvas.height = myFace.clientHeight;
        console.log("캔버스 크기 설정 완료:", videoCanvas.width, videoCanvas.height);
    }

    //myFace.style.display = "none";
    
    myFace.addEventListener("loadedmetadata", setCanvasSize);
    window.addEventListener("resize", setCanvasSize);

    

    selfieSegmentation.onResults((results) => {
        if (!results.segmentationMask) {
            console.warn("segmentationMask가 없음");
            return;
        }

        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

        // 비디오 프레임을 캔버스에 좌우 반전하여 그리기
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

        // 가상 배경 적용
        videoCtx.globalCompositeOperation = "destination-over";
        videoCtx.drawImage(backgroundImg, 0, 0, videoCanvas.width, videoCanvas.height);
    });

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
        processVideo();
        drawFaceBoxes();
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