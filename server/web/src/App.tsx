import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { Job, JobStatus } from './types/job';
import { api } from './api/client';
import { loadSettings, saveSettings, AppSettings } from './lib/auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './features/auth/LoginView';
import { RegisterView } from './features/auth/RegisterView';
import { JobFeed } from './features/feed/JobFeed';
import { KanbanBoard } from './features/tracker/KanbanBoard';
import { JobDetailModal } from './features/detail/JobDetailModal';
import { SettingsPage } from './features/settings/SettingsPage';
import { PipelineView } from './features/pipeline/PipelineView';
import { AddJobModal } from './features/feed/AddJobModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { SkeletonFeed } from './components/Skeleton';
import { CommandPalette } from './components/CommandPalette';
import { SupportModal } from './components/SupportModal';
import { getModKey } from './lib/platform';
import { getStatusLabel } from './lib/jobStages';
import {
  Briefcase,
  Kanban,
  Activity,
  Plus,
  RefreshCw,
  Settings,
  LogOut,
  Search,
  Laptop,
  Moon,
  Sun,
  Heart,
  ChevronDown,
} from 'lucide-react';

interface DashboardContentProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  jobs: Job[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onJobUpdated: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<void>;
}

const JobDetailWrapper: React.FC<{
  jobs: Job[];
  threshold: number;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<void>;
  onJobUpdated: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
}> = ({ jobs, threshold, onStatusChange, onJobUpdated, onJobDeleted }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [singleJob, setSingleJob] = useState<Job | null>(null);
  const [loadingSingle, setLoadingSingle] = useState(false);

  const matchedJob = jobs.find((j) => j.id === id) || singleJob;

  useEffect(() => {
    if (id && !jobs.some((j) => j.id === id)) {
      setLoadingSingle(true);
      api
        .getJob(id)
        .then((j) => setSingleJob(j))
        .catch(() => setSingleJob(null))
        .finally(() => setLoadingSingle(false));
    }
  }, [id, jobs]);

  const handleClose = () => {
    navigate(-1);
  };

  if (loadingSingle) {
    return null;
  }

  return (
    <JobDetailModal
      job={matchedJob}
      threshold={threshold}
      onClose={handleClose}
      onStatusChange={onStatusChange}
      onJobUpdated={(updated) => {
        setSingleJob(updated);
        onJobUpdated(updated);
      }}
      onDeleteJob={(deletedId) => {
        onJobDeleted(deletedId);
      }}
    />
  );
};

const TrackerRoute: React.FC<{
  jobs: Job[];
  threshold: number;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<void>;
  onJobUpdated: (job: Job) => void;
  onJobDeleted: (jobId: string) => void;
}> = ({ jobs, threshold, onStatusChange, onJobUpdated, onJobDeleted }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <>
      <KanbanBoard
        jobs={jobs}
        threshold={threshold}
        selectedJobId={id}
        onSelectJob={(job) => navigate(`/tracker/${job.id}`)}
        onStatusChange={onStatusChange}
      />
      {id && (
        <JobDetailWrapper
          jobs={jobs}
          threshold={threshold}
          onStatusChange={onStatusChange}
          onJobUpdated={onJobUpdated}
          onJobDeleted={onJobDeleted}
        />
      )}
    </>
  );
};

const TrackerLayout: React.FC<{
  currentView: 'board' | 'pipeline';
  children: React.ReactNode;
}> = ({ currentView, children }) => {
  return (
    <div className="tracker-page">
      <div className="tracker-view-header">
        <nav className="tracker-view-switcher" aria-label="Tracker views">
          <NavLink
            to="/tracker"
            end
            className={() => `tracker-view-tab ${currentView === 'board' ? 'active' : ''}`}
          >
            <Kanban size={15} />
            <span>Board</span>
          </NavLink>
          <NavLink
            to="/tracker/pipeline"
            className={() => `tracker-view-tab ${currentView === 'pipeline' ? 'active' : ''}`}
          >
            <Activity size={15} />
            <span>Pipeline & Analytics</span>
          </NavLink>
        </nav>
      </div>
      <div className="tracker-view-content">{children}</div>
    </div>
  );
};

