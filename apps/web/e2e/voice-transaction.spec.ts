import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SAMPLE = path.join(import.meta.dirname, 'fixtures', 'sample-sale.wav');

async function register(page: Page) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Suresh E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByLabel('Language').selectOption('hinglish');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test('demo login opens a dashboard with synthetic data', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Try the demo account' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Demo account')).toBeVisible();
  await expect(page.getByTestId('pending-total')).toContainText('₹');
  await expect(page.getByText('Gnani AI connected')).toBeVisible();
});

test('voice sale: upload audio → transcript → edit → hear → confirm → receipt → history → pending', async ({ page }) => {
  await register(page);
  await page.getByRole('link', { name: 'Record a sale' }).first().click();

  // Steps 1-2: audio to (mock) Prisma via our backend
  await page.getByTestId('audio-upload').setInputFiles(SAMPLE);
  await expect(page.getByLabel('Recording preview')).toBeVisible();
  await page.getByRole('button', { name: 'Transcribe' }).click();

  // Step 3: transcript is displayed and editable
  const transcript = page.getByTestId('transcript');
  await expect(transcript).toHaveValue(/25 quintal gehu/);
  await expect(page.getByText(/sent as hi-IN,en-IN/)).toBeVisible();
  await page.getByRole('button', { name: 'Fill the sale slip' }).click();

  // Steps 4-6: extracted fields + backend calculation
  await expect(page.getByLabel('Crop')).toHaveValue('Wheat');
  await expect(page.getByLabel('Quantity')).toHaveValue('25');
  await expect(page.getByLabel(/Rate per quintal/)).toHaveValue('2400');
  await expect(page.getByLabel('Commission (%)')).toHaveValue('2');
  await expect(page.getByLabel('Transport (₹)')).toHaveValue('500');
  await expect(page.getByTestId('net-amount')).toHaveText('₹58,300.00');

  // Edit: 30 quintal -> gross 72,000, commission 1,440, net 70,060
  await page.getByLabel('Quantity').fill('30');
  await expect(page.getByTestId('net-amount')).toHaveText('₹70,060.00');
  await page.getByLabel('Buyer (optional)').fill('Sharma Traders (test)');

  // Step 7: read aloud via (mock) Timbre
  await page.getByRole('button', { name: 'Read summary aloud' }).click();
  await expect(page.getByLabel('Spoken summary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

  // Step 8-9: confirmation is required
  const confirm = page.getByRole('button', { name: 'Confirm and save' });
  await expect(confirm).toBeDisabled();
  await page.getByTestId('confirm-checkbox').check();
  await confirm.click();

  // Step 10: receipt
  await expect(page).toHaveURL(/\/app\/transactions\/[a-f0-9]{24}\?new=1/);
  await expect(page.getByTestId('receipt-net')).toHaveText('₹70,060.00');
  await expect(page.getByTestId('receipt-number')).toHaveText(/^MM-\d{8}-[0-9A-F]{8}$/);
  await expect(page.getByText('not proof of payment')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/^receipt-MM-.*\.pdf$/);

  // History
  await page.getByRole('link', { name: 'All transactions' }).click();
  await expect(page.getByTestId('transactions-table')).toContainText('Wheat');
  await expect(page.getByTestId('transactions-table')).toContainText('₹70,060.00');

  // Pending payments + voice query
  await page.goto('/app/payments');
  await expect(page.getByTestId('payments-pending')).toHaveText('₹70,060');
  await expect(page.getByTestId('outstanding-list')).toContainText('Sharma Traders (test)');
  await page.getByRole('button', { name: 'Mera kitna paisa pending hai?' }).first().click();
  await expect(page.getByTestId('voice-answer')).toContainText('₹70,060');
});

test('recording with the microphone produces a WAV preview', async ({ page }) => {
  await register(page);
  await page.goto('/app/record');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByLabel('Recording preview')).toBeVisible();
  await expect(page.getByText(/Recording, \d+ s, WAV/)).toBeVisible();
  await page.getByRole('button', { name: 'Transcribe' }).click();
  await expect(page.getByTestId('transcript')).toHaveValue(/quintal/);
});

test('a new visitor finds the guide, sees the first-time hint, and the hint goes after the first sale', async ({ page }) => {
  // Public guide, straight from the landing page (not signed in)
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'From a spoken sentence to a confirmed record' })).toBeVisible();
  await expect(page.getByTestId('try-it')).toContainText('Try the demo account');
  await page.getByRole('link', { name: 'Help' }).first().click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { level: 1, name: 'How MandiMitra works' })).toBeVisible();
  await expect(page.getByTestId('example-hindi')).toContainText('प्याज');

  // First dashboard visit shows the hint, which links to the in-app guide
  await register(page);
  await expect(page.getByTestId('getting-started')).toBeVisible();
  await page.getByTestId('getting-started').getByRole('link', { name: /How it works/ }).click();
  await expect(page).toHaveURL(/\/app\/help$/);
  await expect(page.getByRole('heading', { name: 'Record your first sale in 5 steps' })).toBeVisible();

  // After the first sale the hint is gone
  await page.goto('/app/record');
  await page.getByRole('button', { name: 'Enter manually' }).click();
  await page.getByLabel('Crop').fill('Gram');
  await page.getByLabel('Quantity').fill('10');
  await page.getByLabel('Unit', { exact: true }).selectOption('quintal');
  await page.getByLabel(/^Rate per/).fill('5000');
  await expect(page.getByTestId('net-amount')).toHaveText('₹50,000.00');
  await page.getByTestId('confirm-checkbox').check();
  await page.getByRole('button', { name: 'Confirm and save' }).click();
  await expect(page).toHaveURL(/\/app\/transactions\/[a-f0-9]{24}\?new=1/);
  await page.goto('/app');
  await expect(page.getByTestId('pending-total')).toContainText('₹');
  await expect(page.getByTestId('getting-started')).toHaveCount(0);
});

