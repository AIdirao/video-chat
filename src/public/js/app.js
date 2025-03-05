import socket from "./socket.js"; 

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call_meeting");
const welcome = document.getElementById("welcome");
const nicknameForm = document.getElementById("nicknameForm");
const meetingCodeDisplay = document.getElementById("meetingCodeDisplay");
const nicknameDisplay = document.getElementById("nickname");


call.style.display = "none"; // 기본적으로 숨김
nicknameForm.style.display = "flex"; 

let myStream;
let muted = false;
let cameraoff = false;
let roomID;
let myPeerConnection;
let myNickname;
let roomName;

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



/* 화상 회의 기능 */
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

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("change", handleCameraChange);


async function StartMedia() {
    // checking if makeConnection() has called - debugging
    console.log("Starting Media...");    
    await getMedia();
    makeConnection();
    
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
    // debugging
    console.log("RTCPeerConnection created", myPeerConnection);
    
    myPeerConnection.addEventListener("icecandidate", handleIce); 
    myPeerConnection.addEventListener("track", handleTrack);

    //debugging
    if (myStream) {
        myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));
    } else {
        console.error("makeConnection() 실행 시 myStream이 정의되지 않음");
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
