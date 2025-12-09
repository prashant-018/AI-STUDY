// Use relative URL when proxied through Next.js, or absolute URL for direct calls
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Token management (fallback, but cookies are primary)
function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

function saveAuthToken(token) {
  if (typeof window !== "undefined" && token) {
    localStorage.setItem("token", token);
  }
}

function removeAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

async function apiFetch(path, options = {}) {
  const token = getAuthToken();

  // Use relative path when BASE_URL is empty (Next.js proxy)
  // Use absolute URL when BASE_URL is set (direct backend calls)
  const url = BASE_URL ? `${BASE_URL}${path}` : path;

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    credentials: "include",
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  let data;
  let responseText = "";
  try {
    responseText = await response.text();
    if (responseText) {
      data = JSON.parse(responseText);
    } else {
      data = null;
    }
  } catch (_error) {
    // If JSON parsing fails, try to extract error from text
    data = null;
    if (responseText) {
      // Try to extract error message from HTML or plain text
      const errorMatch = responseText.match(/error["\s:]+([^"<]+)/i);
      if (errorMatch) {
        data = { error: errorMatch[1] };
      }
    }
  }

  if (!response.ok) {
    // Clear token on 401
    if (response.status === 401) {
      removeAuthToken();
    }

    let errorMessage = `Request failed with status ${response.status}`;
    if (data?.error) {
      errorMessage = data.error;
    } else if (data?.message) {
      errorMessage = data.message;
    } else if (
      data?.errors &&
      Array.isArray(data.errors) &&
      data.errors.length > 0
    ) {
      errorMessage = data.errors[0].message || data.errors[0];
    } else if (data?.details) {
      errorMessage = data.details;
    } else if (response.status === 500) {
      errorMessage =
        "Server error occurred. Please check the backend logs or try again later.";
    } else if (response.status === 404) {
      errorMessage = "The requested resource was not found.";
    } else if (response.status === 403) {
      errorMessage = "You do not have permission to access this resource.";
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authApi = {
  async register(payload) {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data?.token) {
      saveAuthToken(data.token);
    }
    return data;
  },
  async login(payload) {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data?.token) {
      saveAuthToken(data.token);
    }
    return data;
  },
  me() {
    return apiFetch("/api/auth/me", {
      method: "GET",
    });
  },
  async logout() {
    const data = await apiFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    removeAuthToken();
    return data;
  },
};

export const dashboardApi = {
  getMetrics() {
    return apiFetch("/api/dashboard/metrics", { method: "GET" });
  },
  getRecentActivity(limit = 10, tab = "recent") {
    const params = new URLSearchParams({ limit: String(limit), tab });
    return apiFetch(`/api/dashboard/recent-activity?${params.toString()}`, {
      method: "GET",
    });
  },
  getWeeklyPerformance() {
    return apiFetch("/api/dashboard/weekly-performance", { method: "GET" });
  },
  getUpcomingSessions() {
    return apiFetch("/api/dashboard/upcoming-sessions", { method: "GET" });
  },
};

export const activityApi = {
  getRecent(limit = 5) {
    const params = new URLSearchParams({ limit: String(limit) });
    return apiFetch(`/api/activity?${params.toString()}`, {
      method: "GET",
    });
  },
  getStreak() {
    return apiFetch("/api/activity/streak", {
      method: "GET",
    });
  },
  getPerformance() {
    return apiFetch("/api/activity/performance", {
      method: "GET",
    });
  },
};

export { saveAuthToken, removeAuthToken, getAuthToken };
export default apiFetch;
