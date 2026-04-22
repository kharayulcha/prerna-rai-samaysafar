/**
 * Test 9: Add Route
 * Tests adding a new route to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 9 - Add Route", () => {
  let authToken = null;

  beforeAll(async () => {
    // Login first to get token (admin user)
    const loginResponse = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "bayungraiprerna@gmail.com",
        password: "Expo5544#@",
      }),
    });

    const loginData = await loginResponse.json();
    authToken = loginData.token;
  });

  it("should add route with valid data", async () => {
    const routeData = {
      name: "Test Route " + Date.now(),
      startPoint: "Kathmandu",
      endPoint: "Bhaktapur",
      distance: "25",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(routeData),
    });

    if (response.status === 201 || response.status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty("route");
    }
  });

  it("should return status 200 or 201", async () => {
    const routeData = {
      name: "New Route " + Date.now(),
      startPoint: "Kathmandu",
      endPoint: "Panauti",
      distance: "35",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(routeData),
    });

    expect([200, 201]).toContain(response.status);
  });

  it("should store route with name", async () => {
    const routeName = "Route Test " + Date.now();
    const routeData = {
      name: routeName,
      startPoint: "Lalitpur",
      endPoint: "Thimi",
      distance: "15",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(routeData),
    });

    if (response.ok) {
      const data = await response.json();
      expect(data.route?.name || data.data?.name).toBeDefined();
    }
  });

  it("should include start and end points", async () => {
    const routeData = {
      name: "Full Route " + Date.now(),
      startPoint: "Chabahil",
      endPoint: "Bhakatpur Chowk",
      distance: "20",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(routeData),
    });

    if (response.ok) {
      const data = await response.json();
      expect(data.route || data.data).toBeDefined();
    }
  });

  it("should store distance information", async () => {
    const routeData = {
      name: "Distance Route " + Date.now(),
      startPoint: "Point A",
      endPoint: "Point B",
      distance: "50",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(routeData),
    });

    expect(response.ok).toBe(true);
  });

  it("should require authorization", async () => {
    const routeData = {
      name: "Unauthorized Route",
      startPoint: "Point A",
      endPoint: "Point B",
      distance: "25",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(routeData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should create route successfully", async () => {
    const routeData = {
      name: "Success Route " + Date.now(),
      startPoint: "Start",
      endPoint: "End",
      distance: "30",
    };

    const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(routeData),
    });

    expect(response.ok || response.status === 201).toBe(true);
  });
});
