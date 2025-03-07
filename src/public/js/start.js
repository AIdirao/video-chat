import socket from "./socket.js";

const createMeetingForm = document.getElementById("createMeetingForm");
const enterCodeForm = document.getElementById("enterCodeForm");

document.getElementById('privacyModeBtn').addEventListener('click', function() {
    window.location.href = '/privacyset';
});


// 새 회의 생성
createMeetingForm.addEventListener("submit", async (event) => {
    event.preventDefault(); 
    const roomName = createMeetingForm.querySelector("input[name='roomName']").value.trim();

    if (!roomName) {
        alert("회의 이름을 입력하세요.");
        return;
    }

    console.log("📤 [CLIENT] Sending create_room event to server with room name:", roomName);
    
    // 서버에서 방 생성 후 바로 입장
    socket.emit("create_room", { roomName }, ({ roomID, roomName }) => {
        console.log(`생성 완료: ${roomID} (이름: ${roomName})`);

        sessionStorage.setItem("roomID", roomID);
        sessionStorage.setItem("roomName", roomName);
        window.location.href = "/waiting"; 
    });
});


// 회의 코드로 입장 시도
enterCodeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const roomID = enterCodeForm.querySelector("input[name='roomID']").value.trim().toUpperCase();

    console.log("📤 [CLIENT] Checking if room exists:", roomID);

    // 방이 존재 확인
    socket.emit("check_room", roomID, (response) => {
        if (response.error) {
            alert(response.error);  
        } else {
            console.log(`[CLIENT] Room exists: ${roomID}`);

            // 회의 코드가 유효하면 sessionStorage에 저장하고 이동
            sessionStorage.setItem("roomID", roomID);
            sessionStorage.setItem("roomName", response.roomName);
            window.location.href = "/waiting";  
        }
    });
});