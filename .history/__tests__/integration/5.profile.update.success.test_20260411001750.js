/**
 * Test 5: Update Profile Successfully
 * Tests successful profile update with valid data
 */

const API_BASE_URL = "https://prerna-rai-samaysafar.onrender.com";

describe("Test 5 - Update Profile Successfully", () => {
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

  it("should update profile with valid data", async () => {
    const updateData = {
      name: "Prerna Rai Updated",
      email: "bayungraiprerna@gmail.com",
      phone: "9804040485",
      address: "Kathmandu, Nepal",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain("updated");
  });

  it("should return updated user data", async () => {
    const updateData = {
      name: "Prerna Rai",
      phone: "9804040485",
      address: "Kathmandu",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();
    expect(data).toHaveProperty("user");
    expect(data.user).toHaveProperty("id");
  });

  it("should update name successfully", async () => {
    const updateData = {
      name: "Updated Name",
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

  it("should update phone successfully", async () => {
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

  it("should update address successfully", async () => {
    const updateData = {
      address: "Test Address",
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

  it("should return new token after profile update", async () => {
    const updateData = {
      name: "Prerna Rai",
    };

    const response = await fetch(`${API_BASE_URL}/api/users/edit-profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();
    expect(data).toHaveProperty("token");
    expect(data.token).toBeDefined();
  });
});
