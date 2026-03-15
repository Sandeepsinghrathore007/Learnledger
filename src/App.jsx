import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import SubjectsPage from "@/pages/SubjectsPage";
import NotesPage from "@/pages/NotesPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SubjectDetailPage from "@/pages/SubjectDetailPage";
import MockTestsPage from "@/pages/MockTestsPage";
import AIAssistantPage from "@/pages/AIAssistantPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ComingSoonPage from "@/pages/ComingSoonPage";
import SubjectFormModal from "@/components/subjects/SubjectFormModal";
import { useSubjects } from "@/hooks/useSubjects";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import { NAV_ITEMS } from "@/constants/navigation";
import { BG, BORDER, SURFACE } from "@/constants/theme";
import {
  firebaseConfigError,
  isFirebaseConfigured,
  missingKeys,
} from "@/services/firebase/firebaseConfig";
import { logoutUser, observeAuthState } from "@/services/firebase/authService";
import { uid } from "@/utils/id";

const MOBILE_BREAKPOINT = 1024;
const AI_CHAT_STORAGE_KEY = "aiChat";

function createDefaultAIChatState() {
  return {
    messages: [],
    selectedSubjectId: null,
    extraContext: "",
    language: "english",
  };
}

function readStoredAIChatState() {
  if (typeof window === "undefined") return createDefaultAIChatState();

  try {
    const rawValue = window.sessionStorage.getItem(AI_CHAT_STORAGE_KEY);
    if (!rawValue) return createDefaultAIChatState();

    const parsed = JSON.parse(rawValue);
    return {
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      selectedSubjectId:
        typeof parsed?.selectedSubjectId === "string" && parsed.selectedSubjectId
          ? parsed.selectedSubjectId
          : null,
      extraContext:
        typeof parsed?.extraContext === "string" ? parsed.extraContext : "",
      language: parsed?.language === "hindi" ? "hindi" : "english",
    };
  } catch {
    return createDefaultAIChatState();
  }
}

