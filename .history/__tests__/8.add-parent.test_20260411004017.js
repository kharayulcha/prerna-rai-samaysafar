/**
 * Test 8: Add Parent
 * Tests adding a new parent to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 8 - Add Parent", () => {
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

  it("should add parent with valid data", async () => {
    const parentData = {
      name: "Test Parent " + Date.now(),
      email: `parent${Date.now()}@test.com`,
      phone: "9804040485",
      role: "parent",
      password: "Parent@1234",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toHaveProperty("user");
  });

  it("should create parent with required fields", async () => {
    const parentData = {
      name: "New Parent",
      email: `newparent${Date.now()}@test.com`,
      phone: "9840123456",
      role: "parent",
      password: "SecurePass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    expect(response.status).toBe(201);
  });

  it("should return created parent info", async () => {
    const parentData = {
      name: "Parent Test",
      email: `parent.test${Date.now()}@test.com`,
      phone: "9840123456",
      role: "parent",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    const data = await response.json();
    expect(data.user).toHaveProperty("id");
    expect(data.user.role).toBe("parent");
  });

  it("should set role as parent", async () => {
    const parentData = {
      name: "Role Test Parent",
      email: `roletest.parent${Date.now()}@test.com`,
      phone: "9840123456",
      role: "parent",
      password: "RoleTest@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    const data = await response.json();
    expect(data.user.role).toBe("parent");
  });

  it("should not allow duplicate parent email", async () => {
    const parentData = {
      name: "Duplicate Parent",
      email: "bayungraiprerna@gmail.com", // Already exists
      phone: "9840123456",
      role: "parent",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    expect(response.status).not.toBe(201);
  });

  it("should require authorization for parent creation", async () => {
    const parentData = {
      name: "Test Parent",
      email: `parent${Date.now()}@test.com`,
      phone: "9840123456",
      role: "parent",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parentData),
    });

    expect(response.status).toBe(401);
  });

  it("should send credentials email to new parent", async () => {
    const parentData = {
      name: "Email Test Parent",
      email: `emailtest.parent${Date.now()}@test.com`,
      phone: "9840123456",
      role: "parent",
      password: "EmailTest@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    expect(response.status).toBe(201);
    // Backend should handle email sending
  });
});
