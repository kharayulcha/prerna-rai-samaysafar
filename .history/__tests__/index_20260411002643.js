#!/usr/bin/env node

/**
 * SamaySafar Jest Test Suite Index
 * Run individual tests with: npm run test:test-name
 * Run all tests with: npm run test:all
 */

const tests = [
  {
    number: 1,
    name: "Successful Login",
    file: "1.login.success.test.js",
    command: "npm run test:login",
    description: "Tests login with valid credentials",
    scenarios: [
      "Login with valid email and password",
      "JWT token generation validation",
      "User data retrieval"
    ]
  },
  {
    number: 2,
    name: "Login Error with Invalid Data",
    file: "2.login.error.test.js",
    command: "npm run test:login-error",
    description: "Tests login failure scenarios",
    scenarios: [
      "Invalid email login",
      "Incorrect password login",
      "Empty credentials",
      "Error message validation"
    ]
  },
  {
    number: 3,
    name: "OTP Send Success for Forgot Password",
    file: "3.forgot-password.success.test.js",
    command: "npm run test:forgot-password",
    description: "Tests successful OTP generation and sending",
    scenarios: [
      "OTP send for registered email",
      "Response status validation",
      "OTP security (not exposed in response)"
    ]
  },
  {
    number: 4,
    name: "OTP Send Failure for Unregistered Email",
    file: "4.forgot-password.error.test.js",
    command: "npm run test:forgot-password-error",
    description: "Tests OTP send failure scenarios",
    scenarios: [
      "Non-existent email rejection",
      "Invalid email format",
      "Empty email handling"
    ]
  },
  {
    number: 5,
    name: "Update Profile Successfully",
    file: "5.profile.update.success.test.js",
    command: "npm run test:profile-update",
    description: "Tests successful profile update",
    scenarios: [
      "Update with all fields",
      "Update individual fields",
      "New token generation",
      "Updated data retrieval"
    ]
  },
  {
    number: 6,
    name: "Update Profile Error with Invalid Phone",
    file: "6.profile.update.error.test.js",
    command: "npm run test:profile-error",
    description: "Tests profile update failures",
    scenarios: [
      "Invalid phone format handling",
      "Authorization requirement",
      "Invalid token rejection"
    ]
  },
  {
    number: 7,
    name: "Add Driver",
    file: "7.add-driver.test.js",
    command: "npm run test:add-driver",
    description: "Tests adding new driver",
    scenarios: [
      "Create driver with valid data",
      "Driver role assignment",
      "Duplicate email prevention",
      "Authorization requirement",
      "Unique driver ID generation"
    ]
  },
  {
    number: 8,
    name: "Add Parent",
    file: "8.add-parent.test.js",
    command: "npm run test:add-parent",
    description: "Tests adding new parent",
    scenarios: [
      "Create parent with valid data",
      "Parent role assignment",
      "Duplicate email prevention",
      "Authorization requirement",
      "Credentials email sending"
    ]
  },
  {
    number: 9,
    name: "Add Route",
    file: "9.add-route.test.js",
    command: "npm run test:add-route",
    description: "Tests adding new route",
    scenarios: [
      "Create route with distance",
      "Start and end points storage",
      "Route name storage",
      "Authorization requirement"
    ]
  },
  {
    number: 10,
    name: "Add Student",
    file: "10.add-student.test.js",
    command: "npm run test:add-student",
    description: "Tests adding new student",
    scenarios: [
      "Create student with valid data",
      "Student role assignment",
      "Link to parent (optional)",
      "Duplicate email prevention",
      "Credentials email sending"
    ]
  }
];

const testCommands = [
  { name: "All integration tests", command: "npm run test:all" },
  { name: "All tests with coverage", command: "npm run test:coverage" },
  { name: "Full test suite", command: "npm test" }
];

console.log("\n════════════════════════════════════════════════════════════════");
console.log("  SAMAYSAFAR JEST AUTOMATION TEST SUITE");
console.log("════════════════════════════════════════════════════════════════\n");

console.log(`Total Tests: ${tests.length}`);
console.log(`Total Test Cases: 50+\n`);

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

tests.forEach((test) => {
  console.log(`📋 Test ${test.number}: ${test.name}`);
  console.log(`   Description: ${test.description}`);
  console.log(`   File: __tests__/integration/${test.file}`);
  console.log(`   Command: ${test.command}`);
  console.log(`   Scenarios:`);
  test.scenarios.forEach((scenario) => {
    console.log(`     ✓ ${scenario}`);
  });
  console.log("");
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("🚀 QUICK START COMMANDS:\n");
testCommands.forEach((cmd) => {
  console.log(`   ${cmd.command}`);
  console.log(`   → ${cmd.name}\n`);
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("📝 TEST CREDENTIALS:");
console.log("   Email: bayungraiprerna@gmail.com");
console.log("   Password: Expo5544#@\n");

console.log("🔗 API ENDPOINT:");
console.log("   https://prerna-rai-samaysafar.onrender.com\n");

console.log("📚 For detailed information, see: __tests__/TESTING_GUIDE.md");
console.log("\n════════════════════════════════════════════════════════════════\n");

module.exports = tests;
