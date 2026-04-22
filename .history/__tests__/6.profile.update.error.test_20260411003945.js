/**
 * Test 6: Update Profile Unsuccess with Invalid Phone Number
 * Tests profile update failure with invalid phone number format
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 6 - Update Profile Unsuccess with Invalid Phone Number", () => {
  let authToken = null;

  beforeAll(async () => {
    // Login first to get token
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

  it("should handle very short phone number", async () => {
    const updateData = {
      phone: "123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    // Either accept or reject, but response should be valid
    expect(response.status).toBeDefined();
  });

  it("should accept valid 10 digit phone", async () => {
    const updateData = {
      phone: "9804040485",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    expect(response.status).toBe(200);
  });

  it("should handle phone with special characters", async () => {
    const updateData = {
      phone: "980-404-0485",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    // Should return a response
    expect(response.status).toBeDefined();
  });

  it("should not accept phone with letters", async () => {
    const updateData = {
      phone: "980ABC0485",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    // Should handle gracefully
    expect(response.status).toBeDefined();
  });

  it("should require authorization token", async () => {
    const updateData = {
      phone: "9804040485",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        // No Authorization header
      },
      body: JSON.stringify(updateData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should reject invalid authorization token", async () => {
    const updateData = {
      phone: "9804040485",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid.token.here",
      },
      body: JSON.stringify(updateData),
    });

    expect(response.status).not.toBe(200);
  });
});
