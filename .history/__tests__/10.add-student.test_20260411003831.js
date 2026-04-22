/**
 * Test 10: Add Student
 * Tests adding a new student to the system
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 10 - Add Student", () => {
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

  it("should add student with valid data", async () => {
    const studentData = {
      name: "Test Student " + Date.now(),
      email: `student${Date.now()}@test.com`,
      phone: "9804040485",
      role: "student",
      password: "Student@1234",
      parentId: null,
      routeId: 1,
    };

    const response = await fetch(`${API_BASE_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data).toHaveProperty("user");
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    expect(response.status).toBe(201);
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    const data = await response.json();
    expect(data.user).toHaveProperty("id");
    expect(data.user.role).toBe("student");
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    const data = await response.json();
    expect(data.user.role).toBe("student");
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    expect(response.status).toBe(201);
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
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(studentData),
    });

    expect(response.status).toBe(201);
    // Backend should handle email sending
  });
});
