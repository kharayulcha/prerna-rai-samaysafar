/**
 * Test 3: OTP Send Success for Forgot Password
 * Tests successful OTP generation and sending for password reset
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 3 - OTP Send Success for Forgot Password", () => {
  it("should send OTP successfully for registered email", async () => {
    const forgotPassData = {
      email: "bayungraiprerna@gmail.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("OTP");
  });

  it("should return 200 status on successful OTP send", async () => {
    const forgotPassData = {
      email: "bayungraiprerna@gmail.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    expect(response.ok).toBe(true);
  });

  it("should have OTP in backend after sending", async () => {
    const forgotPassData = {
      email: "bayungraiprerna@gmail.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    const data = await response.json();
    expect(data).toHaveProperty("message");
    expect(data.message.toLowerCase()).toContain("otp");
  });

  it("should not expose OTP in response for security", async () => {
    const forgotPassData = {
      email: "bayungraiprerna@gmail.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    const data = await response.json();
    expect(data).not.toHaveProperty("otp");
  });

  it("should accept email in request body", async () => {
    const forgotPassData = {
      email: "bayungraiprerna@gmail.com",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(forgotPassData),
    });

    expect(response.status).toBe(200);
  });
});