test('a recording that is too short shows the reason in words, and Discard clears it', async ({ page }) => {
  await register(page);
  await page.goto('/app/record');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.getByRole('button', { name: 'Stop recording' }).waitFor();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByRole('button', { name: 'Transcribe' }).click();
  // Regression: this used to be an empty red box because the message chain stopped at an empty string
  await expect(page.getByRole('alert')).toContainText(/too short/i);
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('keyboard users get a skip link, a landmark, per-page titles and focus after navigation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page).toHaveTitle(/Sign in/);
  await register(page);
  await page.goto('/app/payments');
  await expect(page).toHaveTitle(/Payments/);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page).toHaveTitle(/Analytics/);
  await expect(page.locator('#main')).toBeFocused();
});

test('the dialog gives focus back to the button that opened it', async ({ page }) => {
  await register(page);
  await page.goto('/app/record');
  await page.getByRole('button', { name: 'Enter manually' }).click();
  await page.getByLabel('Crop').fill('Gram');
  await page.getByLabel('Quantity').fill('5');
  await page.getByLabel('Unit', { exact: true }).selectOption('quintal');
  await page.getByLabel(/^Rate per/).fill('4000');
  await page.getByTestId('confirm-checkbox').check();
  await page.getByRole('button', { name: 'Confirm and save' }).click();
  await expect(page).toHaveURL(/\/app\/transactions\/[a-f0-9]{24}\?new=1/);
  const opener = page.getByRole('button', { name: 'Record a payment' });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Record a payment' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

for (const width of [320, 375]) {
  test(`no horizontal scrolling on a ${width}px phone (landing, dashboard, payments, record)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.goto('/');
    expect(await overflow(), 'landing').toBeLessThanOrEqual(1);
    await register(page);
    for (const path of ['/app', '/app/payments', '/app/record', '/app/transactions', '/app/help']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await overflow(), path).toBeLessThanOrEqual(1);
    }
  });
}

test('missing fields are not invented and block confirmation', async ({ page }) => {
  await register(page);
  await page.goto('/app/record');
  await page.getByRole('button', { name: 'Enter manually' }).click();
  await page.getByLabel('Crop').fill('Gram');
  await expect(page.getByText('Fill crop, quantity, unit and rate to see the amounts.')).toBeVisible();
  await page.getByTestId('confirm-checkbox').check();
  await expect(page.getByRole('button', { name: 'Confirm and save' })).toBeDisabled();
});
