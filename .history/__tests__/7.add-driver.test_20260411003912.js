/**
 * Test 7: Add Driver
 * Tests adding a new driver to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 7 - Add Driver", () => {
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

  it("should add driver with valid data", async () => {
    const driverData = {
      name: "Test Driver " + Date.now(),
      email: `driver${Date.now()}@test.com`,
      phone: "9804040485",
      role: "driver",
      password: "Driver@1234",
      routeId: 1,
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toHaveProperty("user");
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    expect(response.status).toBe(201);
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    const data = await response.json();
    expect(data.user).toHaveProperty("id");
    expect(data.user.role).toBe("driver");
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    expect(response.status).not.toBe(201);
  });

  it("should require authorization", async () => {
    const driverData = {
      name: "Test Driver",
      email: `driver${Date.now()}@test.com`,
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
      email: `roletest${Date.now()}@test.com`,
      phone: "9840123456",
      role: "driver",
      password: "RoleTest@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(driverData),
    });

    const data = await response.json();
    expect(data.user.role).toBe("driver");
  });
});