const DashboardLayout: React.FC<DashboardContentProps> = ({
  settings,
  onSaveSettings,
  jobs,
  loading,
  error,
  onRefresh,
  onJobUpdated,
  onJobDeleted,
  onStatusChange,
}) => {
  const { user, logout } = useAuth();
  const { colorMode, setColorMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isSettingsOpen = location.pathname === '/settings';
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);

  // Global shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside and escape handler for user menu dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        userTriggerRef.current?.focus();
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const userInitials = (() => {
    const name = user ? user.name.trim() : '';
    if (name) {
      const parts = name.split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    const email = user ? user.email.trim() : '';
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  })();

  const userDisplayName = (() => {
    const name = user ? user.name.trim() : '';
    if (name) return name;
    if (user) {
      const prefix = user.email.split('@')[0];
      if (prefix) return prefix;
    }
    return 'Account';
  })();

  const isStandalonePage =
    location.pathname.startsWith('/tracker/pipeline') ||
    location.pathname.startsWith('/pipeline') ||
    location.pathname.startsWith('/settings');

  return (
    <div className="app-container">
      {/* Navigation */}
      <header className="navbar">
        <Link
          to="/feed"
          className="nav-brand"
          style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
          title="JobFoundry Feed"
        >
          <img
            src="/icons/logo.webp"
            alt="JobFoundry Logo"
            style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'contain' }}
          />
          <span>
            <span>Job</span>
            <span className="brand-gradient">Foundry</span>
          </span>
        </Link>

        <nav className="nav-tabs">
          <NavLink
            to="/feed"
            className={({ isActive }) =>
              `nav-tab ${isActive || location.pathname.startsWith('/jobs') ? 'active' : ''}`
            }
          >
            <Briefcase size={16} /> Job Feed
          </NavLink>
          <NavLink
            to="/tracker"
            className={({ isActive }) =>
              `nav-tab ${
                isActive ||
                location.pathname.startsWith('/tracker') ||
                location.pathname.startsWith('/pipeline')
                  ? 'active'
                  : ''
              }`
            }
          >
            <Kanban size={16} /> Tracker
          </NavLink>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className="cmd-k-btn"
            title={`Open Command Palette (${getModKey().label} + K)`}
            aria-label="Command Palette"
          >
            <Search size={14} />
            <span>Search</span>
            <kbd className="cmd-k-badge">{getModKey().text}</kbd>
          </button>

          <button
            type="button"
            onClick={() => setIsAddJobOpen(true)}
            className="btn btn-primary btn-sm add-job-btn"
            aria-label="Add job"
            title="Add job manually"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={15} /> <span>Add Job</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            title="Refresh jobs from server"
            aria-label="Refresh jobs from server"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <div className="nav-divider" />

          {/* User Account & Settings Dropdown */}
          <div
            className="user-menu-container"
            ref={userMenuRef}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setIsUserMenuOpen(false);
              }
            }}
          >
            <button
              ref={userTriggerRef}
              type="button"
              onClick={() => {
                setIsUserMenuOpen((prev) => !prev);
              }}
              className={`user-menu-trigger ${isUserMenuOpen ? 'active' : ''}`}
              aria-expanded={isUserMenuOpen}
              aria-label="User account and settings menu"
            >
              <div className="user-avatar-badge">{userInitials}</div>
              <span className="user-display-name">{userDisplayName}</span>
              <ChevronDown
                size={14}
                className={`user-menu-chevron ${isUserMenuOpen ? 'open' : ''}`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="user-menu-dropdown">
                <div className="user-menu-profile-header">
                  <div className="user-avatar-badge lg">{userInitials}</div>
                  <div className="user-menu-profile-info">
                    <div className="user-menu-name">{userDisplayName}</div>
                    <div className="user-menu-email">{user ? user.email : 'Logged in'}</div>
                  </div>
                </div>

                <div className="user-menu-section">
                  <div className="user-menu-section-label">Appearance</div>
                  <div className="theme-toggle-group" aria-label="Theme mode">
                    <button
                      type="button"
                      className={`theme-chip ${colorMode === 'light' ? 'active' : ''}`}
                      onClick={() => {
                        setColorMode('light');
                      }}
                      aria-pressed={colorMode === 'light'}
                      title="Light theme"
                    >
                      <Sun size={13} />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      className={`theme-chip ${colorMode === 'dark' ? 'active' : ''}`}
                      onClick={() => {
                        setColorMode('dark');
                      }}
                      aria-pressed={colorMode === 'dark'}
                      title="Dark theme"
                    >
                      <Moon size={13} />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      className={`theme-chip ${colorMode === 'system' ? 'active' : ''}`}
                      onClick={() => {
                        setColorMode('system');
                      }}
                      aria-pressed={colorMode === 'system'}
                      title="System theme"
                    >
                      <Laptop size={13} />
                      <span>System</span>
                    </button>
                  </div>
                </div>

                <div className="user-menu-divider" />

                <button
                  type="button"
                  className={`user-menu-item ${isSettingsOpen ? 'active' : ''}`}
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                >
                  <Settings size={15} />
                  <span>Settings & Themes</span>
                </button>

                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSupportOpen(true);
                  }}
                >
                  <Heart size={15} style={{ color: 'var(--color-red, #ef4444)' }} />
                  <span>Support JobFoundry</span>
                </button>

                <div className="user-menu-divider" />

                <button
                  type="button"
                  className="user-menu-item user-menu-item-danger"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {error && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#fca5a5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{error}</span>
            <button onClick={onRefresh} className="btn btn-secondary btn-sm">
              Retry
            </button>
          </div>
        )}

        {loading && !isStandalonePage ? (
          <SkeletonFeed count={4} />
        ) : (
          <Routes>
            <Route
              path="/feed"
              element={
                <JobFeed
                  jobs={jobs}
                  threshold={settings.threshold}
                  onSelectJob={(job) => navigate(`/jobs/${job.id}`)}
                  onJobUpdated={onJobUpdated}
                  onJobDeleted={onJobDeleted}
                  onStatusChange={onStatusChange}
                  onRefreshJobs={onRefresh}
                />
              }
            />
            <Route
              path="/tracker"
              element={
                <TrackerLayout currentView="board">
                  <TrackerRoute
                    jobs={jobs}
                    threshold={settings.threshold}
                    onStatusChange={onStatusChange}
                    onJobUpdated={onJobUpdated}
                    onJobDeleted={onJobDeleted}
                  />
                </TrackerLayout>
              }
            />
            <Route
              path="/tracker/pipeline"
              element={
                <TrackerLayout currentView="pipeline">
                  <PipelineView
                    onSelectJob={(jobId) => {
                      navigate(`/jobs/${jobId}`);
                    }}
                  />
                </TrackerLayout>
              }
            />
            <Route
              path="/tracker/:id"
              element={
                <TrackerLayout currentView="board">
                  <TrackerRoute
                    jobs={jobs}
                    threshold={settings.threshold}
                    onStatusChange={onStatusChange}
                    onJobUpdated={onJobUpdated}
                    onJobDeleted={onJobDeleted}
                  />
                </TrackerLayout>
              }
            />
            <Route path="/pipeline" element={<Navigate to="/tracker/pipeline" replace />} />
            <Route
              path="/jobs/:id"
              element={
                <>
                  <JobFeed
                    jobs={jobs}
                    threshold={settings.threshold}
                    onSelectJob={(job) => navigate(`/jobs/${job.id}`)}
                    onJobUpdated={onJobUpdated}
                    onJobDeleted={onJobDeleted}
                    onStatusChange={onStatusChange}
                    selectedJobId={location.pathname.split('/')[2]}
                    onRefreshJobs={onRefresh}
                  />
                  <JobDetailWrapper
                    jobs={jobs}
                    threshold={settings.threshold}
                    onStatusChange={onStatusChange}
                    onJobUpdated={onJobUpdated}
                    onJobDeleted={onJobDeleted}
                  />
                </>
              }
            />
            <Route
              path="/settings"
              element={<SettingsPage settings={settings} onSaveSettings={onSaveSettings} />}
            />
            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Routes>
        )}

        {isAddJobOpen && (
          <AddJobModal
            onClose={() => setIsAddJobOpen(false)}
            onJobAdded={(newJob) => {
              onJobUpdated(newJob);
              onRefresh();
            }}
          />
        )}

        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          jobs={jobs}
          onOpenAddJob={() => setIsAddJobOpen(true)}
          onRefreshJobs={onRefresh}
        />

        <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      </main>
    </div>
  );
};

