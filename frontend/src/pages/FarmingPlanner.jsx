
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createFarmingActivity,
  deleteFarmingActivity,
  getFarmingActivities,
  updateFarmingActivity,
  updateFarmingActivityStatus,
} from "../services/api";

const ACTIVITY_TYPES = [
  "Sowing",
  "Irrigation",
  "Fertilizer",
  "Pest Control",
  "Weeding",
  "Harvesting",
  "Other",
];

const EMPTY_FORM = {
  title: "",
  activity_type: "Irrigation",
  scheduled_date: [
    new Date().getFullYear(),
    String(new Date().getMonth() + 1).padStart(2, "0"),
    String(new Date().getDate()).padStart(2, "0"),
  ].join("-"),
  description: "",
  notes: "",
};



const NOTIFICATION_STORAGE_KEY = "agriverse_notifications";
const FARMING_REMINDER_KEYS = "agriverse_farming_reminders_seen";


function syncFarmingActivityNotifications(activities) {
  try {
    const savedNotifications = JSON.parse(
      localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "[]"
    );

    const notifications = Array.isArray(savedNotifications)
      ? savedNotifications
      : [];

    const savedKeys = JSON.parse(
      localStorage.getItem(FARMING_REMINDER_KEYS) || "[]"
    );

    const previousSeenKeys = new Set(
      Array.isArray(savedKeys) ? savedKeys : []
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeReminderKeys = new Set();
    const newNotifications = [];

    activities.forEach((activity) => {
      if (
        activity.completed ||
        !activity.scheduled_date ||
        activity.id == null
      ) {
        return;
      }

      const [year, month, day] = String(activity.scheduled_date)
        .slice(0, 10)
        .split("-")
        .map(Number);

      if (!year || !month || !day) return;

      const activityDate = new Date(year, month - 1, day);
      activityDate.setHours(0, 0, 0, 0);

      // Ignore invalid calendar dates
      if (
        activityDate.getFullYear() !== year ||
        activityDate.getMonth() !== month - 1 ||
        activityDate.getDate() !== day
      ) {
        return;
      }

      const daysUntil = Math.round(
        (activityDate.getTime() - today.getTime()) /
          (24 * 60 * 60 * 1000)
      );

      let kind = "";
      let title = "";
      let message = "";
      let icon = "📅";

      if (daysUntil < 0) {
        kind = "overdue";
        title = "Overdue farming activity";
        message = `"${activity.title}" was scheduled for ${activity.scheduled_date}.`;
        icon = "⚠️";
      } else if (daysUntil === 0) {
        kind = "today";
        title = "Farming activity due today";
        message = `"${activity.title}" is scheduled for today.`;
        icon = "🌱";
      } else if (daysUntil <= 3) {
        kind = "upcoming";
        title = "Upcoming farming activity";
        message = `"${activity.title}" is scheduled for ${activity.scheduled_date}.`;
        icon = "📅";
      } else {
        return;
      }

      const reminderKey =
        `${activity.id}-${kind}-${activity.scheduled_date}`;

      activeReminderKeys.add(reminderKey);

      if (previousSeenKeys.has(reminderKey)) return;

      newNotifications.push({
        id: `farming-${reminderKey}`,
        title,
        message,
        icon,
        location: "Farming Planner",
        createdAt: new Date().toISOString(),
        read: false,
      });
    });

    // Remove reminders that are no longer relevant.
    // Keep notifications created by other modules.
    const retainedNotifications = notifications.filter(
      (notification) => {
        if (
          !String(notification.id || "").startsWith("farming-")
        ) {
          return true;
        }

        const reminderKey = String(notification.id).slice(
          "farming-".length
        );

        return activeReminderKeys.has(reminderKey);
      }
    );

    const updatedNotifications = [
      ...newNotifications,
      ...retainedNotifications,
    ];

    const notificationsChanged =
      newNotifications.length > 0 ||
      updatedNotifications.length !== notifications.length;

    if (notificationsChanged) {
      localStorage.setItem(
        NOTIFICATION_STORAGE_KEY,
        JSON.stringify(updatedNotifications)
      );

      window.dispatchEvent(
        new Event("agriverse-notifications-updated")
      );
    }

    // Keep only currently relevant reminder keys.
    localStorage.setItem(
      FARMING_REMINDER_KEYS,
      JSON.stringify([...activeReminderKeys])
    );
  } catch (error) {
    console.error(
      "Unable to synchronize farming reminders.",
      error
    );
  }
}


function formatDate(value) {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function FarmingPlanner() {
  const [activities, setActivities] = useState([]);
  const [allActivities, setAllActivities] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
        const data = await getFarmingActivities("all");
        const allActivities = Array.isArray(data) ? data : [];

        // Generate reminders from every activity.
        syncFarmingActivityNotifications(allActivities);

        // Apply the selected filter.
        const filteredActivities =
            filter === "pending"
                ? allActivities.filter((item) => !item.completed)
                : filter === "completed"
                    ? allActivities.filter((item) => item.completed)
                    : allActivities;

        setAllActivities(allActivities);
        setActivities(filteredActivities);
    } catch (err) {
        setError(
            err.message || "Unable to load farming activities."
        );
    } finally {
        setLoading(false);
    }
  }, [filter]);

  // Load activities when the page opens and whenever the filter changes.
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Calculate progress from ALL activities, not only the filtered list.
  const counts = useMemo(() => {
    const total = allActivities.length;
    const completed = allActivities.filter((item) => item.completed).length;
    const pending = allActivities.filter((item) => !item.completed).length;
    const percentage = total > 0
      ? Math.round((completed / total) * 100)
      : 0;

    return { total, completed, pending, percentage };
  }, [allActivities]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const payload = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (editingId !== null) {
        const existing = activities.find((item) => item.id === editingId);

        await updateFarmingActivity(editingId, {
          ...payload,
          completed: existing?.completed ?? false,
        });

        setMessage("Farming activity updated successfully.");
      } else {
        await createFarmingActivity(payload);
        setMessage("Farming activity added successfully.");
      }

      resetForm();
      await loadActivities();
    } catch (err) {
      setError(err.message || "Unable to save the activity.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(activity) {
    setEditingId(activity.id);
    setForm({
      title: activity.title,
      activity_type: activity.activity_type,
      scheduled_date: activity.scheduled_date,
      description: activity.description || "",
      notes: activity.notes || "",
    });
    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleCompleted(activity) {
    setError("");
    setMessage("");

    try {
      await updateFarmingActivityStatus(
        activity.id,
        !activity.completed
      );

      setMessage(
        activity.completed
          ? "Activity marked as pending."
          : "Activity marked as completed."
      );

      await loadActivities();
    } catch (err) {
      setError(err.message || "Unable to update activity status.");
    }
  }

  async function handleDelete(activity) {
    const confirmed = window.confirm(
      `Delete "${activity.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await deleteFarmingActivity(activity.id);
      setMessage("Farming activity deleted successfully.");
      await loadActivities();

      if (editingId === activity.id) resetForm();
    } catch (err) {
      setError(err.message || "Unable to delete activity.");
    }
  }

  return (
    <div className="planner-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FARM MANAGEMENT</p>
          <h1>Farming Activity Planner</h1>
          <p className="subtitle">
            Plan your fieldwork and keep track of important farming tasks.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadActivities}
          disabled={loading}
        >
          Refresh activities
        </button>
      </div>

      <div className="planner-stats">
        <section className="planner-stat-card">
          <span>📋</span>
          <p>Total Activities</p>
          <strong>{counts.total}</strong>
        </section>

        <section className="planner-stat-card">
          <span>⏳</span>
          <p>Remaining Tasks</p>
          <strong>{counts.pending}</strong>
        </section>

        <section className="planner-stat-card">
          <span>✅</span>
          <p>Completed Tasks</p>
          <strong>{counts.completed}</strong>
        </section>

        <section className="planner-stat-card">
          <span>📊</span>
          <p>Completion Percentage</p>
          <strong>{counts.percentage}%</strong>
        </section>
      </div>

      <section className="content-card planner-form-card">
        <div className="section-heading">
          <div>
            <h2>{editingId !== null ? "Edit Activity" : "Add New Activity"}</h2>
            <p>Record the next task for your farm.</p>
          </div>
        </div>

        {error && <div className="error-message" role="alert">{error}</div>}
        {message && <div className="success-message" role="status">{message}</div>}

        <form className="planner-form" onSubmit={handleSubmit}>
          <div className="planner-field">
            <label htmlFor="activity-title">Activity title *</label>
            <input
              id="activity-title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Irrigate the tomato field"
              minLength={2}
              maxLength={150}
              required
            />
          </div>

          <div className="planner-field">
            <label htmlFor="activity-type">Activity type *</label>
            <select
              id="activity-type"
              name="activity_type"
              value={form.activity_type}
              onChange={handleChange}
              required
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="planner-field">
            <label htmlFor="activity-date">Scheduled date *</label>
            <input
              id="activity-date"
              type="date"
              name="scheduled_date"
              value={form.scheduled_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="planner-field">
            <label htmlFor="activity-description">Description</label>
            <textarea
              id="activity-description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="What needs to be done?"
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="planner-field planner-full-width">
            <label htmlFor="activity-notes">Notes (optional)</label>
            <textarea
              id="activity-notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Equipment, quantity, field details..."
              maxLength={2000}
              rows={2}
            />
          </div>

          <div className="planner-form-actions planner-full-width">
            <button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "Add Activity"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="content-card planner-list-card">
        <div className="section-heading">
          <div>
            <h2>Your Farming Activities</h2>
            <p>Manage your planned and completed fieldwork.</p>
          </div>

          <div className="planner-filter">
            <label htmlFor="activity-filter">Show</label>
            <select
              id="activity-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All activities</option>
              <option value="pending">Pending only</option>
              <option value="completed">Completed only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading farming activities...</p>
        ) : activities.length === 0 ? (
          <div className="empty-state">
            <span>🌱</span>
            <h3>No activities found</h3>
            <p>Add a farming activity above to start planning your work.</p>
          </div>
        ) : (
          <div className="planner-activity-list">
            {activities.map((activity) => (
              <article
                className={`planner-activity-card${activity.completed ? " is-completed" : ""}`}
                key={activity.id}
              >
                <div className="planner-activity-main">
                  <div className="planner-activity-topline">
                    <span className="planner-type-tag">
                      {activity.activity_type}
                    </span>

                    <span className={`planner-status${activity.completed ? " completed" : ""}`}>
                      {activity.completed ? "Completed" : "Pending"}
                    </span>
                  </div>

                  <h3>{activity.title}</h3>
                  <p className="planner-activity-date">
                    📅 {formatDate(activity.scheduled_date)}
                  </p>

                  {activity.description && <p>{activity.description}</p>}
                  {activity.notes && (
                    <p className="planner-notes">
                      <strong>Notes:</strong> {activity.notes}
                    </p>
                  )}
                </div>

                <div className="planner-activity-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => toggleCompleted(activity)}
                  >
                    {activity.completed ? "Mark Pending" : "Mark Completed"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => startEditing(activity)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="planner-delete-button"
                    onClick={() => handleDelete(activity)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
