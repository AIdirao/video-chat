const socket = io();
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

// 카메라 및 마이크 설정 로직
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

// 이벤트 리스너들 및 WebRTC 연결 로직
muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("change", handleCameraChange);

socket.on("offer", async (offer) => {
    await myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
});

socket.on("answer", answer => {
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", ice => {
    myPeerConnection.addIceCandidate(ice);
});

function makeConnection() {
    myPeerConnection = new RTCPeerConnection();
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(event) {
    if (event.candidate) {
        socket.emit("ice", event.candidate, roomName);
    }
}

function handleAddStream(event) {
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = event.streams[0];
}

myPeerConnection.addEventListener("icecandidate", handleIce);
myPeerConnection.addEventListener("track", handleAddStream);
