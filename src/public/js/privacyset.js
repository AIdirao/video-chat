// routing
document.getElementById('joinCamBtn').addEventListener('click', function() {
    window.location.href = '/';
});


// AWS Presigned URL 요청 함수
async function getPresignedUrl(fileName, fileType) {
    try {
        console.log(`Presigned URL 요청: ${fileName}, ${fileType}`);
        
        const response = await fetch("/generate-presigned-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName, fileType })
        });

        if (!response.ok) {
            console.error("Presigned URL 요청 실패:", response.status);
            return null;
        }

        const data = await response.json();
        console.log("Presigned URL 응답:", data);
        
        return data;
    } catch (error) {
        console.error("Presigned URL 요청 중 오류 발생:", error);
        return null;
    }
}

// S3에 파일 업로드
async function uploadFile(file) {
    if (!file) return null;

    // 1. Presigned URL 요청
    const presignedData = await getPresignedUrl(file.name, file.type);
    if (!presignedData || !presignedData.presignedUrl) {
        console.error("Presigned URL을 가져오지 못했습니다.");
        return null;
    }

    const { presignedUrl, fileUrl } = presignedData;


    try {
        // 2. Presigned URL로 파일 업로드
        const uploadResponse = await fetch(presignedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type }
        });

        console.log(`📡 PUT 요청 상태: ${uploadResponse.status}`);

        if (uploadResponse.ok) {
            console.log(`업로드 성공! S3 URL: ${fileUrl}`);

            // ✅ localStorage에 저장하기 전에 값 확인
            if (fileUrl) {
                console.log("📌 저장할 S3 URL:", fileUrl);
                localStorage.setItem("uploadedFaceUrl", fileUrl);

                // ✅ 저장 후 확인
                console.log("📌 저장된 값:", localStorage.getItem("uploadedFaceUrl"));
            } else {
                console.error("❌ 저장할 URL이 존재하지 않습니다.");
            }


            return fileUrl;
        } else {
            console.error("업로드 실패:", uploadResponse.status, uploadResponse.statusText);
            return null;
        }
    } catch (error) {
        console.error("파일 업로드 중 오류 발생:", error);
        return null;
    }
}

// URL 전달 함수
function urlpass(url){
    const faceurl = url;
    return faceurl;
}


document.addEventListener("DOMContentLoaded", function () {
    const consentModal = document.getElementById("consentModal");
    const agreeBtn = document.getElementById("agreeConsent");
    const declineBtn = document.getElementById("declineConsent");

    const requiredCheckbox = document.getElementById("requiredConsent");

    const consentKey = "privacyConsentGiven";

    // 팝업 표시 조건
    if (!localStorage.getItem(consentKey)) {
        consentModal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    agreeBtn.addEventListener("click", () => {
        if (!requiredCheckbox.checked) {
            alert("필수 항목에 동의해야 서비스를 이용할 수 있습니다.");
            return;
        }

        // 저장: 필수 항목은 무조건 true, 선택은 체크 여부
        localStorage.setItem(consentKey, "true");

        consentModal.style.display = "none";
        document.body.style.overflow = "auto";
    });

    declineBtn.addEventListener("click", () => {
        alert("서비스 이용을 위해 개인정보 수집에 동의가 필요합니다.");
        window.location.href = "https://www.aidirao.shop"; // 혹은 로그인 페이지로
    });

    /* page routing */
    document.getElementById('joinCamBtn').addEventListener('click', function () {
        window.location.href = '/';
    });

    /* face filtering on off */
    const filterToggle = document.getElementById('filterToggle');

    if (filterToggle) {
        const savedState = localStorage.getItem('filterEnabled');
        if (savedState !== null) {
            filterToggle.checked = savedState === 'true';
        }

        // 체크 상태 변경 시 로컬 스토리지에 저장
        filterToggle.addEventListener('click', function () {
            console.log(this.checked ? '필터링 기능 활성화됨' : '필터링 기능 비활성화됨');
            localStorage.setItem('filterEnabled', this.checked); 
        });
    }

    /* 이미지 업로드 및 미리보기 */
    console.log(" privacyset.js 로드 완료");

    const faceUpload = document.getElementById("faceUpload");
    const previewContainer = document.getElementById("previewContainer");

    if (!faceUpload) {
        console.error("faceUpload 요소를 찾을 수 없습니다");
        return;
    }

    faceUpload.addEventListener("change", async function () {
        console.log("파일 선택됨");

        if (faceUpload.files.length === 0) {
            console.warn("파일 선택 x");
            return;
        }

        previewContainer.innerHTML = ""; // 기존 미리보기 초기화
        const files = Array.from(faceUpload.files).slice(0, 5); // 최대 5개 업로드

        for (const file of files) {
            if (!file.type.startsWith("image/")) continue; // 이미지 파일만 허용

            const uploadedUrl = await uploadFile(file); // S3 업로드 실행

            if (uploadedUrl) {
                // 업로드된 이미지 미리보기 추가
                const img = document.createElement("img");
                img.src = uploadedUrl;
                img.alt = "Uploaded Image";
                img.style.width = "100px";
                img.style.height = "100px";
                img.style.margin = "5px";
                img.style.objectFit = "cover";
                previewContainer.appendChild(img);




            } else {
                console.error(`파일 업로드 실패: ${file.name}`);
            }
        }
    });
});