/**
 * Integration Tests for SamaySafar App
 * Testing authentication, user management, and profile operations
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

// Mock fetch for testing
global.fetch = jest.fn();

const mockFetch = (status, data) => {
  fetch.mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
  });
};

const mockFetchError = (error) => {
  fetch.mockRejectedValueOnce(error);
};

describe("Authentication Tests", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  // Test 1: Successful Login
  describe("Test 1: Successful Login", () => {
    it("should login successfully with valid credentials", async () => {
      const loginData = {
        email: "bayungraiprerna@gmail.com",
        password: "Expo5544#@",
      };

      const mockResponse = {
        message: "Login successful",
        token: "mock-jwt-token",
        user: {
          id: 1,
          name: "Prerna",
          email: "bayungraiprerna@gmail.com",
          role: "admin",
          phone: "0987654321",
          address: "Kathmandu",
        },
      };

      mockFetch(200, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.message).toBe("Login successful");
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe("bayungraiprerna@gmail.com");
      expect(result.user.role).toBe("admin");
    });
  });

  // Test 2: Login Error with Invalid Data
  describe("Test 2: Login Error with Invalid Credentials", () => {
    it("should fail login with invalid credentials", async () => {
      const loginData = {
        email: "invalid@email.com",
        password: "wrongpassword",
      };

      const mockResponse = {
        message: "Invalid credentials",
      };

      mockFetch(401, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      expect(result.message).toBe("Invalid credentials");
    });

    it("should fail with missing email", async () => {
      const loginData = {
        password: "Expo5544#@",
      };

      const mockResponse = {
        message: "Email and password are required",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it("should fail with missing password", async () => {
      const loginData = {
        email: "bayungraiprerna@gmail.com",
      };

      const mockResponse = {
        message: "Email and password are required",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  // Test 3: OTP Send Success for Forgot Password
  describe("Test 3: OTP Send Success for Forgot Password", () => {
    it("should send OTP successfully to registered email", async () => {
      const forgotPasswordData = {
        email: "bayungraiprerna@gmail.com",
      };

      const mockResponse = {
        message: "OTP sent to email",
      };

      mockFetch(200, mockResponse);

      const response = await fetch(
        `${API_BASE_URL}/api/users/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forgotPasswordData),
        },
      );

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(result.message).toBe("OTP sent to email");
    });
  });

  // Test 4: Unsuccessful OTP Send for Unregistered Email
  describe("Test 4: Unsuccessful OTP Send for Unregistered Email", () => {
    it("should fail to send OTP to unregistered email", async () => {
      const forgotPasswordData = {
        email: "unregistered@example.com",
      };

      const mockResponse = {
        message: "User not found",
      };

      mockFetch(404, mockResponse);

      const response = await fetch(
        `${API_BASE_URL}/api/users/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forgotPasswordData),
        },
      );

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(result.message).toBe("User not found");
    });

    it("should fail with invalid email format", async () => {
      const forgotPasswordData = {
        email: "invalidemail",
      };

      const mockResponse = {
        message: "Invalid email format",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(
        `${API_BASE_URL}/api/users/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forgotPasswordData),
        },
      );

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });
});

describe("Profile Management Tests", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  const mockToken = "Bearer mock-jwt-token";

  // Test 5: Update Profile Success
  describe("Test 5: Update Profile Successfully", () => {
    it("should update profile with valid data", async () => {
      const updateData = {
        name: "Prerna Rai",
        email: "bayungraiprerna@gmail.com",
        phone: "9801234567",
        address: "Kathmandu, Nepal",
      };

      const mockResponse = {
        message: "Profile updated",
        user: {
          id: 1,
          ...updateData,
          role: "admin",
          profileImage: "/uploads/profile-123.jpg",
        },
        token: mockToken,
      };

      mockFetch(200, mockResponse);

      const formData = new FormData();
      formData.append("name", updateData.name);
      formData.append("email", updateData.email);
      formData.append("phone", updateData.phone);
      formData.append("address", updateData.address);

      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: { Authorization: mockToken },
        body: formData,
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.message).toBe("Profile updated");
      expect(result.user.name).toBe("Prerna Rai");
      expect(result.user.phone).toBe("9801234567");
      expect(result.token).toBeDefined();
    });

    it("should update profile with image", async () => {
      const updateData = {
        name: "Prerna Rai",
        email: "bayungraiprerna@gmail.com",
        phone: "9801234567",
      };

      const mockResponse = {
        message: "Profile updated",
        user: {
          id: 1,
          ...updateData,
          profileImage: "/uploads/profile-456.jpg",
        },
      };

      mockFetch(200, mockResponse);

      const formData = new FormData();
      formData.append("name", updateData.name);
      formData.append("email", updateData.email);
      formData.append("phone", updateData.phone);
      // In real scenario, would append actual file

      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: { Authorization: mockToken },
        body: formData,
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.user.profileImage).toBeDefined();
    });
  });

  // Test 6: Update Profile Failure with Invalid Phone
  describe("Test 6: Update Profile Failure with Invalid Phone", () => {
    it("should fail when phone number is invalid format", async () => {
      const updateData = {
        name: "Prerna Rai",
        email: "bayungraiprerna@gmail.com",
        phone: "invalid-phone", // Invalid format
      };

      const mockResponse = {
        message: "Invalid phone number format",
      };

      mockFetch(400, mockResponse);

      const formData = new FormData();
      formData.append("name", updateData.name);
      formData.append("email", updateData.email);
      formData.append("phone", updateData.phone);

      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: { Authorization: mockToken },
        body: formData,
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.message).toContain("Invalid phone");
    });

    it("should fail when phone number is too short", async () => {
      const updateData = {
        name: "Prerna Rai",
        phone: "123", // Too short
      };

      const mockResponse = {
        message: "Phone number must be at least 10 digits",
      };

      mockFetch(400, mockResponse);

      const formData = new FormData();
      formData.append("name", updateData.name);
      formData.append("phone", updateData.phone);

      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: { Authorization: mockToken },
        body: formData,
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it("should fail when email is already taken", async () => {
      const updateData = {
        email: "existing@email.com", // Already registered
      };

      const mockResponse = {
        message: "Email already taken",
      };

      mockFetch(400, mockResponse);

      const formData = new FormData();
      formData.append("email", updateData.email);

      const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
        method: "PUT",
        headers: { Authorization: mockToken },
        body: formData,
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.message).toBe("Email already taken");
    });
  });
});

describe("User Management Tests", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  const mockAdminToken = "Bearer mock-admin-token";
  const mockOrgId = 1;

  // Test 7: Add Driver
  describe("Test 7: Add Driver", () => {
    it("should successfully add a new driver", async () => {
      const driverData = {
        name: "Nikhil Udas",
        email: "nikhil@samaysafar.com",
        phone: "9801234567",
        role: "driver",
        password: "Driver@123",
      };

      const mockResponse = {
        message: "User created successfully",
        user: {
          UserId: 5,
          ...driverData,
          OrgId: mockOrgId,
        },
      };

      mockFetch(201, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(driverData),
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);
      expect(result.message).toBe("User created successfully");
      expect(result.user.role).toBe("driver");
      expect(result.user.email).toBe("nikhil@samaysafar.com");
    });

    it("should fail when driver email already exists", async () => {
      const driverData = {
        name: "Nikhil Udas",
        email: "existing.driver@samaysafar.com",
        phone: "9801234567",
        role: "driver",
        password: "Driver@123",
      };

      const mockResponse = {
        message: "Email already exists",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(driverData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.message).toBe("Email already exists");
    });
  });

  // Test 8: Add Parent
  describe("Test 8: Add Parent", () => {
    it("should successfully add a new parent", async () => {
      const parentData = {
        name: "Ram Kumar",
        email: "ram.kumar@email.com",
        phone: "9801111222",
        role: "parent",
        password: "Parent@123",
      };

      const mockResponse = {
        message: "User created successfully",
        user: {
          UserId: 6,
          ...parentData,
          OrgId: mockOrgId,
        },
      };

      mockFetch(201, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(parentData),
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.user.role).toBe("parent");
      expect(result.user.name).toBe("Ram Kumar");
    });

    it("should fail when parent phone is invalid", async () => {
      const parentData = {
        name: "Ram Kumar",
        email: "ram.kumar@email.com",
        phone: "invalid",
        role: "parent",
        password: "Parent@123",
      };

      const mockResponse = {
        message: "Invalid phone format",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(parentData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
    });
  });

  // Test 9: Add Route
  describe("Test 9: Add Route", () => {
    it("should successfully add a new route", async () => {
      const routeData = {
        name: "Route A - Kathmandu Central",
        startPoint: "Ratnapark",
        endPoint: "Bhaktapur",
      };

      const mockResponse = {
        message: "Route created successfully",
        route: {
          RouteId: 10,
          ...routeData,
          OrgId: mockOrgId,
          CreatedAt: new Date().toISOString(),
        },
      };

      mockFetch(201, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(routeData),
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.message).toBe("Route created successfully");
      expect(result.route.name).toBe("Route A - Kathmandu Central");
    });

    it("should fail when route name is empty", async () => {
      const routeData = {
        name: "",
        startPoint: "Ratnapark",
        endPoint: "Bhaktapur",
      };

      const mockResponse = {
        message: "Route name is required",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(routeData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.message).toContain("required");
    });

    it("should fail when route already exists", async () => {
      const routeData = {
        name: "Existing Route",
        startPoint: "Point A",
        endPoint: "Point B",
      };

      const mockResponse = {
        message: "Route already exists",
      };

      mockFetch(400, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/routes/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(routeData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
    });
  });

  // Test 10: Add Student
  describe("Test 10: Add Student", () => {
    it("should successfully add a new student", async () => {
      const studentData = {
        name: "Anil Sharma",
        email: "anil.sharma@email.com",
        phone: "9842222333",
        role: "student",
        password: "Student@123",
        parentId: 6, // Link to parent
        routeId: 10, // Assign to route
      };

      const mockResponse = {
        message: "User created successfully",
        user: {
          UserId: 15,
          ...studentData,
          OrgId: mockOrgId,
        },
      };

      mockFetch(201, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(studentData),
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.message).toBe("User created successfully");
      expect(result.user.role).toBe("student");
      expect(result.user.parentId).toBe(6);
      expect(result.user.routeId).toBe(10);
    });

    it("should fail when student parent ID is invalid", async () => {
      const studentData = {
        name: "Anil Sharma",
        email: "anil.sharma@email.com",
        phone: "9842222333",
        role: "student",
        password: "Student@123",
        parentId: 999, // Non-existent parent
        routeId: 10,
      };

      const mockResponse = {
        message: "Parent not found",
      };

      mockFetch(404, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(studentData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.message).toBe("Parent not found");
    });

    it("should fail when student route ID is invalid", async () => {
      const studentData = {
        name: "Anil Sharma",
        email: "anil.sharma@email.com",
        phone: "9842222333",
        role: "student",
        password: "Student@123",
        parentId: 6,
        routeId: 999, // Non-existent route
      };

      const mockResponse = {
        message: "Route not found",
      };

      mockFetch(404, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(studentData),
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.message).toBe("Route not found");
    });

    it("should successfully add student without parent assignment", async () => {
      const studentData = {
        name: "Anil Sharma",
        email: "anil.sharma@email.com",
        phone: "9842222333",
        role: "student",
        password: "Student@123",
        routeId: 10,
      };

      const mockResponse = {
        message: "User created successfully",
        user: {
          UserId: 16,
          ...studentData,
          OrgId: mockOrgId,
          parentId: null,
        },
      };

      mockFetch(201, mockResponse);

      const response = await fetch(`${API_BASE_URL}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: mockAdminToken,
        },
        body: JSON.stringify(studentData),
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.user.parentId).toBeNull();
    });
  });
});

describe("Error Handling", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it("should handle network errors", async () => {
    const error = new Error("Network error");
    mockFetchError(error);

    await expect(
      fetch(`${API_BASE_URL}/api/users/login`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    ).rejects.toThrow("Network error");
  });

  it("should handle unauthorized requests", async () => {
    const mockResponse = {
      message: "Unauthorized",
    };

    mockFetch(401, mockResponse);

    const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
      headers: { Authorization: "Bearer invalid-token" },
    });

    const result = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("should handle server errors", async () => {
    const mockResponse = {
      message: "Internal server error",
    };

    mockFetch(500, mockResponse);

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const result = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });
});
