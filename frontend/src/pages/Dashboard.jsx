
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import {
  getFarmers,
  getMyProfile,
  getDashboardAnalytics,
} from "../services/api";

const CHART_COLORS = [
  "#287548",
  "#55A66F",
  "#8BC69A",
  "#B7DDBD",
  "#D4EAD6",
  "#477D5A",
  "#9AB5A0",
  "#6EAA82",
];

const numberFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [userData, farmerData, analyticsData] = await Promise.all([
        getMyProfile(),
        getFarmers(),
        getDashboardAnalytics(),
      ]);

      setProfile(userData);
      setFarmers(Array.isArray(farmerData) ? farmerData : []);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message || "Could not load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <main className="page-content">
        <p>Loading your AgriVerse dashboard...</p>
      </main>
    );
  }

  const cropData = analytics?.crop_distribution ?? [];
  const locationData = analytics?.location_distribution ?? [];

  const tooltipStyle = {
    borderRadius: "10px",
    border: "1px solid #e5ebe3",
    fontSize: "12px",
  };

  return (
    <main className="page-content">
      {/* Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW & ANALYTICS</p>
          <h1>Welcome, {profile?.username || "Farmer"}!</h1>
          <p className="subtitle">
            Explore your farmer records and agriculture statistics.
          </p>
        </div>

        <div className="dashboard-heading-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>

          <Link className="primary-link" to="/farmers">
            + Add Farmer
          </Link>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
          <button
            type="button"
            className="secondary-button dashboard-retry"
            onClick={() => loadDashboard(true)}
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className="stats-grid analytics-stats-grid">
        <article className="stat-card">
          <span className="stat-icon">👨‍🌾</span>
          <p>Total Farmers</p>
          <h2>{analytics?.total_farmers ?? farmers.length}</h2>
          <span className="stat-caption">Registered records</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">🌾</span>
          <p>Crop Types</p>
          <h2>{analytics?.total_crop_types ?? 0}</h2>
          <span className="stat-caption">Different crops recorded</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">📍</span>
          <p>Locations</p>
          <h2>{analytics?.total_locations ?? 0}</h2>
          <span className="stat-caption">Locations represented</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">🌱</span>
          <p>Total Farm Size</p>
          <h2>
            {numberFormat.format(analytics?.total_farm_size ?? 0)}
          </h2>
          <span className="stat-caption">
            Sum of valid numeric entries
          </span>
        </article>
      </section>

      {/* Charts */}
      <section className="analytics-charts">
        <article className="content-card chart-card">
          <div className="section-heading">
            <div>
              <h2>Crop Distribution</h2>
              <p>Number of farmers recorded for each crop.</p>
            </div>
          </div>

          {cropData.length === 0 ? (
            <div className="chart-empty">
              <span>🌾</span>
              <p>Add farmer records with crop details to view this chart.</p>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cropData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    outerRadius="72%"
                    innerRadius="42%"
                    paddingAngle={3}
                  >
                    {cropData.map((item, index) => (
                      <Cell
                        key={`${item.name}-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="bottom" height={40} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="content-card chart-card">
          <div className="section-heading">
            <div>
              <h2>Farmers by Location</h2>
              <p>Compare the number of farmers in each location.</p>
            </div>
          </div>

          {locationData.length === 0 ? (
            <div className="chart-empty">
              <span>📍</span>
              <p>Add farmer records to view location statistics.</p>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={locationData}
                  margin={{ top: 10, right: 12, left: -18, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e8eee6"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#718075" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={locationData.length > 4 ? -20 : 0}
                    textAnchor={locationData.length > 4 ? "end" : "middle"}
                    height={locationData.length > 4 ? 55 : 30}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#718075" }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip contentStyle={tooltipStyle} />

                  <Bar
                    dataKey="count"
                    name="Farmers"
                    fill="#287548"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </section>

      {/* Farm size summary */}
      <section className="content-card farm-summary-card">
        <div className="section-heading">
          <div>
            <h2>Farm Size Summary</h2>
            <p>
              Calculated from records containing positive numeric farm sizes.
            </p>
          </div>
        </div>

        <div className="farm-summary-grid">
          <div className="farm-summary-item">
            <span>Total entered farm size</span>
            <strong>
              {numberFormat.format(analytics?.total_farm_size ?? 0)}
            </strong>
          </div>

          <div className="farm-summary-item">
            <span>Average farm size</span>
            <strong>
              {numberFormat.format(analytics?.average_farm_size ?? 0)}
            </strong>
          </div>

          <div className="farm-summary-item">
            <span>Numeric records included</span>
            <strong>{analytics?.numeric_farm_size_records ?? 0}</strong>
          </div>
        </div>

        <p className="analytics-note">
          Farm-size values are shown in the same units in which you entered
          them. Values that are not positive numeric entries are excluded
          from the calculations.
        </p>
      </section>

      {/* Recent farmers */}
      <section className="content-card recent-farmers-card">
        <div className="section-heading">
          <div>
            <h2>Recent Farmer Records</h2>
            <p>Your latest saved farmer details.</p>
          </div>

          <Link to="/farmers">View all →</Link>
        </div>

        {farmers.length === 0 ? (
          <div className="empty-state">
            <span>🌱</span>
            <h3>No farmer records yet</h3>
            <p>Add your first farmer to get started.</p>
            <Link className="primary-link" to="/farmers">
              Add a Farmer
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Crop</th>
                  <th>Location</th>
                  <th>Farm Size</th>
                </tr>
              </thead>

              <tbody>
                {farmers.slice(0, 5).map((farmer) => (
                  <tr key={farmer.id}>
                    <td>{farmer.name}</td>
                    <td>{farmer.crop || "—"}</td>
                    <td>{farmer.location || "—"}</td>
                    <td>{farmer.farm_size ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
