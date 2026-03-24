import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, Upload, Tag, BarChart3, LogOut, LogIn, User, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/upload", label: "อัปโหลด", icon: Upload },
  { path: "/annotation", label: "Annotation", icon: Tag },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/history", label: "ประวัติ", icon: History },
];

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="bg-card border-b border-border medical-shadow sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate("/upload")}
          className="flex items-center space-x-2.5 shrink-0"
        >
          <div className="p-1.5 medical-gradient rounded-lg">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-none">MedAI Verifier</h1>
            <p className="text-xs text-muted-foreground">ระบบตรวจสอบอุปกรณ์ผ่าตัด</p>
          </div>
        </button>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150",
                  active
                    ? "medical-gradient text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground font-medium max-w-[100px] truncate">{user.username}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => logout()}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">ออกจากระบบ</span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="medical"
              onClick={() => navigate("/auth")}
              className="gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              <span className="text-xs">เข้าสู่ระบบ</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;