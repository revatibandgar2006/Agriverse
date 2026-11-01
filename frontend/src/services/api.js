const API_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "agriverse_token";

// --------------------------------------------------
// COMMON API REQUEST HANDLER
// --------------------------------------------------

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    ...options.headers,
  };

  // Set JSON content type only for JSON request bodies.
  // URLSearchParams must use application/x-www-form-urlencoded.
  if (
    options.body &&
    !(options.body instanceof URLSearchParams) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  // Attach JWT token to protected API requests.
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

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    const text = await response.text();
    data = text ? { detail: text } : null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    if (response.status === 401) {
      throw new Error(
        typeof message === "string"
          ? `${message}. Please log in again if your session has expired.`
          : JSON.stringify(message)
      );
    }

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  return data;
}

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

export async function login(email, password) {
  const formData = new URLSearchParams();

  // FastAPI OAuth2PasswordRequestForm expects "username".
  // In AgriVerse, the username field contains the user's email.
  formData.set("username", email);
  formData.set("password", password);

  const data = await apiRequest("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  if (!data?.access_token) {
    throw new Error("Login response did not contain an access token.");
  }

  localStorage.setItem(TOKEN_KEY, data.access_token);

  return data;
}

export function register(username, email, password) {
  return apiRequest("/register", {
    method: "POST",
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

// --------------------------------------------------
// USER PROFILE
// --------------------------------------------------

export function getMyProfile() {
  return apiRequest("/users/me");
}

// --------------------------------------------------
// FARMER CRUD
// --------------------------------------------------

export function getFarmers() {
  return apiRequest("/farmers");
}

export function getFarmerById(farmerId) {
  return apiRequest(`/farmers/${farmerId}`);
}

export function createFarmer(farmerData) {
  return apiRequest("/farmers", {
    method: "POST",
    body: JSON.stringify(farmerData),
  });
}

export function updateFarmer(farmerId, farmerData) {
  return apiRequest(`/farmers/${farmerId}`, {
    method: "PUT",
    body: JSON.stringify(farmerData),
  });
}

export function deleteFarmer(farmerId) {
  return apiRequest(`/farmers/${farmerId}`, {
    method: "DELETE",
  });
}

// --------------------------------------------------
// DASHBOARD ANALYTICS
// --------------------------------------------------

export function getDashboardAnalytics() {
  return apiRequest("/analytics/dashboard");
}

// --------------------------------------------------
// WEATHER
// --------------------------------------------------

export function getWeather(location) {
  const trimmedLocation = location?.trim();

  if (!trimmedLocation || trimmedLocation.length < 2) {
    return Promise.reject(
      new Error("Please enter a valid village, town, or city name.")
    );
  }

  const query = encodeURIComponent(trimmedLocation);

  // apiRequest automatically attaches the saved JWT token.
  return apiRequest(`/weather?location=${query}`);
}

// --------------------------------------------------
// CROP RECOMMENDATION
// --------------------------------------------------

export function getCropRecommendation(cropData) {
  return apiRequest("/crop-recommendation/recommend", {
    method: "POST",
    body: JSON.stringify(cropData),
  });
}




/* ==========================================
   FARMING ACTIVITY PLANNER
   ========================================== */

export function getFarmingActivities(status = "all") {
  const query = new URLSearchParams({ activity_status: status });
  return apiRequest(`/farming-activities?${query.toString()}`);
}

export function createFarmingActivity(activityData) {
  return apiRequest("/farming-activities", {
    method: "POST",
    body: JSON.stringify(activityData),
  });
}

export function updateFarmingActivity(activityId, activityData) {
  return apiRequest(`/farming-activities/${activityId}`, {
    method: "PUT",
    body: JSON.stringify(activityData),
  });
}

export function updateFarmingActivityStatus(activityId, completed) {
  return apiRequest(`/farming-activities/${activityId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export function deleteFarmingActivity(activityId) {
  return apiRequest(`/farming-activities/${activityId}`, {
    method: "DELETE",
  });
}
