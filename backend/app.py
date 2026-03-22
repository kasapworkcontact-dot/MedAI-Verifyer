import os
import uuid
import json
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

from database import (
    init_db, get_db, create_session, update_session_status,
    save_detections, save_crop, update_crop_label,
    save_ocr_results, save_final_results, get_session_data
)
import yolo_detector
import gemini_ocr

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "medai-dev-secret-2026")
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://localhost:8080", "http://localhost:3000", "https://*.github.io", "https://kasap.github.io"], allow_headers=["Content-Type"], expose_headers=["Access-Control-Allow-Origin"])


UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
CROPS_DIR = os.path.join(os.path.dirname(__file__), "crops")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CROPS_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(user) if user else None


# ──────────────────────────────────────────────
# AUTH ENDPOINTS
# ──────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?", (username, email)
    ).fetchone()

    if existing:
        conn.close()
        return jsonify({"error": "Username or email already exists"}), 409

    pw_hash = generate_password_hash(password)
    conn.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, email, pw_hash)
    )
    conn.commit()
    user = conn.execute("SELECT id, username, email FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()

    session["user_id"] = user["id"]
    return jsonify({"message": "Registered successfully", "user": dict(user)}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user["id"]
    return jsonify({
        "message": "Logged in successfully",
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]}
    })


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/auth/me", methods=["GET"])
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": {"id": user["id"], "username": user["username"], "email": user["email"]}})


# ──────────────────────────────────────────────
# ANALYSIS ENDPOINTS
# ──────────────────────────────────────────────

@app.route("/api/detect", methods=["POST"])
def detect():
    """Detect surgical equipment in pre-op and/or post-op images."""
    session_id = request.form.get("session_id") or str(uuid.uuid4())
    user = current_user()
    user_id = user["id"] if user else None

    create_session(session_id, user_id)

    results = {}
    all_crops = []

    for image_type in ["pre_op", "post_op"]:
        file = request.files.get(image_type)
        if not file or not allowed_file(file.filename):
            continue

        filename = secure_filename(f"{session_id}_{image_type}_{file.filename}")
        filepath = os.path.join(UPLOAD_DIR, filename)
        file.save(filepath)

        try:
            counts, crops_info = yolo_detector.detect(filepath, session_id, image_type)
            save_detections(session_id, image_type, counts)
            for crop in crops_info:
                save_crop(
                    session_id,
                    crop["filename"],
                    crop["class_name"],
                    crop["confidence"],
                    crop["image_type"]
                )
            results[image_type] = counts
            all_crops.extend(crops_info)
        except Exception as e:
            print(f"[detect] Error on {image_type}: {e}")
            results[image_type] = {"error": str(e)}

    if not results:
        return jsonify({"error": "No valid images provided"}), 400

    update_session_status(session_id, "detected")
    return jsonify({
        "session_id": session_id,
        "detections": results,
        "low_confidence_crops": all_crops,
        "has_crops": len(all_crops) > 0
    })


@app.route("/api/ocr", methods=["POST"])
def ocr():
    """OCR a surgical checklist form image using Gemini."""
    session_id = request.form.get("session_id")
    file = request.files.get("form_image")

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400
    if not file or not allowed_file(file.filename):
        return jsonify({"error": "Valid form image required"}), 400

    filename = secure_filename(f"{session_id}_form_{file.filename}")
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    try:
        ocr_data = gemini_ocr.ocr_form(filepath)
        save_ocr_results(session_id, ocr_data)
        update_session_status(session_id, "ocr_done")
        return jsonify({"session_id": session_id, "ocr_results": ocr_data})
    except Exception as e:
        print(f"[ocr] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/crops", methods=["GET"])
def get_crops():
    """Return list of low-confidence crops for a session."""
    session_id = request.args.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id required"}), 400

    conn = get_db()
    crops = conn.execute(
        "SELECT * FROM crops WHERE session_id = ?", (session_id,)
    ).fetchall()
    conn.close()

    return jsonify({"crops": [dict(c) for c in crops]})


@app.route("/api/crops/<filename>")
def serve_crop(filename):
    """Serve a crop image file."""
    return send_from_directory(CROPS_DIR, filename)


@app.route("/api/label", methods=["POST"])
def label():
    """Save human label for a low-confidence crop."""
    data = request.get_json()
    crop_id = data.get("crop_id")
    human_label = data.get("human_label", "").strip()

    if not crop_id or not human_label:
        return jsonify({"error": "crop_id and human_label are required"}), 400

    update_crop_label(crop_id, human_label)
    return jsonify({"message": "Label saved"})


@app.route("/api/session/<session_id>", methods=["GET"])
def get_session(session_id):
    """Get full session data including detections, crops, OCR, final results."""
    data = get_session_data(session_id)
    if not data:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(data)


@app.route("/api/session/<session_id>/summary", methods=["GET"])
def session_summary(session_id):
    """
    Return a merged comparison table:
    YOLO counts (pre_op + post_op + human labels) vs OCR counts per equipment name.
    """
    conn = get_db()

    # YOLO detections
    detections = conn.execute(
        "SELECT image_type, class_name, count FROM detections WHERE session_id = ?",
        (session_id,)
    ).fetchall()

    # Human labels from crops
    labeled_crops = conn.execute(
        "SELECT human_label FROM crops WHERE session_id = ? AND human_label IS NOT NULL",
        (session_id,)
    ).fetchall()

    # OCR results
    ocr_rows = conn.execute(
        "SELECT equipment_name, ocr_count FROM ocr_results WHERE session_id = ?",
        (session_id,)
    ).fetchall()

    conn.close()

    # Aggregate YOLO counts (sum pre+post)
    yolo_counts = {}
    for det in detections:
        name = det["class_name"]
        yolo_counts[name] = yolo_counts.get(name, 0) + det["count"]

    # Add human labels
    for row in labeled_crops:
        label_name = row["human_label"]
        yolo_counts[label_name] = yolo_counts.get(label_name, 0) + 1

    # OCR counts
    ocr_counts = {row["equipment_name"]: row["ocr_count"] for row in ocr_rows}

    # Merge all equipment names
    all_names = set(yolo_counts.keys()) | set(ocr_counts.keys())
    comparison = []
    for name in sorted(all_names):
        y = yolo_counts.get(name, 0)
        o = ocr_counts.get(name, 0)
        comparison.append({
            "equipment_name": name,
            "yolo_count": y,
            "ocr_count": o,
            "match": y == o,
        })

    return jsonify({"session_id": session_id, "comparison": comparison})


@app.route("/api/final", methods=["POST"])
def save_final():
    """Save human-corrected final results."""
    data = request.get_json()
    session_id = data.get("session_id")
    results = data.get("results", [])

    if not session_id:
        return jsonify({"error": "session_id required"}), 400

    save_final_results(session_id, results)
    update_session_status(session_id, "completed")
    return jsonify({"message": "Final results saved", "session_id": session_id})


@app.route("/api/history", methods=["GET"])
def history():
    """Get all sessions for the current user."""
    user = current_user()
    conn = get_db()
    if user:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
            (user["id"],)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 20"
        ).fetchall()
    conn.close()
    return jsonify({"sessions": [dict(r) for r in rows]})


# ──────────────────────────────────────────────
# STARTUP
# ──────────────────────────────────────────────
init_db()

if __name__ == "__main__":
    print("[MedAI] Database initialized")
    print("[MedAI] Starting server at http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
