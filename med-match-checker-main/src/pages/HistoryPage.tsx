import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHistory } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { History, BarChart3, Clock, CheckCircle, AlertCircle, Loader2, Upload, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  user_id: number | null;
  created_at: string;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  completed:  { label: "เสร็จสมบูรณ์", color: "text-green-500 bg-green-100 dark:bg-green-950/30", icon: CheckCircle },
  detected:   { label: "ตรวจจับแล้ว",  color: "text-blue-500 bg-blue-100 dark:bg-blue-950/30",  icon: BarChart3 },
  ocr_done:   { label: "OCR แล้ว",      color: "text-purple-500 bg-purple-100 dark:bg-purple-950/30", icon: CheckCircle },
  processing: { label: "กำลังประมวลผล", color: "text-orange-500 bg-orange-100 dark:bg-orange-950/30", icon: Clock },
  pending:    { label: "รอดำเนินการ",   color: "text-gray-500 bg-gray-100 dark:bg-gray-800",   icon: Clock },
};

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr + "Z");
    return d.toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    getHistory()
      .then((res) => setSessions(res.sessions))
      .catch(() => toast({ title: "โหลดประวัติไม่สำเร็จ", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const handleView = (sessionId: string) => {
    sessionStorage.setItem("session_id", sessionId);
    navigate("/dashboard");
  };

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
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-medium mb-1">
              <History className="h-3.5 w-3.5" />
              Analysis History
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">ประวัติการวิเคราะห์</h2>
            <p className="text-sm text-muted-foreground mt-1">
              รายการการตรวจสอบอุปกรณ์ผ่าตัดทั้งหมดของคุณ
            </p>
          </div>
          <Button
            onClick={() => navigate("/upload")}
            variant="medical"
            className="gap-2 shrink-0"
          >
            <Upload className="h-4 w-4" />
            วิเคราะห์รอบใหม่
          </Button>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="medical-card p-12 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 rounded-full bg-muted">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground">ยังไม่มีประวัติ</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              เริ่มวิเคราะห์รูปภาพเพื่อสร้างประวัติการตรวจสอบ
            </p>
            <Button onClick={() => navigate("/upload")} variant="medical" className="gap-2">
              <Upload className="h-4 w-4" />
              เริ่มวิเคราะห์
            </Button>
          </div>
        )}

        {/* Session list */}
        {sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session, idx) => {
              const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={session.id}
                  className="medical-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/30 transition-colors cursor-pointer group"
                  onClick={() => handleView(session.id)}
                >
                  {/* Index + Status */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {sessions.length - idx}
                    </div>
                    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", cfg.color)}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground font-mono">
                      #{session.id.substring(0, 12)}...
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{formatDate(session.created_at)}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0 group-hover:border-primary group-hover:text-primary transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleView(session.id); }}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    ดูผล
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer summary */}
        {sessions.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            แสดง {sessions.length} รายการล่าสุด
          </p>
        )}
      </main>
    </div>
  );
}
