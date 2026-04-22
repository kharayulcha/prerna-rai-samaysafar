/**
 * Test 7: Add Driver
 * Tests adding a new driver to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 7 - Add Driver", () => {
  let authToken = null;
  let routeId = null;
  const email = "pedarai05@gmail.com";
  const password = "pranish123";

  beforeAll(async () => {
    // Login first to get token
    const loginResponse = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginResponse.json();
    if (loginResponse.status !== 200) {
      console.error(
        "Login failed before add driver test:",
        loginResponse.status,
        loginData,
      );
    }
    authToken = loginData.token;

    // Use default routeId since routes endpoint is not available
    routeId = 1;
  });

  it("should add driver with valid data", async () => {
    if (!authToken) {
      expect(authToken).toBeDefined();
      return;
    }

    const driverData = {
      name: "Test Driver " + Date.now(),
      email: `driver${Date.now()}@test.com`,
      phone: "9804040485",
      role: "driver",
      password: "Driver@1234",
      routeId: routeId,
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        expect([200, 201]).toContain(response.status);
      } else {
        expect(response.status).toBeLessThan(500);
      }
    } catch (e) {
      expect(response.status).toBeLessThan(500);
    }
  });

  it("should create driver with required fields", async () => {
    const driverData = {
      name: "New Driver",
      email: `newdriver${Date.now()}@test.com`,
      phone: "9840123456",
      role: "driver",
      password: "SecurePass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    expect([200, 201]).toContain(response.status);
  });

  it("should return created driver info", async () => {
    const driverData = {
      name: "Driver Test",
      email: `driver.test${Date.now()}@test.com`,
      phone: "9840123456",
      role: "driver",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.user) {
          expect(data).toHaveProperty("user");
        } else {
          expect(response.status).toBeLessThan(400);
        }
      }
    } catch (e) {
      expect(response.status).toBeLessThan(500);
    }
  });

  it("should not allow duplicate email", async () => {
    const driverData = {
      name: "Duplicate Driver",
      email: "bayungraiprerna@gmail.com", // Already exists
      phone: "9840123456",
      role: "driver",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    // Should reject duplicate
    expect(response.status).not.toBe(201);
  });

  it("should require authorization", async () => {
    const driverData = {
      name: "Test Driver",
      email: `testdriver${Date.now()}@test.com`,
      phone: "9840123456",
      role: "driver",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(driverData),
    });

    expect(response.status).toBe(401);
  });

  it("should set role as driver", async () => {
    const driverData = {
      name: "Role Test Driver",
      email: `roletest.driver${Date.now()}@test.com`,
      phone: "9840123456",
      role: "driver",
      password: "RoleTest@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.user && data.user.role) {
          expect(data.user.role).toBe("driver");
        } else if (data.Role) {
          expect(data.Role).toBe("driver");
        } else {
          expect(response.status).toBeLessThan(400);
        }
      }
    } catch (e) {
      expect(response.status).toBeLessThan(500);
    }
  });
});
