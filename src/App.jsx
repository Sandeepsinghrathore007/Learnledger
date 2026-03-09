import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import SubjectsPage from "@/pages/SubjectsPage";
import SubjectDetailPage from "@/pages/SubjectDetailPage";
import NotesPage from "@/pages/NotesPage";
import MockTestsPage from "@/pages/MockTestsPage";
import AIAssistantPage from "@/pages/AIAssistantPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ComingSoonPage from "@/pages/ComingSoonPage";
import SubjectFormModal from "@/components/subjects/SubjectFormModal";
import { useSubjects } from "@/hooks/useSubjects";
import { NAV_ITEMS } from "@/constants/navigation";
import { BG } from "@/constants/theme";
import { logoutUser, observeAuthState } from "@/services/firebase/authService";
import { uid } from "@/utils/id";

const MOBILE_BREAKPOINT = 1024;

function LoadingView({ message }) {
  return (
    <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
      <p
        style={{
          color: "#9f8fbf",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "14px",
          margin: 0,
        }}
      >
        {message}
      </p>
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

export default function App() {
  const [activePage, setActivePage] = useState("subjects");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false,
  );

  const [openNoteContext, setOpenNoteContext] = useState(null);
  const [assistantLaunchContext, setAssistantLaunchContext] = useState(null);

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
    const unsubscribe = observeAuthState((user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (user) {
        setActivePage((currentPage) =>
          currentPage === "login" || currentPage === "signup"
            ? "subjects"
            : currentPage,
        );
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
    if (activePage !== "notes" || !openNoteContext) return;

    const subject = subjects.find(
      (item) => item.id === openNoteContext.subjectId,
    );
    const topic = subject?.topics.find(
      (item) => item.id === openNoteContext.topicId,
    );
    const liveNote = topic?.notes.find(
      (item) => item.id === openNoteContext.note.id,
    );

    if (!subject || !liveNote) {
      setOpenNoteContext(null);
    }
  }, [activePage, openNoteContext, subjects]);

  const sidebarWidth = isMobile ? 0 : collapsed ? 68 : 228;

  const authPageTitles = {
    login: "Login",
    signup: "Sign Up",
  };

  const pageTitle =
    NAV_ITEMS.find((item) => item.id === activePage)?.label ??
    authPageTitles[activePage] ??
    "Dashboard";

  const handlePageChange = (page) => {
    setActivePage(page);
    if (page !== "subjects") setSelected(null);
    if (page !== "notes") setOpenNoteContext(null);
    if (isMobile) setMobileNavOpen(false);
  };

  const handleOpenNoteFromNotesPage = (note, subjectId, topicId) => {
    setOpenNoteContext({ note, subjectId, topicId });
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setSelected(null);
      setOpenNoteContext(null);
      setActivePage("subjects");
    } catch (logoutError) {
      console.error("Failed to logout:", logoutError);
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

  const renderPage = () => {
    if (authLoading) {
      return <LoadingView message="Checking your Firebase session..." />;
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
      return <LoadingView message="Syncing your subjects from Firestore..." />;
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
        />
      );
    }

    if (activePage === "notes") {
      if (openNoteContext) {
        const subject = subjects.find(
          (item) => item.id === openNoteContext.subjectId,
        );
        if (!subject) {
          return (
            <NotesPage
              subjects={subjects}
              onUpdateSubject={updateSubject}
              onOpenNote={handleOpenNoteFromNotesPage}
            />
          );
        }

        const topic = subject.topics.find(
          (item) => item.id === openNoteContext.topicId,
        );
        const liveNote = topic?.notes.find(
          (item) => item.id === openNoteContext.note.id,
        );

        if (!liveNote) {
          return (
            <NotesPage
              subjects={subjects}
              onUpdateSubject={updateSubject}
              onOpenNote={handleOpenNoteFromNotesPage}
            />
          );
        }

        return (
          <SubjectDetailPage
            subject={subject}
            onBack={() => setOpenNoteContext(null)}
            onUpdateSubject={updateSubject}
            user={authUser}
            onOpenAIContext={handleOpenAIWithContext}
            initialOpenNote={{
              note: liveNote,
              topicId: openNoteContext.topicId,
            }}
          />
        );
      }

      return (
        <NotesPage
          subjects={subjects}
          onUpdateSubject={updateSubject}
          onOpenNote={handleOpenNoteFromNotesPage}
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
            onBack={() => setSelected(null)}
            onUpdateSubject={updateSubject}
            user={authUser}
            onOpenAIContext={handleOpenAIWithContext}
          />
        );
      }

      return (
        <SubjectsPage
          subjects={subjects}
          onSelect={setSelected}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={deleteSubject}
        />
      );
    }

    return <ComingSoonPage pageId={activePage} />;
  };

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
        />

        <div className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-[30px] lg:py-[28px]">
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
