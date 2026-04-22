/**
 * Test 4: Unsuccessful OTP Send if Unregistered Email
 * Tests OTP send failure for non-existent email addresses
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 4 - Unsuccessful OTP Send if Unregistered Email", () => {
  it("should fail to send OTP for non-existent email", async () => {
    const forgotPassData = {
      email: "nonexistent.user.12345@gmail.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should return error message for unregistered email", async () => {
    const forgotPassData = {
      email: "notregistered@example.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    const data = await response.json();
    expect(data.message).toBeDefined();
  });

  it("should fail with empty email", async () => {
    const forgotPassData = {
      email: "",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should fail with invalid email format", async () => {
    const forgotPassData = {
      email: "invalidemail",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    expect(response.status).not.toBe(200);
  });

  it("should not send email for unregistered users", async () => {
    const forgotPassData = {
      email: "definitely.not.a.real.user.123456@test.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    // Should return 4xx or 5xx error, not 200
    expect(response.status).not.toBe(200);
  });
});
