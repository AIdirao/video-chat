const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");

/* phone call code */
const call = document.getElementById("call");

call.hidden = true;


let myStream;
let muted = false;
let cameraoff = false;
let roomName;
let myPeerConnection;

async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device=> device.kind ==="videoinput");
        // let us know which camera is selected before construct options
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            // now we know currently using camera
            if(currentCamera.label == camera.label){
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        });
    }catch(e){
        console.log(e);
    }
}

async function getMedia(deviceID){
    // basic setting of deviceID constraints since no deviceID yet.. 
    const initialConstraints = {
        audio: true,
        video: {facingMode : "user"} ,
    };
    const cameraConstraints = {
        audio : true,
        video: {deviceID:{exact:deviceID}},
    }
    try{
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceID? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if(!deviceID){
            await getCameras();
        }
        
    } catch(e){
        console.log(e);
    }
}



function handleMuteClick(){
    console.log(myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled));
    if(!muted){
        muteBtn.innerText="Unmute";
        muted = true;
    }else{
        muteBtn.innerText="Mute";
        muted = false;
    }
}

function handleCameraClick(){
    console.log(myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled));
    if(cameraoff){
        cameraBtn.innerText="Turn Camera Off";
        cameraoff=false;
    }else{
        cameraBtn.innerText="Turn Camera On";
        cameraoff = true;
    }
}

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind == "video");
        videoSender.replaceTrack();
    }
    
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("click", handleCameraChange);




/* Welcome form (choose a room) */
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
    welcome.hidden = true;
    call.hidden = false;
    await getMedia(); 
    makeConnection();
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value="";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);



/*socket code*/
socket.on("welcome",async ()=>{
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);
});

socket.on("offer", async(offer) => {
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
});

socket.on("answer", answer => {
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", ice =>{
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
});



/* RTC code */
function makeConnection(){
    myPeerConnection = new RTCPeerConnection();
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);

}

function handleAddStream(data){
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}

/*  socket io   */
// const welcome = document.getElementById("welcome");
// const nicknameForm = welcome.querySelector("#name");
// const enterRoomForm = welcome.querySelector("#enterRoom"); 
// const room = document.getElementById("room");
// room.hidden = true;
// enterRoomForm.hidden = true; 

// let roomName;

// function addMessage(message){
//     const ul = room.querySelector("ul");
//     const li = document.createElement("li");
//     li.innerText = message;
//     ul.appendChild(li);
// }

// function handleMessageSubmit(event){
//     event.preventDefault();
//     const input = room.querySelector("#msg input");
//     const value = input.value;
//     socket.emit("new_message", value, roomName, ()=> {
//         addMessage(`You: ${value}`);
//     });
//     input.value = "";
// }

// function handleNicknameSubmit(event){
//     event.preventDefault();
//     const input = nicknameForm.querySelector("input");
//     socket.emit("nickname", input.value, () => {});
//     nicknameForm.hidden = true;
//     enterRoomForm.hidden = false;  // 닉네임 설정 후 -> 입장form
// }


// function showRoom(){
//     welcome.hidden = true;
//     room.hidden = false;
//     const h3 = room.querySelector("h3");
//     h3.innerText = `Room ${roomName}`;
//     const msgForm = room.querySelector("#msg");
//     msgForm.addEventListener("submit", handleMessageSubmit);
// }

// function handleRoomSubmit(event){
//     event.preventDefault();
//     const input = enterRoomForm.querySelector("input");
//     roomName = input.value;
//     socket.emit("enter_room", roomName, showRoom);
//     input.value = "";
// }
// nicknameForm.addEventListener("submit", handleNicknameSubmit);
// enterRoomForm.addEventListener("submit", handleRoomSubmit);

// socket.on("welcome", (user, newCount) => {
//     const h3 = room.querySelector("h3");
//     h3.innerText = `Room ${roomName} (${newCount})`;
//     addMessage(`${user} arrived`);
// });

// socket.on("bye", (left, newCount) => {
//     const h3 = room.querySelector("h3");
//     h3.innerText = `Room ${roomName} (${newCount})`;
//     addMessage(`${left} left ㅠㅠ`);
// });

// socket.on("new_message", addMessage);

// socket.on("room_change", console.log);

// socket.on("room_change", (rooms)=> {
//     // if the room is empty
//     const roomlist = welcome.querySelector("ul");
//     roomlist.innerHTML="";
//     if(rooms.length === 0){        
//         return;
//     }
//     // show opened rooms
//     rooms.forEach(room => {
//         const li = document.createElement("li");
//         li.innerText = room;
//         roomlist.append(li);
//     });
// });
