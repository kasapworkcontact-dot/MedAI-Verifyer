import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { runDetect, runOCR } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { Upload, Image, FileText, X, CheckCircle, Activity, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileSlot {
  file: File | null;
  preview: string | null;
}

const EMPTY_SLOT: FileSlot = { file: null, preview: null };

function DropZone({
  label,
  sublabel,
  icon: Icon,
  value,
  onChange,
  accept = "image/*",
  accentColor = "text-primary",
}: {
  label: string;
  sublabel: string;
  icon: React.ComponentType<any>;
  value: FileSlot;
  onChange: (slot: FileSlot) => void;
  accept?: string;
  accentColor?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    onChange({ file, preview });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md bg-primary/10`}>
          <Icon className={`h-4 w-4 ${accentColor}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
      </div>

      {value.file ? (
        <div className="relative rounded-xl border border-border overflow-hidden bg-muted/30 group">
          {value.preview ? (
            <img src={value.preview} alt="preview" className="w-full h-40 object-cover" />
          ) : (
            <div className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{value.file.name}</p>
                <p className="text-xs text-muted-foreground">{(value.file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChange(EMPTY_SLOT)}
              className="gap-1"
            >
              <X className="h-3 w-3" /> ลบ
            </Button>
          </div>
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-0.5">
            <CheckCircle className="h-3 w-3" />
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          className={cn(
            "upload-zone h-40 flex flex-col items-center justify-center gap-3 cursor-pointer",
            drag && "drag-over"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          <div className="p-3 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              วาง หรือ <span className="text-primary underline">เลือกไฟล์</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG สูงสุด 10MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [preOp, setPreOp] = useState<FileSlot>(EMPTY_SLOT);
  const [postOp, setPostOp] = useState<FileSlot>(EMPTY_SLOT);
  const [formImg, setFormImg] = useState<FileSlot>(EMPTY_SLOT);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const canRun = preOp.file || postOp.file;

  const handleRun = async () => {
    if (!canRun) return;
    setLoading(true);

    try {
      const detectFd = new FormData();
      const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
      const sessionId = generateId();
      detectFd.append("session_id", sessionId);
      if (preOp.file) detectFd.append("pre_op", preOp.file);
      if (postOp.file) detectFd.append("post_op", postOp.file);

      setLoadingStep("กำลังตรวจจับอุปกรณ์ด้วย YOLO...");
      const detectRes = await runDetect(detectFd);

      if (formImg.file) {
        setLoadingStep("กำลังอ่านแบบฟอร์มด้วย Gemini OCR...");
        const ocrFd = new FormData();
        ocrFd.append("session_id", sessionId);
        ocrFd.append("form_image", formImg.file);
        await runOCR(ocrFd);
      }

      sessionStorage.setItem("session_id", sessionId);
      sessionStorage.setItem("has_crops", String(detectRes.has_crops));

      toast({ title: "วิเคราะห์สำเร็จ", description: "YOLO ตรวจจับอุปกรณ์เรียบร้อยแล้ว" });

      if (detectRes.has_crops) {
        navigate("/annotation");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-primary text-xs font-medium mb-2">
            <Activity className="h-3.5 w-3.5" />
            Surgical Equipment Verification
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">อัปโหลดภาพเพื่อตรวจสอบ</h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            อัปโหลดภาพอุปกรณ์ก่อน/หลังผ่าตัด และภาพแบบฟอร์ม เพื่อให้ AI วิเคราะห์และเปรียบเทียบ
          </p>
        </div>

        {/* Upload grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Pre-op */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <h3 className="font-semibold text-foreground text-sm">ก่อนผ่าตัด</h3>
              <span className="ml-auto text-xs text-muted-foreground">Pre-op</span>
            </div>
            <DropZone
              label="ภาพอุปกรณ์ก่อนผ่าตัด"
              sublabel="ภาพถ่ายชุดอุปกรณ์ก่อนเริ่มการผ่าตัด"
              icon={Image}
              value={preOp}
              onChange={setPreOp}
            />
          </div>

          {/* Post-op */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <h3 className="font-semibold text-foreground text-sm">หลังผ่าตัด</h3>
              <span className="ml-auto text-xs text-muted-foreground">Post-op</span>
            </div>
            <DropZone
              label="ภาพอุปกรณ์หลังผ่าตัด"
              sublabel="ภาพถ่ายชุดอุปกรณ์หลังเสร็จสิ้นการผ่าตัด"
              icon={Image}
              value={postOp}
              onChange={setPostOp}
              accentColor="text-orange-500"
            />
          </div>

          {/* Form */}
          <div className="medical-card p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <h3 className="font-semibold text-foreground text-sm">แบบฟอร์ม</h3>
              <span className="ml-auto text-xs text-muted-foreground">Checklist</span>
            </div>
            <DropZone
              label="แบบฟอร์มบันทึกการผ่าตัด"
              sublabel="ภาพถ่ายใบตรวจนับอุปกรณ์ (อ่านด้วย Gemini OCR)"
              icon={FileText}
              value={formImg}
              onChange={setFormImg}
              accentColor="text-green-500"
            />
          </div>
        </div>

        {/* Info notice */}
        {!formImg.file && (
          <div className="medical-card p-4 mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                หากไม่อัปโหลดแบบฟอร์ม ระบบจะข้ามขั้นตอน OCR และแสดงเฉพาะผลการตรวจจับจาก YOLO
              </p>
            </div>
          </div>
        )}

        {/* Run button */}
        <div className="flex justify-center">
          <Button
            onClick={handleRun}
            disabled={!canRun || loading}
            variant="medical"
            size="lg"
            className="px-10 gap-2 text-base h-12"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {loadingStep || "กำลังวิเคราะห์..."}
              </>
            ) : (
              <>
                <Activity className="h-5 w-5" />
                เริ่มวิเคราะห์
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Steps indicator */}
        <div className="mt-10 grid grid-cols-3 gap-4">
          {[
            { step: "1", title: "อัปโหลดภาพ", desc: "Pre-op, Post-op, แบบฟอร์ม", active: true },
            { step: "2", title: "ระบุอุปกรณ์", desc: "ตรวจสอบ Low-confidence crops", active: false },
            { step: "3", title: "Dashboard", desc: "เปรียบเทียบ YOLO vs OCR", active: false },
          ].map((s) => (
            <div key={s.step} className={cn("medical-card p-4 text-center", s.active && "border-primary/50")}>
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2",
                s.active ? "medical-gradient text-white" : "bg-muted text-muted-foreground"
              )}>
                {s.step}
              </div>
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
