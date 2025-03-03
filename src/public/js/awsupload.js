async function getPresignedUrl(fileName, fileType) {
    const response = await fetch("/generate-presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, fileType })
    });

    const { url } = await response.json();
    return url;
}

async function uploadFile(file) {
    const url = await getPresignedUrl(file.name, file.type);
    if (!url) {
        console.error("Presigned URL 생성 실패");
        return;
    }

    const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
    });

    if (uploadResponse.ok) {
        console.log("✅ 업로드 성공:", url.split("?")[0]);
        return url.split("?")[0]; // 업로드된 파일의 URL 반환
    } else {
        console.error("❌ 업로드 실패");
    }
}

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
