import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSessionSummary, saveFinalResults } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle, XCircle, AlertCircle, Save, RotateCcw,
  BarChart3, Loader2, ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonRow {
  equipment_name: string;
  yolo_count: number;
  ocr_count: number;
  match: boolean;
  corrected_count?: number;
}

export default function VerificationDashboard() {
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const sessionId = sessionStorage.getItem("session_id") || "";

  useEffect(() => {
    if (!sessionId) { navigate("/upload"); return; }
    getSessionSummary(sessionId)
      .then((res) => setRows(res.comparison))
      .catch(() => toast({ title: "โหลดข้อมูลไม่สำเร็จ", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const getCorrected = (row: ComparisonRow): number => {
    if (edited[row.equipment_name] !== undefined) {
      const parsed = parseInt(edited[row.equipment_name], 10);
      return isNaN(parsed) ? (row.corrected_count ?? row.yolo_count) : parsed;
    }
    return row.corrected_count ?? row.yolo_count;
  };

  const handleEdit = (name: string, val: string) => {
    // Allow empty string and valid non-negative numbers while typing
    if (val === "" || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0)) {
      setEdited({ ...edited, [name]: val });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const results = rows.map((r) => ({
        equipment_name: r.equipment_name,
        yolo_count: r.yolo_count,
        ocr_count: r.ocr_count,
        corrected_count: getCorrected(r),
      }));
      await saveFinalResults(sessionId, results);
      setSaved(true);
      toast({ title: "บันทึกผลสำเร็จ", description: "ผลการตรวจสอบถูกบันทึกแล้ว" });
    } catch (err: any) {
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const matchCount = rows.filter((r) => r.match).length;
  const mismatchCount = rows.length - matchCount;

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-medium mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Human Verification Dashboard
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">เปรียบเทียบผลการตรวจสอบ</h2>
            <p className="text-sm text-muted-foreground mt-1">
              เปรียบเทียบจำนวนที่ YOLO ตรวจจับได้กับที่ OCR อ่านได้จากแบบฟอร์ม
            </p>
          </div>
          <Button
            onClick={() => { sessionStorage.clear(); navigate("/upload"); }}
            variant="outline"
            className="gap-2 shrink-0"
          >
            <RotateCcw className="h-4 w-4" /> เริ่มใหม่
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="medical-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{rows.length}</p>
            <p className="text-xs text-muted-foreground mt-1">รายการทั้งหมด</p>
          </div>
          <div className="medical-card p-4 text-center border-green-200 dark:border-green-800">
            <p className="text-2xl font-bold text-green-500">{matchCount}</p>
            <p className="text-xs text-muted-foreground mt-1">ตรงกัน</p>
          </div>
          <div className="medical-card p-4 text-center border-red-200 dark:border-red-800">
            <p className="text-2xl font-bold text-red-500">{mismatchCount}</p>
            <p className="text-xs text-muted-foreground mt-1">ไม่ตรงกัน</p>
          </div>
        </div>

        {/* No data */}
        {rows.length === 0 && (
          <div className="medical-card p-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">ไม่พบข้อมูลการวิเคราะห์</p>
            <p className="text-sm text-muted-foreground mb-4">กลับไปอัปโหลดภาพก่อน</p>
            <Button onClick={() => navigate("/upload")} variant="medical">ไปหน้าอัปโหลด</Button>
          </div>
        )}

        {/* Comparison table */}
        {rows.length > 0 && (
          <div className="medical-card overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">อุปกรณ์</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-blue-500 uppercase tracking-wider">YOLO</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-green-500 uppercase tracking-wider">OCR (แบบฟอร์ม)</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">สถานะ</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-primary uppercase tracking-wider">แก้ไข</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const corrected = getCorrected(row);
                    const isEdited = edited[row.equipment_name] !== undefined;
                    return (
                      <tr
                        key={row.equipment_name}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          !row.match && "bg-red-50/50 dark:bg-red-950/10"
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{row.equipment_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-bold text-sm">
                            {row.yolo_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-bold text-sm">
                            {row.ocr_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.match ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-medium">
                              <CheckCircle className="h-3 w-3" /> ตรงกัน
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs font-medium">
                              <XCircle className="h-3 w-3" /> ไม่ตรงกัน
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={edited[row.equipment_name] !== undefined ? edited[row.equipment_name] : corrected}
                            onChange={(e) => handleEdit(row.equipment_name, e.target.value)}
                            className={cn(
                              "w-16 text-center px-2 py-1 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all",
                              isEdited
                                ? "border-primary bg-primary/5 font-semibold text-primary"
                                : "border-input bg-background text-foreground"
                            )}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        {mismatchCount > 0 && (
          <div className="medical-card p-4 mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-medium">พบ {mismatchCount} รายการที่จำนวนไม่ตรงกัน</p>
                <p>กรุณาตรวจสอบและแก้ไขจำนวนในคอลัมน์ "แก้ไข" ให้ถูกต้อง ก่อนกด "บันทึกผลสุดท้าย"</p>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {Object.keys(edited).length > 0 && (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-primary" />
                  แก้ไข {Object.keys(edited).length} รายการ
                </>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              variant="medical"
              size="lg"
              className="gap-2 px-8"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...</>
              ) : saved ? (
                <><ClipboardCheck className="h-4 w-4" /> บันทึกแล้ว</>
              ) : (
                <><Save className="h-4 w-4" /> บันทึกผลสุดท้าย</>
              )}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
