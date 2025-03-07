async function getPresignedUrl(fileName, fileType) {
    const response = await fetch("/generate-presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, fileType })
    });

    const { url } = await response.json();
    return url;
}
// S3 업로드 후 URL 저장
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

        if (uploadResponse.ok) {
            console.log(`업로드 성공! S3 URL: ${fileUrl}`);
            
            // 업로드된 얼굴 이미지 URL을 로컬 스토리지에 저장
            localStorage.setItem("uploadedFaceUrl", fileUrl);
            
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

// 이미지 업로드 및 미리보기
document.addEventListener("DOMContentLoaded", function () {
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
        const files = Array.from(faceUpload.files).slice(0, 1); // 한 개의 참조 이미지만 사용

        for (const file of files) {
            if (!file.type.startsWith("image/")) continue; // 이미지 파일만 허용

            const uploadedUrl = await uploadFile(file); // S3 업로드 실행

            if (uploadedUrl) {
                // 업로드된 이미지 미리보기 추가
                const img = document.createElement("img");
                img.src = uploadedUrl;
                img.alt = "Uploaded Face Image";
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

// 이벤트 리스너 추가
document.addEventListener("DOMContentLoaded", function () {
    const faceUpload = document.getElementById("faceUpload");
    const previewContainer = document.getElementById("previewContainer");

    faceUpload.addEventListener("change", async function () {
        previewContainer.innerHTML = "";
        const files = Array.from(faceUpload.files).slice(0, 5); // 최대 5개만 선택

        for (const file of files) {
            if (!file.type.startsWith("image/")) continue; // 이미지 파일만 허용

            const imageUrl = await uploadFile(file);
            if (imageUrl) {
                const img = document.createElement("img");
                img.src = imageUrl;
                img.style.width = "100px";
                img.style.height = "100px";
                img.style.margin = "5px";
                img.style.objectFit = "cover";
                previewContainer.appendChild(img);
            }
        }
    });
});