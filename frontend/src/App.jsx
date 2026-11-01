
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import Weather from "./pages/Weather";
import CropRecommendation from "./pages/CropRecommendation";

import ActivityReports from "./pages/ActivityReports";

import FarmingPlanner from "./pages/FarmingPlanner";

import { getMyProfile, isLoggedIn, logout } from "./services/api";

import "./App.css";


const NOTIFICATION_STORAGE_KEY = "agriverse_notifications";

function readNotifications() {
  try {
    const saved = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications) {
  try {
    localStorage.setItem(
      NOTIFICATION_STORAGE_KEY,
      JSON.stringify(notifications)
    );
  } catch (error) {
    console.error("Unable to save notifications.", error);
  }
}

// PROTECTED ROUTE
function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

// NOTIFICATION BELL AND DROPDOWN
function NotificationBell() {
  const [notifications, setNotifications] = useState(readNotifications);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  useEffect(() => {
    function handleNotificationsUpdated() {
      setNotifications(readNotifications());
    }

    window.addEventListener(
      "agriverse-notifications-updated",
      handleNotificationsUpdated
    );

    window.addEventListener("storage", handleNotificationsUpdated);

    return () => {
      window.removeEventListener(
        "agriverse-notifications-updated",
        handleNotificationsUpdated
      );
      window.removeEventListener("storage", handleNotificationsUpdated);
    };
  }, []);

  function updateNotifications(updatedNotifications) {
    saveNotifications(updatedNotifications);
    setNotifications(updatedNotifications);
    window.dispatchEvent(new Event("agriverse-notifications-updated"));
  }

  function markAsRead(id) {
    updateNotifications(
      notifications.map((notification) =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  }

  function markAllAsRead() {
    updateNotifications(
      notifications.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  }

  function dismissNotification(id) {
    updateNotifications(
      notifications.filter((notification) => notification.id !== id)
    );
  }

  function clearAllNotifications() {
    updateNotifications([]);
  }

  return (
    <div className="notification-container">
      <button
        type="button"
        className="notification-bell"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <span aria-hidden="true">🔔</span>

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="notification-backdrop"
            aria-label="Close notifications"
            onClick={() => setIsOpen(false)}
          />

          <section
            className="notification-dropdown"
            aria-label="Notifications"
          >
            <div className="notification-panel-header">
              <div>
                <h3>Notifications</h3>
                <p>
                  {unreadCount === 0
                    ? "You're all caught up"
                    : `${unreadCount} unread notification${
                        unreadCount === 1 ? "" : "s"
                      }`}
                </p>
              </div>

              <button
                type="button"
                className="notification-close"
                aria-label="Close notifications"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            {notifications.length > 0 && (
              <div className="notification-toolbar">
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Mark all as read
                </button>

                <button
                  type="button"
                  onClick={clearAllNotifications}
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <span aria-hidden="true">🌱</span>
                  <strong>No notifications yet</strong>
                  <p>
                    Check a location on the Weather page to see whether
                    weather conditions generate any alerts.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <article
                    className={`notification-item${
                      notification.read ? " is-read" : " is-unread"
                    }`}
                    key={notification.id}
                  >
                    <div className="notification-item-icon">
                      {notification.icon || "🔔"}
                    </div>

                    <div className="notification-item-content">
                      <div className="notification-item-title">
                        <strong>{notification.title}</strong>
                        {!notification.read && (
                          <span className="notification-unread-dot" />
                        )}
                      </div>

                      <p>{notification.message}</p>

                      <small>
                        {notification.location
                          ? `${notification.location} · `
                          : ""}
                        {notification.createdAt
                          ? new Date(
                              notification.createdAt
                            ).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Recently"}
                      </small>

                      <div className="notification-item-actions">
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark as read
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            dismissNotification(notification.id)
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// MAIN LAYOUT
function Layout({ children }) {
  const navigate = useNavigate();
  const currentLocation = useLocation();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const pageTitle =
    currentLocation.pathname === "/farmers"
      ? "Farmers"
      : currentLocation.pathname === "/weather"
        ? "Weather"
        : currentLocation.pathname === "/crop-recommendation"
          ? "Crop Recommendation"
          : currentLocation.pathname === "/farming-planner"
            ? "Farming Planner"
            : currentLocation.pathname === "/profile"
              ? "My Profile"
                : "AgriVerse Dashboard";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🌱</div>
          <div>
            <h2>AgriVerse</h2>
            <p>Smart Agriculture</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-title">MAIN MENU</p>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <span>📊</span> Dashboard
          </NavLink>

          <NavLink
            to="/farmers"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <span>👨‍🌾</span> Farmers
          </NavLink>

          <NavLink
            to="/weather"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <span>🌦️</span> Weather
          </NavLink>

          <NavLink
            to="/crop-recommendation"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <span>🌾</span> Crop Recommendation
          </NavLink>


          <NavLink
            to="/farming-planner"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <span>📅</span> Farming Planner
          </NavLink>


          <NavLink to="/activity-reports">
            <span>📊</span>
            <span>Activity Reports</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `nav-link${isActive ? " active" : ""}`
            }
          >
            <span>👤</span> Profile
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <p>AgriVerse</p>
          <span>Growing a smarter future</span>
        </div>
      </aside>

      <div className="main-layout">
        <header className="topbar">
          <div>
            <h3>{pageTitle}</h3>
            <p>Welcome to your agriculture management system</p>
          </div>

          <div className="topbar-actions">
            <NotificationBell />

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

// PROFILE PAGE
function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const data = await getMyProfile();

        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="profile-page">
      <div className="section-heading">
        <div>
          <h2>My Profile</h2>
          <p>Your AgriVerse account information</p>
        </div>
      </div>

      <section className="content-card">
        {loading ? (
          <p>Loading profile...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : profile ? (
          <div className="profile-details">
            <p>
              <strong>Username:</strong>{" "}
              {profile.username || "Not available"}
            </p>
            <p>
              <strong>Email:</strong> {profile.email || "Not available"}
            </p>
            {profile.id !== undefined && (
              <p>
                <strong>User ID:</strong> {profile.id}
              </p>
            )}
          </div>
        ) : (
          <p>Profile information is unavailable.</p>
        )}
      </section>
    </div>
  );
}

// APPLICATION ROUTES
function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={isLoggedIn() ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/farmers"
        element={
          <ProtectedRoute>
            <Layout>
              <Farmers />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/weather"
        element={
          <ProtectedRoute>
            <Layout>
              <Weather />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/crop-recommendation"
        element={
          <ProtectedRoute>
            <Layout>
              <CropRecommendation />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/farming-planner"
        element={
          <ProtectedRoute>
            <Layout>
              <FarmingPlanner />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/activity-reports"
        element={<ActivityReports />}
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
