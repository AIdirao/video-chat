const socket = io();
const nicknameForm = document.getElementById("nicknameForm");
const enterRoomForm = document.getElementById("enterRoom");
const welcome = document.getElementById("welcome");
const call = document.getElementById("call");

call.hidden = true; // 비디오 통화 화면 숨김
enterRoomForm.hidden = true;

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    if (!nicknameForm.hidden) {
        const nicknameInput = nicknameForm.querySelector("input");
        nicknameForm.hidden = true;
        enterRoomForm.hidden = false;
    } else {
        const roomInput = enterRoomForm.querySelector("input");
        const roomName = roomInput.value;
        roomInput.value = "";
        enterRoomForm.hidden = true;
        call.hidden = false;
        socket.emit("join_room", roomName);
    }
}

nicknameForm.addEventListener("submit", handleWelcomeSubmit);
enterRoomForm.addEventListener("submit", handleWelcomeSubmit);
