import os
import cv2
import math
from glob import glob

# from PIL import Image
from nudenet import NudeDetector
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np

app = Flask(__name__)
CORS(app)

# NudeDetector 초기화
detector = NudeDetector()

# 허용된 라벨 집합: 이 라벨들은 검열하지 않음``
allowed_labels = {"FACE_FEMALE", "FEET_EXPOSED", "FACE_MALE"}

# # 시각화 함수
# def display_images(image_paths, figsize=(20, 20), cols=3):
#     """
#     여러 이미지를 그리드 형태로 표시하는 함수.

#     :param image_paths: 이미지 파일 경로 리스트
#     :param figsize: 그림 크기 (인치 단위)
#     :param cols: 열의 개수
#     """
#     rows = math.ceil(len(image_paths) / cols)
#     fig, axes = plt.subplots(rows, cols, figsize=figsize)

#     if rows == 1:
#         axes = axes.reshape(1, -1)

#     for i, path in enumerate(image_paths):
#         row = i // cols
#         col = i % cols
#         img = Image.open(path)
#         axes[row, col].imshow(img)
#         axes[row, col].axis('off')
#         axes[row, col].set_title(f'Image {i+1}')

#     # 사용하지 않는 서브플롯 제거
#     for i in range(len(image_paths), rows * cols):
#         row = i // cols
#         col = i % cols
#         fig.delaxes(axes[row, col])

#     plt.tight_layout()
#     plt.show()

# def censor_by_detection(image_path, allowed_labels, output_path=None):
#     # 이미지에서 모든 객체 감지
#     detections = detector.detect(image_path)
#     img = cv2.imread(image_path)

#     # 검열해야 할 바운딩박스들의 전체 범위를 담을 변수
#     x_min, y_min = float('inf'), float('inf')
#     x_max, y_max = 0, 0

#     # 감지된 객체들 중 허용되지 않은 라벨을 가진 바운딩박스들에 대해
#     # 가장 왼쪽/위쪽/오른쪽/아래쪽을 전체 범위로 갱신
#     for detection in detections:
#         label = detection["class"]
#         if label not in allowed_labels:
#             x, y, w, h = detection["box"]
#             x2, y2 = x + w, y + h
#             x_min = min(x_min, x)
#             y_min = min(y_min, y)
#             x_max = max(x_max, x2)
#             y_max = max(y_max, y2)

#     # 만약 검열 대상이 있었다면 (x_min, y_min, x_max, y_max)가 유효해짐
#     if x_min < x_max and y_min < y_max:
#         # 검열 대상 전체 범위를 검정색으로 채움
#         img[y_min:y_max, x_min:x_max] = (0, 0, 0)

#     # 결과 이미지 저장 경로가 지정되지 않았다면 자동 생성
#     if not output_path:
#         base, ext = os.path.splitext(image_path)
#         output_path = f"{base}_censored{ext}"

#     cv2.imwrite(output_path, img)
#     return output_path

# 처리할 이미지 파일 경로 지정 (예시)
# image_files = glob("*jpeg") + glob("*jpg")

# # 각 이미지에 대해 위 함수로 검열 처리 후 결과 파일 경로를 리스트에 저장
# censored_images = []
# for img_path in image_files:
#     censored_img_path = censor_by_detection(img_path, allowed_labels)
#     censored_images.append(censored_img_path)

# 결과 이미지 시각화
# display_images(censored_images)


@app.route("/check_nudity", methods=["POST"])
def filter_nudity():
    data = request.json
    image_data = data.get("image")

    if not image_data:
        return jsonify({"error": "No iamge"}), 400

    # base64 -> OpenCV 이미지 변환
    img_bytes = base64.b64decode(image_data.split(",")[1])
    np_img = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    detections = detector.detect(img)

    # 검열해야 할 바운딩박스들의 전체 범위를 담을 변수
    x_min, y_min = float("inf"), float("inf")
    x_max, y_max = 0, 0

    # 감지된 객체들 중 허용되지 않은 라벨을 가진 바운딩박스들에 대해
    # 가장 왼쪽/위쪽/오른쪽/아래쪽을 전체 범위로 갱신
    for detection in detections:
        label = detection["class"]
        if label not in allowed_labels:
            x, y, w, h = detection["box"]
            x2, y2 = x + w, y + h
            x_min = min(x_min, x)
            y_min = min(y_min, y)
            x_max = max(x_max, x2)
            y_max = max(y_max, y2)

    # 만약 검열 대상이 있었다면 (x_min, y_min, x_max, y_max)가 유효해짐
    if x_min < x_max and y_min < y_max:
        # 검열 대상 전체 범위를 검정색으로 채움
        img[y_min:y_max, x_min:x_max] = (0, 0, 0)

    # # 결과 이미지 저장 경로가 지정되지 않았다면 자동 생성
    # if not output_path:
    #     base, ext = os.path.splitext(image_path)
    #     output_path = f"{base}_censored{ext}"

    # cv2.imwrite(output_path, img)
    # return output_path
    _, buffer = cv2.imencode(".jpg", img)
    mosaic_img = base64.b64encode(buffer).decode("utf-8")

    return jsonify({"mosaic_img": f"data:image/jpeg;base64,{mosaic_img}"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