const DashboardRoot: React.FC = () => {
  const { user, token, loading: authLoading, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      api
        .getRegistrationStatus()
        .then((status) => {
          if (typeof status.userCount === 'number') {
            setUserCount(status.userCount);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Sync API client with current settings & token
  useEffect(() => {
    api.setBaseUrl(settings.apiUrl);
    api.setApiKey(token || settings.apiKey || null);
  }, [settings, token]);

  const fetchJobs = useCallback(async () => {
    if (!token && !settings.apiKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getJobs({ limit: 200 });
      setJobs(data);
    } catch (err: any) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(err.message || 'Failed to load jobs from server');
    } finally {
      setLoading(false);
    }
  }, [token, settings.apiKey, logout]);

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user, fetchJobs]);

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    const previousStatus = jobs.find((j) => j.id === jobId)?.status;
    try {
      const updated = await api.updateStatus(jobId, newStatus);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));

      const label = getStatusLabel(newStatus);
      if (previousStatus && previousStatus !== newStatus) {
        toast.undoable(`Marked ${label}`, 'Undo', async () => {
          try {
            const current = jobs.find((j) => j.id === jobId)?.status;
            if (current && current !== newStatus) {
              return;
            }
            const reverted = await api.updateStatus(jobId, previousStatus);
            setJobs((prev) => prev.map((j) => (j.id === jobId ? reverted : j)));
            toast.success(`Moved back to ${getStatusLabel(previousStatus)}`);
          } catch (err: any) {
            toast.error(`Could not undo: ${err.message || 'Unknown error'}`);
          }
        });
      } else {
        toast.success(`Stage set to ${label}`);
      }
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message || 'Unknown error'}`);
    }
  };

  const handleJobUpdated = (updatedJob: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
  };

  const handleJobDeleted = (deletedId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== deletedId));
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    fetchJobs();
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        Authenticating...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route
          path="/login"
          element={<LoginView onSwitchToRegister={() => navigate('/register')} />}
        />
        <Route
          path="/register"
          element={<RegisterView onSwitchToLogin={() => navigate('/login')} />}
        />
        <Route
          path="*"
          element={
            userCount === 0 ? (
              <RegisterView onSwitchToLogin={() => navigate('/login')} />
            ) : (
              <LoginView onSwitchToRegister={() => navigate('/register')} />
            )
          }
        />
      </Routes>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Dashboard Error">
      <DashboardLayout
        settings={settings}
        onSaveSettings={handleSaveSettings}
        jobs={jobs}
        loading={loading}
        error={error}
        onRefresh={fetchJobs}
        onJobUpdated={handleJobUpdated}
        onJobDeleted={handleJobDeleted}
        onStatusChange={handleStatusChange}
      />
    </ErrorBoundary>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <DashboardRoot />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
