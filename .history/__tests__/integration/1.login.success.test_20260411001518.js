/**
 * Test 1: Successful Login
 * Tests login with valid credentials
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 1 - Successful Login", () => {
  it("should login successfully with valid email and password", async () => {
    const loginData = {
      email: "bayungraiprerna@gmail.com",
      password: "Expo5544#@",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("token");
    expect(data).toHaveProperty("user");
    expect(data.user).toHaveProperty("email", loginData.email);
    expect(data.message).toBe("Login successful");
  });

  it("should return a valid JWT token", async () => {
    const loginData = {
      email: "bayungraiprerna@gmail.com",
      password: "Expo5544#@",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();
    const token = data.token;
    
    // JWT should have 3 parts separated by dots
    expect(token.split(".").length).toBe(3);
  });

  it("should store user data in response", async () => {
    const loginData = {
      email: "bayungraiprerna@gmail.com",
      password: "Expo5544#@",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();
    const user = data.user;

    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("role");
    expect(user).toHaveProperty("email");
  });
});