function LoadingSubjectCard({ index }) {
  return (
    <div
      style={{
        padding: "22px",
        borderRadius: "18px",
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        boxShadow: "0 2px 8px rgba(0,0,0,0.32)",
        animation: `fadeUp 0.3s ease ${index * 0.05}s both`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="subject-skeleton-shimmer"
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "14px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="subject-skeleton-shimmer"
            style={{ height: "14px", width: "62%", borderRadius: "999px", marginBottom: "8px" }}
          />
          <div
            className="subject-skeleton-shimmer"
            style={{ height: "11px", width: "44%", borderRadius: "999px" }}
          />
        </div>
      </div>

      <div style={{ marginTop: "18px" }}>
        <div
          className="subject-skeleton-shimmer"
          style={{ height: "11px", width: "100%", borderRadius: "999px", marginBottom: "8px" }}
        />
        <div
          className="subject-skeleton-shimmer"
          style={{ height: "11px", width: "78%", borderRadius: "999px" }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2" style={{ marginTop: "16px" }}>
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            style={{
              borderRadius: "9px",
              padding: "8px",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              className="subject-skeleton-shimmer"
              style={{ height: "15px", width: item % 2 === 0 ? "42%" : "58%", borderRadius: "999px", marginBottom: "7px" }}
            />
            <div
              className="subject-skeleton-shimmer"
              style={{ height: "10px", width: item % 2 === 0 ? "54%" : "66%", borderRadius: "999px" }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: `1px solid ${BORDER}`,
          marginTop: "14px",
          paddingTop: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          className="subject-skeleton-shimmer"
          style={{ height: "10px", width: "28%", borderRadius: "999px" }}
        />
        <div
          className="subject-skeleton-shimmer"
          style={{ height: "24px", width: "34%", borderRadius: "999px" }}
        />
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="min-h-[calc(100vh-180px)]">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(264px,1fr))",
          gap: "15px",
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <LoadingSubjectCard key={index} index={index} />
        ))}
      </div>
    </div>
  );
}

function GuestAIBlockedView({ onOpenLogin }) {
  return (
    <div className="animate-fade-in flex min-h-[calc(100vh-180px)] items-center justify-center">
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: "14px",
          background: "rgba(139,92,246,0.08)",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: "0 0 8px",
            color: "#ede6ff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "20px",
            fontWeight: "700",
          }}
        >
          AI Assistant
        </h2>
        <p
          style={{
            margin: "0 0 16px",
            color: "#c8b9ef",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
          }}
        >
          Please login to use the AI assistant.
        </p>
        <button
          type="button"
          onClick={onOpenLogin}
          style={{
            border: "none",
            borderRadius: "10px",
            padding: "10px 16px",
            background: "linear-gradient(135deg,#8b5cf6,#7c3aed)",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
}

function FirebaseSetupView() {
  const isGitHubPages =
    typeof window !== "undefined" &&
    window.location.hostname.endsWith("github.io");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "16px",
          background: "rgba(20,12,40,0.92)",
          padding: "22px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px",
            color: "#f5edff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "24px",
            fontWeight: "800",
          }}
        >
          Firebase setup is incomplete
        </h1>
        <p
          style={{
            margin: "0 0 14px",
            color: "#d1c4ef",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            lineHeight: 1.7,
          }}
        >
          {firebaseConfigError}
        </p>
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid rgba(139,92,246,0.24)",
            background: "rgba(139,92,246,0.08)",
            padding: "14px",
            color: "#efe7ff",
            fontFamily: "'Fira Code', monospace",
            fontSize: "12px",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {`Missing keys: ${missingKeys.join(", ")}

Required build variables:
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID

Optional but recommended:
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_FUNCTIONS_REGION`}
        </div>
        <p
          style={{
            margin: "14px 0 0",
            color: "#bba8e4",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          {isGitHubPages
            ? "For GitHub Pages, add these values in GitHub repository Settings -> Secrets and variables -> Actions, then rerun the Deploy to GitHub Pages workflow on main."
            : "For local development, add these values to your .env file and restart the Vite dev server."}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("subjects");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false,
  );
  const [assistantLaunchContext, setAssistantLaunchContext] = useState(null);
  const [aiChatState, setAiChatState] = useState(() => readStoredAIChatState());
  const [subjectNoteLaunch, setSubjectNoteLaunch] = useState(null);
  const [subjectSectionLaunch, setSubjectSectionLaunch] = useState(null);

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [installPending, setInstallPending] = useState(false);
  const [installNotice, setInstallNotice] = useState("");
  const { canInstall, installApp, lastOutcome } = usePWAInstallPrompt();

  const {
    subjects,
    selected,
    form,
    isAddOpen,
    editTarget,
    loading,
    error,
    setSelected,
    setFormField,
    setIsAddOpen,
    setEditTarget,
    openAdd,
    openEdit,
    addSubject,
    editSubject,
    deleteSubject,
    updateSubject,
  } = useSubjects(authUser);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }

    const unsubscribe = observeAuthState((user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (user) {
        setActivePage((currentPage) =>
          currentPage === "login" || currentPage === "signup"
            ? "subjects"
            : currentPage,
        );
      } else {
        setAiChatState(createDefaultAIChatState());
        setAssistantLaunchContext(null);
        setSubjectNoteLaunch(null);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(AI_CHAT_STORAGE_KEY);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!installNotice) return undefined;

    const timeoutId = window.setTimeout(() => {
      setInstallNotice("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [installNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(
      AI_CHAT_STORAGE_KEY,
      JSON.stringify(aiChatState),
    );
  }, [aiChatState]);

  const sidebarWidth = isMobile ? 0 : collapsed ? 68 : 228;

  const authPageTitles = {
    login: "Login",
    signup: "Sign Up",
    notes: "Notes",
  };

  const pageTitle =
    NAV_ITEMS.find((item) => item.id === activePage)?.label ??
    authPageTitles[activePage] ??
    "Dashboard";

  const handlePageChange = (page) => {
    setActivePage(page);
    if (page !== "subjects") setSelected(null);
    if (page !== "subjects") setSubjectNoteLaunch(null);
    if (page !== "subjects") setSubjectSectionLaunch(null);
    if (isMobile) setMobileNavOpen(false);
  };

  const handleSelectSubject = (subject) => {
    setSubjectSectionLaunch(null);
    setSubjectNoteLaunch(null);
    setSelected(subject);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setSelected(null);
      setSubjectNoteLaunch(null);
      setSubjectSectionLaunch(null);
      setActivePage("subjects");
      setAiChatState(createDefaultAIChatState());
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(AI_CHAT_STORAGE_KEY);
      }
    } catch (logoutError) {
      console.error("Failed to logout:", logoutError);
    }
  };

  const handleInstallApp = async () => {
    if (installPending) return;

    setInstallPending(true);

    try {
      const result = await installApp();

      if (result.outcome === "accepted") {
        setInstallNotice("Install prompt accepted.");
      } else if (result.outcome === "dismissed") {
        setInstallNotice("Install prompt dismissed.");
      } else if (result.outcome === "unavailable") {
        setInstallNotice("Install is not available on this browser yet.");
      }
    } catch (error) {
      console.error("Failed to trigger install prompt:", error);
      setInstallNotice("Failed to open install prompt.");
    } finally {
      setInstallPending(false);
    }
  };

  const handleOpenAIWithContext = (context) => {
    setAssistantLaunchContext({
      ...context,
      launchId: uid(),
    });
    setActivePage("ai");
    if (isMobile) setMobileNavOpen(false);
  };

  const handleOpenSubjectFromAnalytics = (subject, options = {}) => {
    if (!subject) return;

    setSubjectNoteLaunch(null);
    setSubjectSectionLaunch({
      subjectId: subject.id,
      section: options.section === "materials" ? "materials" : "topics",
      launchId: uid(),
    });
    setSelected(subject);
    setActivePage("subjects");
    if (isMobile) setMobileNavOpen(false);
  };

  const handleOpenNoteFromNotes = (note, subjectId, topicId) => {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject || !note) return;

    setSubjectNoteLaunch({
      note,
      topicId,
      subjectId,
      launchId: uid(),
    });
    setSubjectSectionLaunch(null);
    setSelected(subject);
    setActivePage("subjects");

    if (isMobile) setMobileNavOpen(false);
  };

  const handleOpenSavedAINote = () => {
    setSubjectNoteLaunch(null);
    setActivePage("notes");

    if (isMobile) setMobileNavOpen(false);
  };

  const renderPage = () => {
    if (authLoading) {
      return <LoadingView />;
    }

    if (activePage === "login") {
      return (
        <LoginPage
          onSwitchToSignup={() => handlePageChange("signup")}
          onLoginSuccess={() => handlePageChange("subjects")}
        />
      );
    }

    if (activePage === "signup") {
      return (
        <SignupPage
          onSwitchToLogin={() => handlePageChange("login")}
          onSignupSuccess={() => handlePageChange("subjects")}
        />
      );
    }

    if (loading && authUser && subjects.length === 0) {
      return <LoadingView />;
    }

    if (activePage === "questions") {
      return (
        <MockTestsPage
          user={authUser}
          subjects={subjects}
          onUpdateSubject={updateSubject}
        />
      );
    }

    if (activePage === "analytics") {
      return (
        <AnalyticsPage
          user={authUser}
          subjects={subjects}
          onOpenSubject={handleOpenSubjectFromAnalytics}
          onOpenAIContext={handleOpenAIWithContext}
        />
      );
    }

    if (activePage === "notes") {
      return (
        <NotesPage
          subjects={subjects}
          onUpdateSubject={updateSubject}
          onOpenNote={handleOpenNoteFromNotes}
        />
      );
    }

    if (activePage === "ai") {
      if (!authUser) {
        return (
          <GuestAIBlockedView onOpenLogin={() => handlePageChange("login")} />
        );
      }

      return (
        <AIAssistantPage
          user={authUser}
          subjects={subjects}
          onUpdateSubject={updateSubject}
          initialContext={assistantLaunchContext}
          aiChatState={aiChatState}
          onAiChatStateChange={setAiChatState}
          onOpenSavedNote={handleOpenSavedAINote}
        />
      );
    }

    if (activePage === "subjects") {
      if (selected) {
        const liveSubject =
          subjects.find((item) => item.id === selected.id) || selected;

        return (
          <SubjectDetailPage
            subject={liveSubject}
            initialOpenNote={
              subjectNoteLaunch?.subjectId === liveSubject.id
                ? {
                    note: subjectNoteLaunch.note,
                    topicId: subjectNoteLaunch.topicId,
                  }
                : null
            }
            initialSection={
              subjectSectionLaunch?.subjectId === liveSubject.id
                ? subjectSectionLaunch.section
                : "topics"
            }
            sectionLaunchKey={
              subjectSectionLaunch?.subjectId === liveSubject.id
                ? subjectSectionLaunch.launchId
                : null
            }
            onBack={() => {
              setSelected(null);
              setSubjectNoteLaunch(null);
              setSubjectSectionLaunch(null);
            }}
            onUpdateSubject={updateSubject}
            user={authUser}
            onOpenAIContext={handleOpenAIWithContext}
          />
        );
      }

      return (
        <SubjectsPage
          subjects={subjects}
          onSelect={handleSelectSubject}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={deleteSubject}
        />
      );
    }

    return <ComingSoonPage pageId={activePage} />;
  };

  if (!isFirebaseConfigured) {
    return <FirebaseSetupView />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: BG }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
        activePage={activePage}
        setActivePage={handlePageChange}
        onOpenLogin={() => handlePageChange("login")}
        onOpenSignup={() => handlePageChange("signup")}
        onLogout={handleLogout}
        user={authUser}
      />

      {isMobile && mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main
        style={{
          marginLeft: `${sidebarWidth}px`,
          transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)",
          flex: 1,
          minHeight: "100vh",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar
          pageTitle={pageTitle}
          showMenuButton={isMobile}
          onMenuClick={() => setMobileNavOpen((value) => !value)}
          canInstall={canInstall}
          onInstallClick={handleInstallApp}
          isInstallPending={installPending}
        />

        <div className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-[30px] lg:py-[28px]">
          {installNotice && (
            <div
              style={{
                border: "1px solid rgba(139,92,246,0.28)",
                background:
                  lastOutcome === "dismissed"
                    ? "rgba(245,158,11,0.08)"
                    : "rgba(139,92,246,0.08)",
                borderRadius: "10px",
                color: lastOutcome === "dismissed" ? "#fcd34d" : "#d7c8ff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                padding: "9px 10px",
                marginBottom: "12px",
              }}
            >
              {installNotice}
            </div>
          )}

          {authUser && error && (
            <div
              style={{
                border: "1px solid rgba(239,68,68,0.35)",
                background: "rgba(239,68,68,0.08)",
                borderRadius: "10px",
                color: "#fca5a5",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                padding: "9px 10px",
                marginBottom: "12px",
              }}
            >
              Sync error: {error}
            </div>
          )}

          {renderPage()}
        </div>
      </main>

      <SubjectFormModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        form={form}
        setFormField={setFormField}
        onSubmit={addSubject}
        isEdit={false}
      />

      <SubjectFormModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        form={form}
        setFormField={setFormField}
        onSubmit={editSubject}
        isEdit
      />
    </div>
  );
}
