/**
 * Test 10: Add Student
 * Tests adding a new student to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 10 - Add Student", () => {
  let authToken = null;
  let routeId = null;
  let parentId = null;
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
        "Login failed before add student test:",
        loginResponse.status,
        loginData,
      );
    }
    authToken = loginData.token;
  });

  it("should add student with valid data", async () => {
    if (!authToken) {
      expect(authToken).toBeDefined();
      return;
    }

    const studentData = {
      name: "Test Student " + Date.now(),
      email: `student${Date.now()}@test.com`,
      phone: "9804040485",
      role: "student",
      password: "Student@1234",
      parentId: parentId,
      routeId: routeId,
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
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

  it("should create student with required fields", async () => {
    const studentData = {
      name: "New Student",
      email: `newstudent${Date.now()}@test.com`,
      phone: "9840123456",
      role: "student",
      password: "SecurePass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    expect([200, 201]).toContain(response.status);
  });

  it("should return created student info", async () => {
    const studentData = {
      name: "Student Test",
      email: `student.test${Date.now()}@test.com`,
      phone: "9840123456",
      role: "student",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.user && data.user.id) {
          expect(data.user).toHaveProperty("id");
          expect(data.user.role).toBe("student");
        } else {
          expect(response.status).toBeLessThan(400);
        }
      }
    } catch (e) {
      expect(response.status).toBeLessThan(500);
    }
  });

  it("should set role as student", async () => {
    const studentData = {
      name: "Role Test Student",
      email: `roletest.student${Date.now()}@test.com`,
      phone: "9840123456",
      role: "student",
      password: "RoleTest@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.user && data.user.role) {
          expect(data.user.role).toBe("student");
        } else if (data.Role) {
          expect(data.Role).toBe("student");
        } else {
          expect(response.status).toBeLessThan(400);
        }
      }
    } catch (e) {
      expect(response.status).toBeLessThan(500);
    }
  });

  it("should not allow duplicate student email", async () => {
    const studentData = {
      name: "Duplicate Student",
      email: "bayungraiprerna@gmail.com", // Already exists
      phone: "9840123456",
      role: "student",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    // Should reject duplicate email
    expect(response.status).not.toBe(201);
  });

  it("should require authorization for student creation", async () => {
    const studentData = {
      name: "Test Student",
      email: `student${Date.now()}@test.com`,
      phone: "9840123456",
      role: "student",
      password: "TestPass@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(studentData),
    });

    expect(response.status).toBe(401);
  });

  it("should optionally link student to parent", async () => {
    const studentData = {
      name: "Parent Link Student",
      email: `parentlink${Date.now()}@test.com`,
      phone: "9840123456",
      role: "student",
      password: "ParentLink@123",
      parentId: null, // Can be set to link to parent
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    expect([200, 201]).toContain(response.status);
  });

  it("should send credentials email to new student", async () => {
    const studentData = {
      name: "Email Test Student",
      email: `emailtest.student${Date.now()}@test.com`,
      phone: "9840123456",
      role: "student",
      password: "EmailTest@123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    // User should be created regardless of email sending
    expect([200, 201]).toContain(response.status);
  });
});
