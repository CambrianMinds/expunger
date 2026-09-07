const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Indiana Expungement Assistant E2E', () => {
  test('should load the app and require disclaimers before generating PDF', async ({ page }) => {
    // Inject mock cases into localStorage before the page loads
    await page.addInitScript(() => {
      localStorage.setItem('lastScanResults', JSON.stringify({
        cases: [
          { caseNumber: '49D01-2001-CM-001234', county: 'Marion', type: 'CM', charges: 'Theft', eligible: true }
        ],
        report: {
          summary: { eligible: 1 },
          counties: { '49': { cases: [{ eligibility: { eligible: true } }] } }
        }
      }));
    });

    // Navigate to local HTML file via web server
    await page.goto('/docs/app/app.html');
    // Wait for JS modules to load and attach event listeners
    await page.waitForLoadState('networkidle');

    // Click the Generate tab
    await page.click('button[data-tab="generate"]');
    await expect(page.locator('#tab-generate')).toHaveClass(/active/);

    // Find the Generate button
    const generateBtn = page.locator('#btnGenerate');
    
    // Ensure button is disabled initially
    await expect(generateBtn).toBeDisabled();

    // To actually generate, we need to fill the required fields in the profile tab
    await page.click('button[data-tab="profile"]');
    await expect(page.locator('#tab-profile')).toHaveClass(/active/);
    await page.fill('#fullName', 'John Doe');
    await page.fill('#dob', '1990-01-01');
    await page.fill('#ssn', '123-45-6789');
    await page.fill('#streetAddress', '123 Main St');
    await page.fill('#city', 'Indianapolis');
    await page.fill('#zipCode', '46204');
    
    // Save the profile to update AppState
    await page.click('button[type="submit"]');

    // Go back to the Generate tab
    await page.click('button[data-tab="generate"]');
    await expect(page.locator('#tab-generate')).toHaveClass(/active/);

    // Check all disclaimers (use force in case they are visually hidden by custom CSS styling)
    await page.check('#ackOneShot', { force: true });
    await page.check('#ackAllCounties', { force: true });
    await page.check('#ackNotLawyer', { force: true });
    await page.check('#ackProSe', { force: true });

    // Generate button should now be enabled
    await expect(generateBtn).toBeEnabled();
    
    // Click generate which opens the confirmation modal
    await generateBtn.click();
    
    // Wait for the modal to appear and click confirm
    const confirmBtn = page.locator('#btnModalConfirm');
    await expect(confirmBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      confirmBtn.click()
    ]);

    // Validate the PDF
    const downloadPath = await download.path();
    const pdfBuffer = fs.readFileSync(downloadPath);
    
    // Ensure the PDF is not empty
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
