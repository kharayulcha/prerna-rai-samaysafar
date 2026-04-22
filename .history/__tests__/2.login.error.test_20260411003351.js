/**
 * Test 2: Login Error with Invalid Data
 * Tests login failure with invalid credentials
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 2 - Login Error with Invalid Data", () => {
  it("should fail login with invalid email", async () => {
    const loginData = {
      email: "nonexistent@gmail.com",
      password: "Expo5544#@",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toBe("Invalid credentials");
  });

  it("should fail login with incorrect password", async () => {
    const loginData = {
      email: "bayungraiprerna@gmail.com",
      password: "wrongpassword123",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.message).toBe("Invalid credentials");
  });

  it("should fail login with empty email", async () => {
    const loginData = {
      email: "",
      password: "Expo5544#@",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should fail login with empty password", async () => {
    const loginData = {
      email: "bayungraiprerna@gmail.com",
      password: "",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should not return token on failed login", async () => {
    const loginData = {
      email: "invalid@email.com",
      password: "wrongpass",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();
    expect(data).not.toHaveProperty("token");
  });
});
