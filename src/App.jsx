import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import SubjectFormModal from "@/components/subjects/SubjectFormModal";
import { useRuntimePerformanceMode } from "@/hooks/useRuntimePerformanceMode";
import { useSubjects } from "@/hooks/useSubjects";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import { NAV_ITEMS } from "@/constants/navigation";
import {
  APP_THEME_OPTIONS,
  BG,
  BORDER,
  SURFACE,
  THEME_STORAGE_KEY,
  applyAppTheme,
  readStoredAppThemeId,
} from "@/constants/theme";
import {
  firebaseConfigError,
  isFirebaseConfigured,
  missingKeys,
} from "@/services/firebase/firebaseConfig";
import { logoutUser, observeAuthState } from "@/services/firebase/authService";
import { uid } from "@/utils/id";

const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
const DEFAULT_PAGE = "subjects";
const APP_TOPBAR_HEIGHT = 58;
const PAGE_HASHES = {
  subjects: "#/subjects",
  questions: "#/questions",
  exams: "#/exams",
  questionBank: "#/question-bank",
  analytics: "#/analytics",
  notes: "#/notes",
  login: "#/login",
  signup: "#/signup",
};
const PAGE_IDS = Object.keys(PAGE_HASHES);

const SubjectsPage = lazy(() => import("@/pages/SubjectsPage"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const SubjectDetailPage = lazy(() => import("@/pages/SubjectDetailPage"));
const MockTestsPage = lazy(() => import("@/pages/MockTestsPage"));
const ExamsPage = lazy(() => import("@/pages/ExamsPage"));
const QuestionBankPage = lazy(() => import("@/pages/QuestionBankPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ComingSoonPage = lazy(() => import("@/pages/ComingSoonPage"));

function normalizePageHash(hashValue = "") {
  const hash = String(hashValue || "").trim().replace(/^#/, "");

  if (!hash || hash === "/") return "/subjects";

  return hash.startsWith("/") ? hash : `/${hash}`;
}

function getPageHash(page) {
  return PAGE_HASHES[page] || PAGE_HASHES[DEFAULT_PAGE];
}

function readPageFromLocation() {
  if (typeof window === "undefined") return DEFAULT_PAGE;

  const normalizedHash = normalizePageHash(window.location.hash);
  const matchedPage = Object.entries(PAGE_HASHES).find(
    ([, hash]) => normalizePageHash(hash) === normalizedHash,
  );

  return matchedPage?.[0] || DEFAULT_PAGE;
}

function syncPageHash(page, { replace = false } = {}) {
  if (typeof window === "undefined") return;

  const nextHash = getPageHash(page);
  if (window.location.hash === nextHash) return;

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;

  if (replace) {
    window.history.replaceState(null, "", nextUrl);
    return;
  }

  window.location.hash = nextHash;
}

function PersistentPage({ active, mounted, children }) {
  if (!mounted && !active) return null;

  return (
    <div
      hidden={!active}
      aria-hidden={!active}
      style={{
        display: active ? "block" : "none",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
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

function RouteFallback() {
  return <LoadingView />;
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
  const initialPage = readPageFromLocation();
  const [activePage, setActivePage] = useState(initialPage);
  const [mountedPages, setMountedPages] = useState(() => ({
    [initialPage]: true,
  }));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_MEDIA_QUERY).matches
      : false,
  );
  const [themeId, setThemeId] = useState(() => readStoredAppThemeId());
  const [subjectNoteLaunch, setSubjectNoteLaunch] = useState(null);
  const [subjectSectionLaunch, setSubjectSectionLaunch] = useState(null);
  const [mockTestLaunch, setMockTestLaunch] = useState(null);
  const [examLaunch, setExamLaunch] = useState(null);
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);

  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [installPending, setInstallPending] = useState(false);
  const [installNotice, setInstallNotice] = useState("");
  const { canInstall, installApp, lastOutcome } = usePWAInstallPrompt();
  const performanceMode = useRuntimePerformanceMode({
    mobile: isMobile,
    applyDocumentAttribute: true,
  });
  const contentScrollRef = useRef(null);
  const navigationScopeKey = authUser?.uid || "guest";
  const previousNavigationScopeRef = useRef(navigationScopeKey);

  const handlePageChange = useCallback((page, options = {}) => {
    const nextPage = PAGE_HASHES[page] ? page : DEFAULT_PAGE;

    setActivePage(nextPage);

    if (options.syncLocation !== false) {
      syncPageHash(nextPage, { replace: options.replaceHistory === true });
    }

    if (options.closeMobileNav !== false && isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

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
    if (typeof window === "undefined") return undefined;

    const syncActivePageFromHash = () => {
      setActivePage(readPageFromLocation());
      setMobileNavOpen(false);
    };

    const currentPage = readPageFromLocation();
    if (window.location.hash !== getPageHash(currentPage)) {
      syncPageHash(currentPage, { replace: true });
    }

    window.addEventListener("hashchange", syncActivePageFromHash);

    return () => window.removeEventListener("hashchange", syncActivePageFromHash);
  }, []);

  useEffect(() => {
    if (previousNavigationScopeRef.current === navigationScopeKey) return;

    previousNavigationScopeRef.current = navigationScopeKey;
    setMountedPages({ [activePage]: true });
  }, [activePage, navigationScopeKey]);

  useEffect(() => {
    setMountedPages((currentPages) =>
      currentPages[activePage]
        ? currentPages
        : { ...currentPages, [activePage]: true },
    );
  }, [activePage]);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activePage]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }

    const unsubscribe = observeAuthState((user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (!user) {
        setSubjectNoteLaunch(null);
        setMockTestLaunch(null);
        setExamLaunch(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    if (activePage !== "login" && activePage !== "signup") return;

    setActivePage(DEFAULT_PAGE);
    syncPageHash(DEFAULT_PAGE, { replace: true });
  }, [activePage, authUser]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncIsMobile = (event) => {
      setIsMobile(event.matches);
    };

    syncIsMobile(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsMobile);
      return () => mediaQuery.removeEventListener("change", syncIsMobile);
    }

    mediaQuery.addListener(syncIsMobile);
    return () => mediaQuery.removeListener(syncIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    applyAppTheme(themeId);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    }
  }, [themeId]);

  useEffect(() => {
    if (!installNotice) return undefined;

    const timeoutId = window.setTimeout(() => {
      setInstallNotice("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [installNotice]);

  const sidebarWidth = isMobile ? 0 : collapsed ? 68 : 228;
  const isImmersiveNoteEditor = activePage === "subjects" && noteEditorVisible;
  const showAppTopBar = !isImmersiveNoteEditor;

  const authPageTitles = {
    login: "Login",
    signup: "Sign Up",
    notes: "Notes",
  };

  const pageTitle = useMemo(
    () =>
      NAV_ITEMS.find((item) => item.id === activePage)?.label ??
      authPageTitles[activePage] ??
      "Dashboard",
    [activePage],
  );

  const handleSelectSubject = useCallback((subject) => {
    setSubjectSectionLaunch(null);
    setSubjectNoteLaunch(null);
    setSelected(subject);
  }, [setSelected]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
      setSelected(null);
      setSubjectNoteLaunch(null);
      setSubjectSectionLaunch(null);
      setMockTestLaunch(null);
      setExamLaunch(null);
      handlePageChange(DEFAULT_PAGE, { replaceHistory: true });
    } catch (logoutError) {
      console.error("Failed to logout:", logoutError);
    }
  }, [handlePageChange, setSelected]);

  const handleInstallApp = useCallback(async () => {
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
  }, [installApp, installPending]);

  const handleOpenSubjectFromAnalytics = useCallback((subject, options = {}) => {
    if (!subject) return;

    setSubjectNoteLaunch(null);
    setSubjectSectionLaunch({
      subjectId: subject.id,
      section: options.section === "materials" ? "materials" : "topics",
      launchId: uid(),
    });
    setSelected(subject);
    handlePageChange("subjects");
  }, [handlePageChange, setSelected]);

  const handleOpenNoteFromNotes = useCallback((note, subjectId, topicId) => {
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
    handlePageChange("subjects");
  }, [handlePageChange, setSelected, subjects]);

  const handleOpenMockTestsForTopic = useCallback((subjectOrWeakArea, topic) => {
    const subject = topic ? subjectOrWeakArea : null
    const weakArea = topic ? null : subjectOrWeakArea
    const subjectId = subject?.id || weakArea?.subjectId || null
    const topicId = topic?.id || weakArea?.topicId || null
    const subjectName = subject?.name || weakArea?.subjectName || 'Subject'
    const topicName = topic?.name || weakArea?.topicName || 'Topic'
    if (!subjectId || !topicId) return;

    setMockTestLaunch({
      subjectId,
      subjectName,
      topicId,
      topicName,
      launchId: uid(),
    });
    handlePageChange("questions");
  }, [handlePageChange]);

  const handleOpenExamGroup = useCallback((group) => {
    if (!group?.id) return

    setExamLaunch({
      id: group.id,
      name: group.name || 'Exam Group',
      subjectIds: Array.isArray(group.subjectIds) ? group.subjectIds : [],
      launchId: uid(),
    })
    handlePageChange("exams")
  }, [handlePageChange])

  const handleSubjectDetailBack = useCallback(() => {
    setSelected(null);
    setSubjectNoteLaunch(null);
    setSubjectSectionLaunch(null);
  }, [setSelected]);

  const handleMenuToggle = useCallback(() => {
    setMobileNavOpen((value) => !value)
  }, [])

  const handleOpenLoginPage = useCallback(() => {
    handlePageChange("login")
  }, [handlePageChange])

  const handleOpenSignupPage = useCallback(() => {
    handlePageChange("signup")
  }, [handlePageChange])

  const renderPageContent = (page) => {
    if (page === "login") {
      return (
        <LoginPage
          onSwitchToSignup={() => handlePageChange("signup")}
          onLoginSuccess={() => handlePageChange("subjects")}
        />
      );
    }

    if (page === "signup") {
      return (
        <SignupPage
          onSwitchToLogin={() => handlePageChange("login")}
          onSignupSuccess={() => handlePageChange("subjects")}
        />
      );
    }

    if (page === "questions") {
      return (
        <MockTestsPage
          user={authUser}
          subjects={subjects}
          onUpdateSubject={updateSubject}
          initialTopicContext={mockTestLaunch}
          topicLaunchKey={mockTestLaunch?.launchId || null}
          isActive={activePage === "questions"}
        />
      );
    }

    if (page === "exams") {
      return (
        <ExamsPage
          user={authUser}
          subjects={subjects}
          onUpdateSubject={updateSubject}
          initialGroupContext={examLaunch}
          groupLaunchKey={examLaunch?.launchId || null}
          onOpenWeakAreaMockTest={handleOpenMockTestsForTopic}
          isActive={activePage === "exams"}
        />
      )
    }

    if (page === "questionBank") {
      return (
        <QuestionBankPage
          subjects={subjects}
          onUpdateSubject={updateSubject}
        />
      );
    }

    if (page === "analytics") {
      return (
        <AnalyticsPage
          user={authUser}
          subjects={subjects}
          onOpenSubject={handleOpenSubjectFromAnalytics}
          onOpenExamGroup={handleOpenExamGroup}
        />
      );
    }

    if (page === "notes") {
      return (
        <NotesPage
          subjects={subjects}
          onUpdateSubject={updateSubject}
          onOpenNote={handleOpenNoteFromNotes}
        />
      );
    }

    if (page === "subjects") {
      if (selected) {
        const liveSubject =
          subjects.find((item) => item.id === selected.id) || selected;

        return (
          <SubjectDetailPage
            subject={liveSubject}
            allSubjects={subjects}
            initialOpenNote={
              subjectNoteLaunch?.subjectId === liveSubject.id
                ? {
                    note: subjectNoteLaunch.note,
                    topicId: subjectNoteLaunch.topicId,
                  }
                : null
            }
            noteLaunchKey={
              subjectNoteLaunch?.subjectId === liveSubject.id
                ? subjectNoteLaunch.launchId
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
            onBack={handleSubjectDetailBack}
            onUpdateSubject={updateSubject}
            user={authUser}
            onOpenMockTestsForTopic={handleOpenMockTestsForTopic}
            onNoteEditorVisibilityChange={setNoteEditorVisible}
            editorTopOffset={isImmersiveNoteEditor ? 0 : APP_TOPBAR_HEIGHT}
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

    return <ComingSoonPage pageId={page} />;
  };

  if (!isFirebaseConfigured) {
    return <FirebaseSetupView />;
  }

  const showLoadingView =
    authLoading ||
    (loading &&
      authUser &&
      subjects.length === 0 &&
      activePage !== "login" &&
      activePage !== "signup");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileNavOpen}
        ultraLite={performanceMode.ultraLite}
        setMobileOpen={setMobileNavOpen}
        activePage={activePage}
        setActivePage={handlePageChange}
        onOpenLogin={handleOpenLoginPage}
        onOpenSignup={handleOpenSignupPage}
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
          transition: isMobile ? "none" : "margin-left 0.24s cubic-bezier(0.4,0,0.2,1)",
          flex: 1,
          height: "100vh",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {showAppTopBar && (
          <TopBar
            pageTitle={pageTitle}
            showMenuButton={isMobile}
            ultraLite={performanceMode.ultraLite}
            onMenuClick={handleMenuToggle}
            activeThemeId={themeId}
            themeOptions={APP_THEME_OPTIONS}
            onThemeChange={setThemeId}
            canInstall={canInstall}
            onInstallClick={handleInstallApp}
            isInstallPending={installPending}
          />
        )}

        <div
          ref={contentScrollRef}
          className={
            showAppTopBar
              ? "flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-[30px] lg:py-[28px]"
              : "flex-1 min-w-full"
          }
          style={{
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
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

          {showLoadingView ? (
            <LoadingView />
          ) : (
            PAGE_IDS.map((pageId) => (
              <PersistentPage
                key={`${navigationScopeKey}-${pageId}`}
                active={activePage === pageId}
                mounted={activePage === pageId || Boolean(mountedPages[pageId])}
              >
                <Suspense fallback={<RouteFallback />}>
                  {renderPageContent(pageId)}
                </Suspense>
              </PersistentPage>
            ))
          )}
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
