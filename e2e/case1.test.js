describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should login successfully with provided credentials', async () => {
    // Step 1: Wait for and tap the Get Started button on the home screen
    await waitFor(element(by.id('getStartedButton')))
      .toExist()
      .withTimeout(20000);
    await element(by.id('getStartedButton')).tap();

    // Step 2: Wait for the login screen email input to appear
    await waitFor(element(by.id('emailInput')))
      .toBeVisible()
      .withTimeout(10000);

    // Step 3: Enter credentials
    await element(by.id('emailInput')).typeText('bayungraiprerna@gmail.com');
    await element(by.id('passwordInput')).typeText('pranish123');

    // Step 4: Tap the login button
    await element(by.id('loginButton')).tap();

    // Step 5: Wait for dashboard to exist (use toExist() to avoid the 75% visibility threshold issue)
    await waitFor(element(by.id('dashboardScreen')))
      .toExist()
      .withTimeout(30000);
    await expect(element(by.id('dashboardScreen'))).toExist();
  });
});
