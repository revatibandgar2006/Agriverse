import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
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
import FarmFinance from "./pages/FarmFinance";

import {
  getMyProfile,
  isLoggedIn,
  logout,
} from "./services/api";

import "./App.css";

const NOTIFICATION_STORAGE_KEY = "agriverse_notifications";

function readNotifications() {
  try {
    const saved = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function NotificationBell() {
  const [notifications, setNotifications] = useState(readNotifications);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const refreshNotifications = () => {
      setNotifications(readNotifications());
    };

    window.addEventListener("storage", refreshNotifications);
    window.addEventListener("agriverse-notifications-updated", refreshNotifications);

    return () => {
      window.removeEventListener("storage", refreshNotifications);
      window.removeEventListener("agriverse-notifications-updated", refreshNotifications);
    };
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  function markAllRead() {
    const updated = notifications.map((item) => ({ ...item, read: true }));
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
    window.dispatchEvent(new Event("agriverse-notifications-updated"));
  }

  return (
    <div className="notification-wrapper">
      <button
        type="button"
        className="notification-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-heading">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="empty-notifications">No notifications yet.</p>
          ) : (
            notifications.slice(0, 10).map((item, index) => (
              <div className={`notification-item${item.read ? " read" : ""}`} key={item.id || index}>
                <strong>{item.title || "AgriVerse reminder"}</strong>
                <p>{item.message || item.description || ""}</p>
                {item.date && <small>{item.date}</small>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = location.pathname === "/farmers"
    ? "Farmers"
    : location.pathname === "/weather"
    ? "Weather Forecast"
    : location.pathname === "/crop-recommendation"
    ? "Crop Recommendation"
    : location.pathname === "/farming-planner"
    ? "Farming Planner"
    : location.pathname === "/activity-reports"
    ? "Activity Reports"
    : location.pathname === "/farm-finance"
    ? "Farm Finance"
    : location.pathname === "/profile"
    ? "Profile"
    : "Dashboard";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>🌱 AgriVerse</h2>
          <p>Smart Farming Platform</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink to="/farmers" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>👨‍🌾</span> Farmers
          </NavLink>
          <NavLink to="/weather" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>🌦️</span> Weather
          </NavLink>
          <NavLink to="/crop-recommendation" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>🌾</span> Crop Recommendation
          </NavLink>
          <NavLink to="/farming-planner" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>🗓️</span> Farming Planner
          </NavLink>
          <NavLink to="/activity-reports" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>📄</span> Activity Reports
          </NavLink>
          <NavLink to="/farm-finance" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>💰</span> Farm Finance
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>👤</span> Profile
          </NavLink>
        </nav>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{pageTitle}</h1>
            <p>Welcome to your smart farming workspace</p>
          </div>
          <NotificationBell />
        </header>
        <section className="page-content">{children}</section>
      </main>
    </div>
  );
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load profile.");
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) return <div className="error-message">{error}</div>;
  if (!profile) return <p>Loading profile...</p>;

  return (
    <div className="profile-card">
      <h2>My Profile</h2>
      <p><strong>Username:</strong> {profile.username}</p>
      <p><strong>Email:</strong> {profile.email}</p>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={isLoggedIn() ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Register />} />

      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/farmers" element={<ProtectedRoute><Layout><Farmers /></Layout></ProtectedRoute>} />
      <Route path="/weather" element={<ProtectedRoute><Layout><Weather /></Layout></ProtectedRoute>} />
      <Route path="/crop-recommendation" element={<ProtectedRoute><Layout><CropRecommendation /></Layout></ProtectedRoute>} />
      <Route path="/farming-planner" element={<ProtectedRoute><Layout><FarmingPlanner /></Layout></ProtectedRoute>} />
      <Route path="/activity-reports" element={<ProtectedRoute><Layout><ActivityReports /></Layout></ProtectedRoute>} />
      <Route path="/farm-finance" element={<ProtectedRoute><Layout><FarmFinance /></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />

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
