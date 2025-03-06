// 🟢 NSFW 감지 관련 전역 변수 추가
let nsfwModel = null;
let isExplicit = false; // NSFW 감지 결과를 저장할 변수

// 얼굴 감지를 위한 별도 캔버스 (최적화를 위해 주기적 감지)
export const faceCanvas = document.createElement("canvas");
export const faceCtx = faceCanvas.getContext("2d");
export const videoCanvas = document.createElement("canvas");
export const videoCtx = videoCanvas.getContext("2d");
export const processingCanvas = document.createElement("canvas");
export const processingCtx = processingCanvas.getContext("2d");
export const nsfwOffscreenCanvas = document.createElement("canvas");
export const nsfwOffscreenCtx = nsfwOffscreenCanvas.getContext("2d");


document.body.appendChild(faceCanvas);
document.body.appendChild(videoCanvas);

// FaceAPI 모델 로드 함수
export async function loadFaceAPIModels() {
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/public/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/public/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/public/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/public/models'),
        faceapi.nets.ssdMobilenetv1.loadFromUri('/public/models')
    ]);
    console.log("✅ FaceAPI 모델 로드 완료");
}


// SelfieSegmentation 모듈 로드
export async function loadSelfieSegmentation() {
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
        console.log("✅ SelfieSegmentation 객체 생성 완료");
        return selfieSegmentation;
    } catch (error) {
        console.error("❌ SelfieSegmentation 모듈 로드 실패:", error);
        return null;
    }
}


// 캔버스 크기 업데이트 함수
export function setCanvasSize(myFace) {
    if (!myFace || !videoCanvas || !processingCanvas || !faceCanvas) {
        console.error("❌ setCanvasSize 호출 시 캔버스 요소가 정의되지 않음");
        return;
    }
    videoCanvas.width = myFace.videoWidth;
    videoCanvas.height = myFace.videoHeight;
    processingCanvas.width = videoCanvas.width;
    processingCanvas.height = videoCanvas.height;
    faceCanvas.width = videoCanvas.width;
    faceCanvas.height = videoCanvas.height;
    console.log("✅ 캔버스 크기 설정 완료:", videoCanvas.width, videoCanvas.height);
}


// NSFW 감지 함수 (500ms 주기로 실행)
export async function analyzeNSFWFrame(myFace, nsfwOffscreenCanvas, nsfwOffscreenCtx) {
    if (!myFace || myFace.videoWidth === 0 || myFace.videoHeight === 0) {
        console.warn("⚠️ analyzeNSFWFrame: 비디오 크기가 0이므로 실행하지 않음.");
        return false;
    }

    nsfwOffscreenCanvas.width = myFace.videoWidth;
    nsfwOffscreenCanvas.height = myFace.videoHeight;
    nsfwOffscreenCtx.drawImage(myFace, 0, 0, nsfwOffscreenCanvas.width, nsfwOffscreenCanvas.height);
    
    try {
        const predictions = await nsfwModel.classify(nsfwOffscreenCanvas);
        return predictions.some(pred => {
            const category = pred.className.toLowerCase();
            return ["porn", "sexy", "hentai"].includes(category) && pred.probability > 0.3;
        });
    } catch (error) {
        console.error("❌ NSFW 분류 오류:", error);
        return false;
    }
}

// NSFW.js 모델 로드 및 주기적 감지 시작
export async function startNSFWCheck() {
    try {
        nsfwModel = await nsfwjs.load("/nsfw_model/", { size: 299 });
        console.log("✅ NSFW.js 모델 로드 완료");

        setInterval(async () => {
            if (!nsfwModel || myFace.videoWidth === 0) {
                console.warn("⚠️ 비디오 크기가 0이므로 NSFW 감지 실행 안 함.");
                return;
            }
            isExplicit = await analyzeNSFWFrame(myFace, nsfwOffscreenCanvas, nsfwOffscreenCtx);
        }, 500);
    } catch (error) {
        console.error("❌ NSFW.js 모델 로드 실패:", error);
    }
}


// 가상 배경 및 NSFW 처리를 위한 함수
export async function applyVirtualBackground(myFace, videoCanvas, processingCanvas, processingCtx, videoCtx, isBackgroundEnabled, backgroundImg) {
    const selfieSegmentation = await loadSelfieSegmentation();
    if (!selfieSegmentation) return;

    while (myFace.videoWidth === 0 || myFace.videoHeight === 0) {
        console.warn("⏳ 비디오가 아직 로드되지 않음. 100ms 대기 후 재시도...");
        await new Promise(resolve => setTimeout(resolve, 100));
    }

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
                await applyVirtualBackground(myFace, videoCanvas, processingCanvas, processingCtx, videoCtx, isBackgroundEnabled, backgroundImg);
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

    myFace.addEventListener("play", (processVideo));

    selfieSegmentation.onResults((results) => {
        videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
        if (!results.segmentationMask || !isBackgroundEnabled) {
            videoCtx.save();
            videoCtx.translate(videoCanvas.width, 0);
            videoCtx.scale(-1, 1);
            videoCtx.drawImage(processingCanvas, 0, 0, videoCanvas.width, videoCanvas.height);
            videoCtx.restore();
            console.log("background off");
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
            videoCtx.save();
            videoCtx.translate(videoCanvas.width, 0);
            videoCtx.scale(-1, 1);
            // videoCtx.globalCompositeOperation = "source-over";
            videoCtx.fillStyle = 'rgba(0, 0, 0, 1)';
            videoCtx.fillRect(0, 0, videoCanvas.width, videoCanvas.height);
            const censoredImg = new Image();
            censoredImg.onload = () => {
                videoCtx.drawImage(censoredImg, 0, 0, videoCanvas.width, videoCanvas.height);
            };
            censoredImg.src = '/public/images/censored.jpg';
        }
    });

    // WebGL 컨텍스트 손실 복구
    videoCanvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        console.warn("WebGL context lost. 재설정 시도...");
        setTimeout(applyVirtualBackground, 1000);
    });
}


export async function loadReferenceImage() {
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


export async function drawFaceBoxes(myFace, videoCanvas, faceCanvas) {
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
        if (myFace.videoWidth === 0 || myFace.videoHeight === 0) return;
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
        setTimeout(detectFaces, 200); // 200ms마다 얼굴 감지
    }
    detectFaces();
}
