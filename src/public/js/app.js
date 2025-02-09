const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const welcome = document.getElementById("welcome");
const nicknameForm = document.getElementById("nicknameForm");
const enterRoomForm = document.getElementById("enterRoom");

call.hidden = true; // 비디오 통화 화면 숨김
nicknameForm.hidden = false;
let myStream;
let muted = false;
let cameraoff = false;
let roomName;
let myPeerConnection;

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

async function initCall() {
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const nicknameInput = nicknameForm.querySelector("input");

    if (nicknameInput.value.trim() !== "") {
        roomName = 'defaultRoom';
        call.hidden = false;
        await initCall();
        socket.emit("join_room", roomName);
        nicknameForm.hidden = true;
    } else {
        alert("Please enter a nickname.");
    }
}

nicknameForm.addEventListener("submit", handleWelcomeSubmit);

socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, roomName);
});

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
    myPeerConnection.addEventListener("icecandidate", handleIce); 
    myPeerConnection.addEventListener("track", handleAddStream);
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(event) {
    if (event.candidate) {
        socket.emit("ice", event.candidate, roomName);
    }
}

function handleAddStream(event) {
    const peerFace = document.getElementById("peerFace");
    if(peerFace) {
        peerFace.srcObject = event.streams[0];
    } else {
        console.error("PeerFace element not found");
    }
}
