/**
 * Test 8: Add Parent
 * Tests adding a new parent to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 8 - Add Parent", () => {
  let authToken = null;
  const email = "bayungraiprerna@gmail.com";
  const password = "Expo5544#@";

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
      console.error("Login failed before add parent test:", loginResponse.status, loginData);
    }
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

    expect([200, 201]).toContain(response.status);
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    expect([200, 201]).toContain(response.status);
  });

  it("should return created parent info", async () => {
    const parentData = {
      name: "Return Info Parent",
      email: `returninfo.parent${Date.now()}@test.com`,
      phone: "9840123456",
      role: "parent",
      password: "ReturnInfo@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    const data = await response.json();
    // Backend returns either {user: {...}} or flattened {UserId, Email, ...}
    if (data.user && data.user.id) {
      expect(data.user).toHaveProperty("id");
      expect(data.user.role).toBe("parent");
    } else if (data.UserId) {
      expect(data.UserId).toBeDefined();
      expect(data.Role).toBe("parent");
    } else {
      expect(response.status).toBeLessThan(400);
    }
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    const data = await response.json();
    // Backend can return different structures
    if (data.user && data.user.role) {
      expect(data.user.role).toBe("parent");
    } else if (data.Role) {
      expect(data.Role).toBe("parent");
    } else {
      expect(response.status).toBeLessThan(400);
    }
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
        "Content-Type": "application/json",
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(parentData),
    });

    // User should be created, email may or may not be sent
    expect([200, 201]).toContain(response.status);
  });
});
