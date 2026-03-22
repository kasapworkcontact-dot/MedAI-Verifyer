import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "medai.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    # Users table
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # Sessions table (analysis sessions)
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Detection results
    c.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            image_type TEXT,  -- 'pre_op' | 'post_op'
            class_name TEXT,
            count INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    """)

    # Low-confidence crops
    c.execute("""
        CREATE TABLE IF NOT EXISTS crops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            filename TEXT,
            class_name TEXT,
            confidence REAL,
            human_label TEXT,
            image_type TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    """)

    # OCR results
    c.execute("""
        CREATE TABLE IF NOT EXISTS ocr_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            equipment_name TEXT,
            ocr_count INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    """)

    # Final results (human-corrected)
    c.execute("""
        CREATE TABLE IF NOT EXISTS final_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            equipment_name TEXT,
            yolo_count INTEGER DEFAULT 0,
            ocr_count INTEGER DEFAULT 0,
            corrected_count INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
    """)

    conn.commit()
    conn.close()


def create_session(session_id, user_id=None):
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (id, user_id, status) VALUES (?, ?, 'processing')",
        (session_id, user_id)
    )
    conn.commit()
    conn.close()


def update_session_status(session_id, status):
    conn = get_db()
    conn.execute("UPDATE sessions SET status = ? WHERE id = ?", (status, session_id))
    conn.commit()
    conn.close()


def save_detections(session_id, image_type, counts: dict):
    conn = get_db()
    for class_name, count in counts.items():
        conn.execute(
            "INSERT INTO detections (session_id, image_type, class_name, count) VALUES (?, ?, ?, ?)",
            (session_id, image_type, class_name, count)
        )
    conn.commit()
    conn.close()


def save_crop(session_id, filename, class_name, confidence, image_type):
    conn = get_db()
    conn.execute(
        "INSERT INTO crops (session_id, filename, class_name, confidence, image_type) VALUES (?, ?, ?, ?, ?)",
        (session_id, filename, class_name, confidence, image_type)
    )
    conn.commit()
    conn.close()


def update_crop_label(crop_id, human_label):
    conn = get_db()
    conn.execute("UPDATE crops SET human_label = ? WHERE id = ?", (human_label, crop_id))
    conn.commit()
    conn.close()


def save_ocr_results(session_id, ocr_data: dict):
    conn = get_db()
    for name, count in ocr_data.items():
        conn.execute(
            "INSERT INTO ocr_results (session_id, equipment_name, ocr_count) VALUES (?, ?, ?)",
            (session_id, name, count)
        )
    conn.commit()
    conn.close()


def save_final_results(session_id, results: list):
    conn = get_db()
    conn.execute("DELETE FROM final_results WHERE session_id = ?", (session_id,))
    for r in results:
        conn.execute(
            """INSERT INTO final_results 
               (session_id, equipment_name, yolo_count, ocr_count, corrected_count)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, r["equipment_name"], r["yolo_count"], r["ocr_count"], r["corrected_count"])
        )
    conn.commit()
    conn.close()


def get_session_data(session_id):
    conn = get_db()
    
    session = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not session:
        conn.close()
        return None

    detections = conn.execute(
        "SELECT * FROM detections WHERE session_id = ?", (session_id,)
    ).fetchall()

    crops = conn.execute(
        "SELECT * FROM crops WHERE session_id = ?", (session_id,)
    ).fetchall()

    ocr = conn.execute(
        "SELECT * FROM ocr_results WHERE session_id = ?", (session_id,)
    ).fetchall()

    final = conn.execute(
        "SELECT * FROM final_results WHERE session_id = ?", (session_id,)
    ).fetchall()

    conn.close()

    return {
        "session": dict(session),
        "detections": [dict(d) for d in detections],
        "crops": [dict(c) for c in crops],
        "ocr_results": [dict(o) for o in ocr],
        "final_results": [dict(f) for f in final],
    }
