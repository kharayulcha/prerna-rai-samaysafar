const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 1 - Successful Login", () => {
  const email = "bayungraiprerna@gmail.com";
  const password = "pranish123";

  it("should login successfully with valid email and password", async () => {
    const loginData = { email, password };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Login failed with status:", response.status, errorData);
    }

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("token");
    expect(data).toHaveProperty("user");
    expect(data.user).toHaveProperty("email", email);
    expect(data.message).toBe("Login successful");
  });

  it("should return a valid JWT token", async () => {
    const loginData = { email, password };

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
    expect(token).toBeDefined();
    if (token) {
      expect(token.split(".").length).toBe(3);
    }
  });

  it("should store user data in response", async () => {
    const loginData = { email, password };

    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();
    const user = data.user;

    expect(user).toBeDefined();
    if (user) {
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("email");
    }
  });
});


