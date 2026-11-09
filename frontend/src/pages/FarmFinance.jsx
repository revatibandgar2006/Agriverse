
import { useEffect, useState } from "react";
import {
  getFarmFinanceSummary,
  getFarmExpenses,
  createFarmExpense,
  updateFarmExpense,
  deleteFarmExpense,
  getFarmIncome,
  createFarmIncome,
  updateFarmIncome,
  deleteFarmIncome,
} from "../services/api";

import "./FarmFinance.css";

const emptyExpense = {
  crop_name: "",
  category: "Seeds",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  description: "",
};

const emptyIncome = {
  crop_name: "",
  quantity: "",
  unit: "kg",
  selling_price: "",
  sale_date: new Date().toISOString().slice(0, 10),
  buyer_name: "",
  description: "",
};

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export default function FarmFinance() {
  const [summary, setSummary] = useState({
    total_income: 0,
    total_expenses: 0,
    profit: 0,
    status: "Profit",
    crop_analysis: [],
  });

  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);

  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [incomeForm, setIncomeForm] = useState(emptyIncome);

  const [editingExpense, setEditingExpense] = useState(null);
  const [editingIncome, setEditingIncome] = useState(null);

  const [activeTab, setActiveTab] = useState("expense");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadFinanceData() {
    try {
      setLoading(true);
      setError("");

      const [summaryData, expenseData, incomeData] = await Promise.all([
        getFarmFinanceSummary(),
        getFarmExpenses(),
        getFarmIncome(),
      ]);

      setSummary(summaryData);
      setExpenses(expenseData);
      setIncome(incomeData);
    } catch (err) {
      setError(err.message || "Unable to load financial data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinanceData();
  }, []);

  function resetExpenseForm() {
    setExpenseForm(emptyExpense);
    setEditingExpense(null);
  }

  function resetIncomeForm() {
    setIncomeForm(emptyIncome);
    setEditingIncome(null);
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
      };

      if (editingExpense !== null) {
        await updateFarmExpense(editingExpense, payload);
      } else {
        await createFarmExpense(payload);
      }

      resetExpenseForm();
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function handleIncomeSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...incomeForm,
        quantity: Number(incomeForm.quantity),
        selling_price: Number(incomeForm.selling_price),
      };

      if (editingIncome !== null) {
        await updateFarmIncome(editingIncome, payload);
      } else {
        await createFarmIncome(payload);
      }

      resetIncomeForm();
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Unable to save income.");
    } finally {
      setSaving(false);
    }
  }

  function startEditExpense(item) {
    setExpenseForm({
      crop_name: item.crop_name,
      category: item.category,
      amount: String(item.amount),
      expense_date: item.expense_date,
      description: item.description || "",
    });

    setEditingExpense(item.id);
    setActiveTab("expense");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditIncome(item) {
    setIncomeForm({
      crop_name: item.crop_name,
      quantity: String(item.quantity),
      unit: item.unit,
      selling_price: String(item.selling_price),
      sale_date: item.sale_date,
      buyer_name: item.buyer_name || "",
      description: item.description || "",
    });

    setEditingIncome(item.id);
    setActiveTab("income");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteExpense(id) {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      await deleteFarmExpense(id);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Unable to delete expense.");
    }
  }

  async function handleDeleteIncome(id) {
    if (!window.confirm("Are you sure you want to delete this income?")) {
      return;
    }

    try {
      await deleteFarmIncome(id);
      await loadFinanceData();
    } catch (err) {
      setError(err.message || "Unable to delete income.");
    }
  }

  const calculatedSale =
    Number(incomeForm.quantity || 0) *
    Number(incomeForm.selling_price || 0);

  if (loading) {
    return (
      <div className="finance-loading">
        Loading farm finance details...
      </div>
    );
  }

  return (
    <div className="finance-page">
      <div className="finance-header">
        <div>
          <h1>Farm Finance Management</h1>
          <p>Track your farming expenses, crop sales and profits.</p>
        </div>

        <button className="finance-refresh" onClick={loadFinanceData}>
          ↻ Refresh
        </button>
      </div>

      {error && <div className="finance-error">{error}</div>}

      <div className="finance-summary-grid">
        <div className="finance-summary-card income-card">
          <span>Total Income</span>
          <h2>{money(summary.total_income)}</h2>
          <p>Money earned from crop sales</p>
        </div>

        <div className="finance-summary-card expense-card">
          <span>Total Expenses</span>
          <h2>{money(summary.total_expenses)}</h2>
          <p>Total farming expenditure</p>
        </div>

        <div className="finance-summary-card profit-card">
          <span>{summary.status}</span>
          <h2>{money(Math.abs(summary.profit))}</h2>
          <p>
            {summary.profit >= 0
              ? "Your farming business is profitable"
              : "Your farming business is at a loss"}
          </p>
        </div>
      </div>

      <div className="finance-section">
        <h2>Manage Transactions</h2>

        <div className="finance-tabs">
          <button
            className={activeTab === "expense" ? "active" : ""}
            onClick={() => setActiveTab("expense")}
          >
            Add Expense
          </button>

          <button
            className={activeTab === "income" ? "active" : ""}
            onClick={() => setActiveTab("income")}
          >
            Add Income
          </button>
        </div>

        {activeTab === "expense" && (
          <form className="finance-form" onSubmit={handleExpenseSubmit}>
            <h3>{editingExpense ? "Update Expense" : "Record New Expense"}</h3>

            <div className="finance-form-grid">
              <label>
                Crop Name *
                <input
                  required
                  value={expenseForm.crop_name}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      crop_name: e.target.value,
                    })
                  }
                  placeholder="Example: Sugarcane"
                />
              </label>

              <label>
                Expense Category *
                <select
                  value={expenseForm.category}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      category: e.target.value,
                    })
                  }
                >
                  <option>Seeds</option>
                  <option>Fertilizer</option>
                  <option>Pesticides</option>
                  <option>Labor</option>
                  <option>Irrigation</option>
                  <option>Machinery</option>
                  <option>Transportation</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Amount (₹) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      amount: e.target.value,
                    })
                  }
                  placeholder="Enter amount"
                />
              </label>

              <label>
                Expense Date *
                <input
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      expense_date: e.target.value,
                    })
                  }
                />
              </label>

              <label className="finance-full-width">
                Description
                <textarea
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Additional details..."
                />
              </label>
            </div>

            <div className="finance-form-actions">
              <button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingExpense
                  ? "Update Expense"
                  : "Save Expense"}
              </button>

              {editingExpense !== null && (
                <button
                  type="button"
                  className="finance-cancel"
                  onClick={resetExpenseForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {activeTab === "income" && (
          <form className="finance-form" onSubmit={handleIncomeSubmit}>
            <h3>{editingIncome ? "Update Income" : "Record Crop Sale"}</h3>

            <div className="finance-form-grid">
              <label>
                Crop Name *
                <input
                  required
                  value={incomeForm.crop_name}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      crop_name: e.target.value,
                    })
                  }
                  placeholder="Example: Wheat"
                />
              </label>

              <label>
                Quantity *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={incomeForm.quantity}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      quantity: e.target.value,
                    })
                  }
                  placeholder="Enter quantity"
                />
              </label>

              <label>
                Unit *
                <select
                  value={incomeForm.unit}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      unit: e.target.value,
                    })
                  }
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="quintal">Quintal</option>
                  <option value="ton">Ton</option>
                  <option value="bag">Bag</option>
                </select>
              </label>

              <label>
                Selling Price per Unit (₹) *
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={incomeForm.selling_price}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      selling_price: e.target.value,
                    })
                  }
                  placeholder="Enter selling price"
                />
              </label>

              <label>
                Sale Date *
                <input
                  type="date"
                  required
                  value={incomeForm.sale_date}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      sale_date: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Buyer Name
                <input
                  value={incomeForm.buyer_name}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      buyer_name: e.target.value,
                    })
                  }
                  placeholder="Enter buyer name"
                />
              </label>

              <label className="finance-full-width">
                Description
                <textarea
                  value={incomeForm.description}
                  onChange={(e) =>
                    setIncomeForm({
                      ...incomeForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Additional details..."
                />
              </label>
            </div>

            <div className="finance-calculation">
              Estimated Sale Amount: <strong>{money(calculatedSale)}</strong>
            </div>

            <div className="finance-form-actions">
              <button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingIncome
                  ? "Update Income"
                  : "Save Income"}
              </button>

              {editingIncome !== null && (
                <button
                  type="button"
                  className="finance-cancel"
                  onClick={resetIncomeForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="finance-section">
        <h2>Expense History</h2>

        <div className="finance-table-wrapper">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="finance-empty">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((item) => (
                  <tr key={item.id}>
                    <td>{item.crop_name}</td>
                    <td>{item.category}</td>
                    <td>{money(item.amount)}</td>
                    <td>{item.expense_date}</td>
                    <td>{item.description || "-"}</td>
                    <td>
                      <div className="finance-actions">
                        <button onClick={() => startEditExpense(item)}>
                          Edit
                        </button>
                        <button
                          className="delete"
                          onClick={() => handleDeleteExpense(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="finance-section">
        <h2>Income History</h2>

        <div className="finance-table-wrapper">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Quantity</th>
                <th>Price / Unit</th>
                <th>Total Amount</th>
                <th>Sale Date</th>
                <th>Buyer</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {income.length === 0 ? (
                <tr>
                  <td colSpan="7" className="finance-empty">
                    No income records yet.
                  </td>
                </tr>
              ) : (
                income.map((item) => (
                  <tr key={item.id}>
                    <td>{item.crop_name}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>{money(item.selling_price)}</td>
                    <td>{money(item.total_amount)}</td>
                    <td>{item.sale_date}</td>
                    <td>{item.buyer_name || "-"}</td>
                    <td>
                      <div className="finance-actions">
                        <button onClick={() => startEditIncome(item)}>
                          Edit
                        </button>
                        <button
                          className="delete"
                          onClick={() => handleDeleteIncome(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="finance-section">
        <h2>Crop-wise Financial Analysis</h2>

        <div className="finance-table-wrapper">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Crop Name</th>
                <th>Total Income</th>
                <th>Total Expenses</th>
                <th>Profit / Loss</th>
              </tr>
            </thead>

            <tbody>
              {summary.crop_analysis.length === 0 ? (
                <tr>
                  <td colSpan="4" className="finance-empty">
                    Add income and expenses to see crop-wise analysis.
                  </td>
                </tr>
              ) : (
                summary.crop_analysis.map((crop) => (
                  <tr key={crop.crop_name}>
                    <td>{crop.crop_name}</td>
                    <td>{money(crop.total_income)}</td>
                    <td>{money(crop.total_expenses)}</td>
                    <td
                      className={
                        crop.profit >= 0
                          ? "finance-positive"
                          : "finance-negative"
                      }
                    >
                      {money(crop.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
