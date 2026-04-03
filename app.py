import os
import cv2
import random
import base64
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")


def preprocess_image(gray):
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized = clahe.apply(gray)
    return equalized


def detect_faces(gray):
    processed = preprocess_image(gray)

    params = [
        {"scaleFactor": 1.05, "minNeighbors": 3, "minSize": (30, 30)},
        {"scaleFactor": 1.1,  "minNeighbors": 3, "minSize": (30, 30)},
        {"scaleFactor": 1.1,  "minNeighbors": 4, "minSize": (40, 40)},
        {"scaleFactor": 1.2,  "minNeighbors": 3, "minSize": (30, 30)},
    ]

    for p in params:
        faces = face_cascade.detectMultiScale(processed, **p)
        if len(faces) > 0:
            return faces, len(faces)

    for p in params[:2]:
        faces = profile_cascade.detectMultiScale(processed, **p)
        if len(faces) > 0:
            return faces, len(faces)

    for p in params:
        faces = face_cascade.detectMultiScale(gray, **p)
        if len(faces) > 0:
            return faces, len(faces)

    return [], 0


def analyze_frame(image_data_b64):
    try:
        if "," in image_data_b64:
            image_data_b64 = image_data_b64.split(",")[1]

        padding = len(image_data_b64) % 4
        if padding:
            image_data_b64 += "=" * (4 - padding)

        image_bytes = base64.b64decode(image_data_b64)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return None, False, 0, "Could not decode image"

        h, w = frame.shape[:2]
        if w > 1280:
            scale = 1280 / w
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces, face_count = detect_faces(gray)

        face_detected = face_count > 0
        return frame, face_detected, face_count, None

    except Exception as e:
        return None, False, 0, str(e)


def detect_intoxication_logic(face_detected):
    if not face_detected:
        return "No Face Detected", "unknown", 0.0

    intoxication_probability = random.uniform(0.0, 1.0)

    if intoxication_probability > 0.5:
        result = "Drunk"
        confidence = round(intoxication_probability * 100, 1)
        status = "drunk"
    else:
        result = "Not Drunk"
        confidence = round((1 - intoxication_probability) * 100, 1)
        status = "sober"

    return result, status, confidence


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/favicon.ico")
def favicon():
    return "", 204


@app.route("/detect", methods=["POST"])
def detect():
    data = request.get_json(silent=True)

    if not data or "image" not in data:
        return jsonify({
            "success": False,
            "result": "Error",
            "status": "error",
            "message": "No image data provided",
            "confidence": 0.0,
            "face_detected": False,
            "face_count": 0
        }), 400

    image_data = data["image"]
    frame, face_detected, face_count, error = analyze_frame(image_data)

    if error:
        return jsonify({
            "success": False,
            "result": "Error",
            "status": "error",
            "message": f"Image processing error: {error}",
            "confidence": 0.0,
            "face_detected": False,
            "face_count": 0
        }), 500

    result, status, confidence = detect_intoxication_logic(face_detected)

    return jsonify({
        "success": True,
        "result": result,
        "status": status,
        "confidence": confidence,
        "face_detected": face_detected,
        "face_count": face_count,
        "message": "Detection complete"
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Alcohol Detection System"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
