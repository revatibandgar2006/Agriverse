import { useCallback, useEffect, useMemo, useState } from "react";
import { getFarmingActivities } from "../services/api";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

function parseLocalDate(value) {
  if (!value) return null;

  // Avoid UTC date shifts when parsing YYYY-MM-DD.
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWeekStart(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function isWithinRange(date, start, end) {
  return date && date >= start && date <= end;
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatActivityDate(value) {
  const date = parseLocalDate(value);
  return date ? formatDate(date) : "Not scheduled";
}

function getActivityName(activity) {
  return (
    activity.title ||
    activity.activity_name ||
    activity.name ||
    activity.activity_type ||
    "Farming activity"
  );
}

function getActivityRows(activities) {
  return activities.map((activity, index) => ({
    "Sr. No.": index + 1,
    "Activity": getActivityName(activity),
    "Activity Type": activity.activity_type || "Other",
    "Scheduled Date": formatActivityDate(activity.scheduled_date),
    "Status": activity.completed ? "Completed" : "Pending",
    "Description": activity.description || activity.notes || "",
    "Location": activity.location || "",
  }));
}

export default function ActivityReports() {
  const [period, setPeriod] = useState("weekly");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getFarmingActivities("all");
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load farming activity reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const report = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start;
    let end;

    if (period === "weekly") {
      start = getWeekStart(today);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    const periodActivities = activities.filter((activity) =>
      isWithinRange(parseLocalDate(activity.scheduled_date), start, end)
    );

    const completed = periodActivities.filter((item) => item.completed).length;
    const pending = periodActivities.length - completed;
    const total = periodActivities.length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;

    const typeCounts = periodActivities.reduce((result, activity) => {
      const type = activity.activity_type || "Other";
      result[type] = (result[type] || 0) + 1;
      return result;
    }, {});

    const typeDistribution = Object.entries(typeCounts).sort(
      (a, b) => b[1] - a[1]
    );

    return {
      start,
      end,
      activities: periodActivities,
      total,
      completed,
      pending,
      percentage,
      typeDistribution,
    };
  }, [activities, period]);

  const periodLabel =
    period === "weekly"
      ? "This week (Monday–Sunday)"
      : "This month";

  const filePeriod = period === "weekly" ? "weekly" : "monthly";
  const fileDate = new Date().toISOString().slice(0, 10);

  const exportExcel = () => {
    setExportError("");

    try {
      const summaryRows = [
        { Metric: "Report period", Value: periodLabel },
        { Metric: "Start date", Value: formatDate(report.start) },
        { Metric: "End date", Value: formatDate(report.end) },
        { Metric: "Total tasks", Value: report.total },
        { Metric: "Completed tasks", Value: report.completed },
        { Metric: "Remaining tasks", Value: report.pending },
        { Metric: "Completion rate", Value: `${report.percentage}%` },
      ];

      const activityRows = getActivityRows(report.activities);
      const typeRows = report.typeDistribution.map(([type, count]) => ({
        "Activity Type": type,
        "Number of Tasks": count,
      }));

      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      const activitySheet = XLSX.utils.json_to_sheet(activityRows);
      const typeSheet = XLSX.utils.json_to_sheet(typeRows);

      summarySheet["!cols"] = [{ wch: 22 }, { wch: 30 }];
      activitySheet["!cols"] = [
        { wch: 10 },
        { wch: 28 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
        { wch: 36 },
        { wch: 22 },
      ];
      typeSheet["!cols"] = [{ wch: 22 }, { wch: 20 }];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Report Summary");
      XLSX.utils.book_append_sheet(workbook, activitySheet, "Activities");
      XLSX.utils.book_append_sheet(workbook, typeSheet, "Activity Types");

      XLSX.writeFile(workbook, `agriverse-${filePeriod}-report-${fileDate}.xlsx`);
    } catch (err) {
      setExportError(err.message || "Unable to export the Excel report.");
    }
  };

  const exportPDF = () => {
    setExportError("");

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const left = 15;
      const right = pageWidth - 15;
      let y = 18;

      const addPageIfNeeded = (requiredHeight = 10) => {
        if (y + requiredHeight > pageHeight - 15) {
          pdf.addPage();
          y = 18;
        }
      };

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(19);
      pdf.text("AgriVerse - Activity Report", left, y);
      y += 10;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(periodLabel, left, y);
      y += 6;
      pdf.text(
        `${formatDate(report.start)} - ${formatDate(report.end)}`,
        left,
        y
      );
      y += 12;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("Report Summary", left, y);
      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      [
        `Total tasks: ${report.total}`,
        `Completed tasks: ${report.completed}`,
        `Remaining tasks: ${report.pending}`,
        `Completion rate: ${report.percentage}%`,
      ].forEach((line) => {
        pdf.text(line, left, y);
        y += 6;
      });

      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("Activity Type Distribution", left, y);
      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      if (report.typeDistribution.length === 0) {
        pdf.text("No activity types for this period.", left, y);
        y += 6;
      } else {
        report.typeDistribution.forEach(([type, count]) => {
          addPageIfNeeded(7);
          pdf.text(`${type}: ${count}`, left, y);
          y += 6;
        });
      }

      y += 5;
      addPageIfNeeded(18);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("Activity Details", left, y);
      y += 8;

      // Simple text-based table; long descriptions wrap onto additional lines.
      const columns = [
        { label: "Activity", x: left, width: 52 },
        { label: "Type", x: 69, width: 32 },
        { label: "Date", x: 103, width: 31 },
        { label: "Status", x: 137, width: 25 },
      ];

      const drawTableHeader = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        columns.forEach((column) => pdf.text(column.label, column.x, y));
        y += 4;
        pdf.setLineWidth(0.3);
        pdf.line(left, y, right, y);
        y += 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
      };

      drawTableHeader();

      if (report.activities.length === 0) {
        pdf.text("No activities in this report period.", left, y);
      } else {
        report.activities.forEach((activity) => {
          const values = [
            getActivityName(activity),
            activity.activity_type || "Other",
            formatActivityDate(activity.scheduled_date),
            activity.completed ? "Completed" : "Pending",
          ];
          const wrapped = values.map((value, index) =>
            pdf.splitTextToSize(String(value), columns[index].width)
          );
          const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * 4 + 3;

          if (y + rowHeight > pageHeight - 15) {
            pdf.addPage();
            y = 18;
            drawTableHeader();
          }

          wrapped.forEach((lines, index) => {
            pdf.text(lines, columns[index].x, y);
          });
          y += rowHeight;
          pdf.setDrawColor(220);
          pdf.line(left, y - 2, right, y - 2);
        });
      }

      pdf.save(`agriverse-${filePeriod}-report-${fileDate}.pdf`);
    } catch (err) {
      setExportError(err.message || "Unable to export the PDF report.");
    }
  };

  return (
    <div className="activity-reports-page">
      <style>{`
        .activity-reports-page { color: var(--text-primary, inherit); }
        .report-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:22px; }
        .report-heading h1 { margin:0 0 7px; }
        .report-heading p { margin:0; color:var(--text-secondary, #64748b); }
        .report-controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .report-controls select, .report-controls button { padding:10px 13px; border:1px solid var(--border-color, #dbe3dc); border-radius:9px; background:var(--card-bg, #fff); color:inherit; cursor:pointer; }
        .report-controls button:disabled { opacity:.55; cursor:not-allowed; }
        .report-export-button { font-weight:600; }
        .report-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:20px; }
        .report-card, .report-panel { background:var(--card-bg, #fff); border:1px solid var(--border-color, #e2e8e2); border-radius:14px; padding:18px; }
        .report-card span { display:block; color:var(--text-secondary, #64748b); font-size:14px; margin-bottom:9px; }
        .report-card strong { display:block; font-size:28px; }
        .report-panels { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }
        .report-panel h2 { font-size:18px; margin:0 0 16px; }
        .report-progress-track { height:13px; border-radius:99px; background:#e5e7eb; overflow:hidden; }
        .report-progress-fill { height:100%; background:#16a34a; border-radius:99px; transition:width .2s ease; }
        .report-progress-caption { display:flex; justify-content:space-between; gap:10px; margin:12px 0 0; color:var(--text-secondary, #64748b); font-size:14px; }
        .report-type-row { display:grid; grid-template-columns:minmax(90px,1fr) 2fr 35px; gap:10px; align-items:center; margin:13px 0; font-size:14px; }
        .report-type-track { height:10px; background:#e5e7eb; border-radius:99px; overflow:hidden; }
        .report-type-fill { height:100%; background:#65a30d; border-radius:99px; }
        .report-muted { color:var(--text-secondary, #64748b); }
        .report-empty { padding:24px; text-align:center; color:var(--text-secondary, #64748b); background:var(--card-bg, #fff); border:1px dashed var(--border-color, #cbd5e1); border-radius:12px; }
        .report-export-error { color:#b91c1c; margin:10px 0; }
        @media(max-width:600px) { .report-type-row { grid-template-columns:85px 1fr 25px; gap:7px; } }
      `}</style>

      <div className="report-heading">
        <div>
          <p className="eyebrow">FARM MANAGEMENT</p>
          <h1>Activity Reports</h1>
          <p>Review your scheduled farming tasks and completion progress.</p>
        </div>

        <div className="report-controls">
          <select
            aria-label="Report period"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setExportError("");
            }}
          >
            <option value="weekly">Weekly report</option>
            <option value="monthly">Monthly report</option>
          </select>
          <button type="button" onClick={loadActivities} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh report"}
          </button>
          <button
            className="report-export-button"
            type="button"
            onClick={exportPDF}
            disabled={loading || report.total === 0}
          >
            Export PDF
          </button>
          <button
            className="report-export-button"
            type="button"
            onClick={exportExcel}
            disabled={loading || report.total === 0}
          >
            Export Excel
          </button>
        </div>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {exportError && <p className="report-export-error" role="alert">{exportError}</p>}

      {loading ? (
        <p>Loading activity report...</p>
      ) : (
        <>
          <p className="report-muted">
            {periodLabel}: {formatDate(report.start)} – {formatDate(report.end)}
          </p>

          <div className="report-grid">
            <section className="report-card">
              <span>Total tasks</span>
              <strong>{report.total}</strong>
            </section>
            <section className="report-card">
              <span>Completed tasks</span>
              <strong>{report.completed}</strong>
            </section>
            <section className="report-card">
              <span>Remaining tasks</span>
              <strong>{report.pending}</strong>
            </section>
            <section className="report-card">
              <span>Completion rate</span>
              <strong>{report.percentage}%</strong>
            </section>
          </div>

          {report.total === 0 ? (
            <div className="report-empty">
              <h3>No activities in this period</h3>
              <p>Add farming activities with dates in this week or month to see your report.</p>
            </div>
          ) : (
            <div className="report-panels">
              <section className="report-panel">
                <h2>Task completion</h2>
                <div className="report-progress-track" aria-label={`Completed ${report.percentage}%`}>
                  <div
                    className="report-progress-fill"
                    style={{ width: `${report.percentage}%` }}
                  />
                </div>
                <div className="report-progress-caption">
                  <span>{report.completed} completed</span>
                  <span>{report.pending} remaining</span>
                </div>
              </section>

              <section className="report-panel">
                <h2>Activity type distribution</h2>
                {report.typeDistribution.length === 0 ? (
                  <p className="report-muted">No activity types to display.</p>
                ) : (
                  report.typeDistribution.map(([type, count]) => (
                    <div className="report-type-row" key={type}>
                      <span>{type}</span>
                      <div className="report-type-track">
                        <div
                          className="report-type-fill"
                          style={{
                            width: `${(count / report.total) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  ))
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
