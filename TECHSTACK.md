# Tech Stack — MedAI Verifier

ระบบตรวจสอบอุปกรณ์ผ่าตัด (Surgical Equipment Verification System) — POC สำหรับโปรเจกต์จบ

---

## Frontend

| Category | Technology | Version | รายละเอียด |
|---|---|---|---|
| Framework | **React** | 18.3 | UI library หลัก |
| Language | **TypeScript** | 5.8 | Type-safe JavaScript |
| Build Tool | **Vite** | 5.4 | Dev server + bundler (fast HMR) |
| Routing | **React Router DOM** | 6.30 | Client-side routing (`/upload`, `/annotation`, `/dashboard`) |
| UI Library | **shadcn/ui** | latest | Component library (Button, Toast, Progress, Avatar ฯลฯ) |
| UI Primitives | **Radix UI** | latest | Accessible headless components ที่ shadcn/ui ใช้ |
| Styling | **Tailwind CSS** | 3.4 | Utility-first CSS |
| Icons | **Lucide React** | 0.462 | Icon set |
| State (Server) | **TanStack Query** | 5.83 | Data fetching/caching |
| HTTP Client | custom `fetch` wrapper | — | `src/lib/api.ts` — calls Flask backend |
| Auth State | **React Context API** | — | `AuthContext.tsx` — user session state |
| Deployment | **GitHub Pages** | — | Static hosting ผ่าน `npm run build` |
| CI/CD | **GitHub Actions** | — | `.github/workflows/deploy.yml` — auto deploy on push to `main` |

---

## Backend

| Category | Technology | Version | รายละเอียด |
|---|---|---|---|
| Framework | **Flask** | 3.1 | Python web framework หลัก |
| Language | **Python** | 3.9+ | Backend language |
| CORS | **Flask-CORS** | 6.0 | อนุญาต frontend call ข้าม origin |
| Auth | **Werkzeug Security** | — | `generate_password_hash` / `check_password_hash` |
| Session | **Flask session** | — | Server-side session (cookie-based) |
| Database | **SQLite** | built-in | ไฟล์ `medai.db` |
| DB Driver | `sqlite3` | built-in | Python standard library |
| ML Inference | **ONNX Runtime** | 1.24 | รัน `best.onnx` (YOLOv8) บน CPU |
| Image Processing | **OpenCV** | 4.13 | Preprocess รูป + crop low-confidence boxes |
| Image Processing | **Pillow** | 12.1 | เปิดรูปส่งให้ Gemini |
| AI / OCR | **Google Gemini 2.0 Flash** | — | อ่านแบบฟอร์มผ่าน `google-genai` SDK (free tier) |
| Array Math | **NumPy** | latest | YOLO preprocessing + NMS |
| Config | **python-dotenv** | — | โหลด `GEMINI_API_KEY` จาก `.env` |

---

## AI / ML

| Component | รายละเอียด |
|---|---|
| **YOLO Model** | `best.onnx` — YOLOv8 format, รัน inference ด้วย ONNX Runtime บน CPU |
| **Input size** | 640×640 px (resize + normalize) |
| **NMS** | Custom NMS (IoU threshold 0.45, conf threshold 0.25) |
| **Low-confidence threshold** | < 80% → crop บันทึกเป็นไฟล์ `.jpg` ใน `backend/crops/` |
| **Gemini OCR** | `gemini-2.0-flash` รับภาพแบบฟอร์ม → return JSON รายการอุปกรณ์ + จำนวน |
| **Fallback** | ถ้าไม่มี API key → ใช้ mock OCR data อัตโนมัติ |

---

## Database Schema (SQLite)

```
users         → id, username, email, password_hash, created_at
sessions      → id (UUID), user_id, status, created_at
detections    → session_id, image_type (pre_op / post_op), class_name, count
crops         → session_id, filename, class_name, confidence, human_label, image_type
ocr_results   → session_id, equipment_name, ocr_count
final_results → session_id, equipment_name, yolo_count, ocr_count, corrected_count
```

---

## Project Structure

```
Job46_MedAi/
├── best.onnx                          ← YOLO model
├── start.bat                          ← One-click start (Windows)
├── TECHSTACK.md                       ← This file
├── .github/
│   └── workflows/deploy.yml           ← GitHub Actions CI/CD
│
├── backend/
│   ├── app.py                         ← Flask API server + Auth endpoints
│   ├── yolo_detector.py               ← ONNX inference + NMS + cropping
│   ├── gemini_ocr.py                  ← Gemini OCR integration
│   ├── database.py                    ← SQLite schema + query functions
│   ├── requirements.txt               ← Python dependencies
│   ├── .env.example                   ← Environment variable template
│   ├── medai.db                       ← SQLite DB (auto-created on first run)
│   ├── uploads/                       ← Uploaded images (temp)
│   └── crops/                         ← Low-confidence crop JPGs
│
└── med-match-checker-main/            ← React frontend (Vite + TypeScript)
    ├── src/
    │   ├── pages/
    │   │   ├── AuthPage.tsx           ← Login / Register
    │   │   ├── UploadPage.tsx         ← Upload pre-op, post-op, form
    │   │   ├── AnnotationPage.tsx     ← Label low-confidence crops
    │   │   └── VerificationDashboard.tsx ← Compare YOLO vs OCR counts
    │   ├── components/
    │   │   └── Header.tsx             ← Navigation bar + auth display
    │   ├── contexts/
    │   │   └── AuthContext.tsx        ← Global auth state (React Context)
    │   └── lib/
    │       └── api.ts                 ← Typed API client for backend calls
    ├── vite.config.ts
    └── package.json
```

---

## API Endpoints

| Method | Endpoint | รายละเอียด |
|---|---|---|
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/me` | ดึงข้อมูล user ปัจจุบัน |
| POST | `/api/detect` | รัน YOLO บน pre-op / post-op |
| POST | `/api/ocr` | รัน Gemini OCR บน form image |
| GET | `/api/crops?session_id=` | ดึงรายการ low-confidence crops |
| GET | `/api/crops/<filename>` | Serve crop image file |
| POST | `/api/label` | บันทึก human label สำหรับ crop |
| GET | `/api/session/<id>/summary` | ดึงตารางเปรียบเทียบ YOLO vs OCR |
| POST | `/api/final` | บันทึกผลสุดท้าย (human-corrected) |
| GET | `/api/history` | ดึงประวัติ sessions ของ user |

---

## How to Run

### Backend
```bash
cd backend
copy .env.example .env        # แก้ GEMINI_API_KEY ใน .env
pip install -r requirements.txt
python app.py                  # → http://localhost:5000
```

### Frontend
```bash
cd med-match-checker-main
npm install
npm run dev                    # → http://localhost:8080
```

### หรือใช้ One-click
```bash
start.bat
```
