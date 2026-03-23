import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCrops, getCropUrl, saveLabel } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tag, CheckCircle, ArrowRight, Eye, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const EQUIPMENT_OPTIONS = [
  "Scalpel / มีดผ่าตัด",
  "Forceps / คีม",
  "Scissor / กรรไกร",
  "Retractor / ตะขอดึง",
  "Needle holder / ที่จับเข็ม",
  "Sponge / ฟองน้ำผ่าตัด",
  "Clamp / คลิป",
  "Suture / เส็นเย็บ",
  "Cautery / เครื่องจี้",
  "Trocar / โทรคาร์",
  "Other / อื่นๆ",
];

interface Crop {
  id: number;
  filename: string;
  class_name: string;
  confidence: number;
  human_label: string | null;
  image_type: string;
}

export default function AnnotationPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [customLabels, setCustomLabels] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const sessionId = sessionStorage.getItem("session_id") || "";

  useEffect(() => {
    if (!sessionId) { navigate("/upload"); return; }
    getCrops(sessionId)
      .then((res) => {
        setCrops(res.crops);
        const init: Record<number, string> = {};
        res.crops.forEach((c: Crop) => {
          if (c.human_label) init[c.id] = c.human_label;
        });
        setLabels(init);
      })
      .catch(() => toast({ title: "ไม่สามารถโหลด crops ได้", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const getEffectiveLabel = (cropId: number) => {
    const sel = labels[cropId];
    if (sel === "OTHER") return customLabels[cropId]?.trim() || "";
    return sel || "";
  };

  const handleSave = async (cropId: number) => {
    const label = getEffectiveLabel(cropId);
    if (!label) {
      toast({ title: "กรุณาเลือกหรือพิมพ์ประเภทอุปกรณ์", variant: "destructive" }); return;
    }
    setSaving({ ...saving, [cropId]: true });
    try {
      await saveLabel(cropId, label);  // label is already resolved to effective value
      setSaved({ ...saved, [cropId]: true });
      toast({ title: "บันทึกแล้ว", description: `ระบุว่า: ${label}` });
    } catch (err: any) {
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSaving({ ...saving, [cropId]: false });
    }
  };

  const savedCount = Object.keys(saved).length;
  const progress = crops.length > 0 ? (savedCount / crops.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-medium mb-1">
              <Eye className="h-3.5 w-3.5" />
              Human-in-the-Loop Annotation
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">ระบุประเภทอุปกรณ์</h2>
            <p className="text-sm text-muted-foreground mt-1">
              ภาพเหล่านี้คือที่ YOLO มีความมั่นใจต่ำกว่า 80% — กรุณาช่วยระบุประเภท
            </p>
          </div>
          <Button
            onClick={() => navigate("/dashboard")}
            variant="medical"
            className="gap-2 shrink-0"
          >
            ไปยัง Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        {crops.length > 0 && (
          <div className="medical-card p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-foreground">ความคืบหน้า</span>
              <span className="text-sm text-muted-foreground">{savedCount} / {crops.length}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="medical-gradient h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* No crops */}
        {crops.length === 0 && (
          <div className="medical-card p-12 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-950/30">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground">YOLO มั่นใจสูง</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-6">
              ไม่มีภาพที่ต้องการการตรวจสอบ — ทุก detection มีความมั่นใจ ≥ 80%
            </p>
            <Button onClick={() => navigate("/dashboard")} variant="medical" className="gap-2">
              ไปยัง Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Crop grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {crops.map((crop) => (
            <div
              key={crop.id}
              className={cn(
                "medical-card overflow-hidden transition-all duration-200",
                saved[crop.id] && "ring-2 ring-green-400"
              )}
            >
              {/* Image */}
              <div className="relative bg-muted h-44">
                <img
                  src={getCropUrl(crop.filename)}
                  alt={crop.class_name}
                  className="w-full h-full object-contain p-1"
                />
                {/* Confidence badge */}
                <div className={cn(
                  "absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium text-white",
                  crop.confidence < 0.5 ? "bg-red-500" : crop.confidence < 0.7 ? "bg-orange-500" : "bg-yellow-500"
                )}>
                  {(crop.confidence * 100).toFixed(0)}%
                </div>
                {/* Image type badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-black/50 text-white">
                  {crop.image_type === "pre_op" ? "Pre-op" : "Post-op"}
                </div>
                {/* Saved check */}
                {saved[crop.id] && (
                  <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-green-500 opacity-80" />
                  </div>
                )}
              </div>

              {/* Info + label */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    YOLO คาดว่าคือ: <span className="font-medium text-foreground">{crop.class_name}</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> ระบุประเภท
                  </label>
                  <select
                    value={labels[crop.id] || ""}
                    onChange={(e) => setLabels({ ...labels, [crop.id]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- เลือกประเภท --</option>
                    {EQUIPMENT_OPTIONS.filter(o => o !== "Other / อื่นๆ").map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="OTHER">Other / อื่นๆ...</option>
                  </select>
                  {labels[crop.id] === "OTHER" && (
                    <input
                      type="text"
                      placeholder="พิมพ์ชื่ออุปกรณ์..."
                      value={customLabels[crop.id] || ""}
                      onChange={(e) => setCustomLabels({ ...customLabels, [crop.id]: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-primary bg-primary/5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                  )}
                </div>

                <Button
                  onClick={() => handleSave(crop.id)}
                  disabled={saving[crop.id] || !getEffectiveLabel(crop.id)}
                  size="sm"
                  variant={saved[crop.id] ? "outline" : "medical"}
                  className="w-full gap-1.5"
                >
                  {saving[crop.id] ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> บันทึก...</>
                  ) : saved[crop.id] ? (
                    <><CheckCircle className="h-3.5 w-3.5 text-green-500" /> บันทึกแล้ว</>
                  ) : (
                    <>บันทึก Label</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
