const API_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "agriverse_token";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...(options.headers || {}) };

  if (
    options.body &&
    !(options.body instanceof URLSearchParams) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Cannot connect to AgriVerse backend. Make sure FastAPI is running at http://127.0.0.1:8000."
    );
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    const responseText = await response.text();
    data = responseText ? { detail: responseText } : null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    if (response.status === 401) {
      throw new Error(
        typeof message === "string"
          ? `${message} Please log in again if your session has expired.`
          : JSON.stringify(message)
      );
    }

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  return data;
}

// AUTHENTICATION
export async function login(email, password) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const data = await apiRequest("/login", {
    method: "POST",
    body: formData,
  });

  if (data?.access_token) {
    localStorage.setItem(TOKEN_KEY, data.access_token);
  }

  return data;
}

export async function register(userData) {
  return apiRequest("/register", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

// PROFILE
export async function getMyProfile() {
  return apiRequest("/users/me");
}

// FARMERS
export async function getFarmers() {
  return apiRequest("/farmers");
}

export async function getFarmerById(id) {
  return apiRequest(`/farmers/${id}`);
}

export async function createFarmer(farmerData) {
  return apiRequest("/farmers", {
    method: "POST",
    body: JSON.stringify(farmerData),
  });
}

export async function updateFarmer(id, farmerData) {
  return apiRequest(`/farmers/${id}`, {
    method: "PUT",
    body: JSON.stringify(farmerData),
  });
}

export async function deleteFarmer(id) {
  return apiRequest(`/farmers/${id}`, { method: "DELETE" });
}

// DASHBOARD
export async function getDashboardAnalytics() {
  return apiRequest("/analytics/dashboard");
}

// WEATHER
export async function getWeather(location) {
  const cleanLocation = String(location || "").trim();

  if (!cleanLocation) {
    throw new Error("Please enter a location.");
  }

  return apiRequest(`/weather?location=${encodeURIComponent(cleanLocation)}`);
}

// CROP RECOMMENDATION
export async function getCropRecommendation(cropData) {
  return apiRequest("/crop-recommendation", {
    method: "POST",
    body: JSON.stringify(cropData),
  });
}

// FARMING ACTIVITIES
export async function getFarmingActivities(status = "all") {
  return apiRequest(
    `/farming-activities?status=${encodeURIComponent(status)}`
  );
}

export async function createFarmingActivity(activityData) {
  return apiRequest("/farming-activities", {
    method: "POST",
    body: JSON.stringify(activityData),
  });
}

export async function updateFarmingActivity(id, activityData) {
  return apiRequest(`/farming-activities/${id}`, {
    method: "PUT",
    body: JSON.stringify(activityData),
  });
}

export async function updateFarmingActivityStatus(id, completed) {
  return apiRequest(`/farming-activities/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export async function deleteFarmingActivity(id) {
  return apiRequest(`/farming-activities/${id}`, { method: "DELETE" });
}

// FARM FINANCE
export async function getFarmFinanceSummary() {
  return apiRequest("/farm-finance/summary");
}

export async function getFarmExpenses() {
  return apiRequest("/farm-finance/expenses");
}

export async function createFarmExpense(expenseData) {
  return apiRequest("/farm-finance/expenses", {
    method: "POST",
    body: JSON.stringify(expenseData),
  });
}

export async function updateFarmExpense(id, expenseData) {
  return apiRequest(`/farm-finance/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(expenseData),
  });
}

export async function deleteFarmExpense(id) {
  return apiRequest(`/farm-finance/expenses/${id}`, { method: "DELETE" });
}

export async function getFarmIncome() {
  return apiRequest("/farm-finance/income");
}

export async function createFarmIncome(incomeData) {
  return apiRequest("/farm-finance/income", {
    method: "POST",
    body: JSON.stringify(incomeData),
  });
}

export async function updateFarmIncome(id, incomeData) {
  return apiRequest(`/farm-finance/income/${id}`, {
    method: "PUT",
    body: JSON.stringify(incomeData),
  });
}

export async function deleteFarmIncome(id) {
  return apiRequest(`/farm-finance/income/${id}`, { method: "DELETE" });
}