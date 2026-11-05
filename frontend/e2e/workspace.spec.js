import { expect, test } from '@playwright/test';
import process from 'node:process';

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe('workspace flows', () => {
  test.skip(
    !email || !password || !process.env.VITE_SUPABASE_URL || !process.env.VITE_API_URL,
    'Configure a dedicated test Supabase project and E2E credentials to run browser tests.',
  );

  test('sign up, sign in, manage a project, and sign out', async ({ page }) => {
    const projectName = `E2E project ${Date.now()}`;
    const firstTask = `E2E task ${Date.now()}`;
    const secondTask = `E2E task ${Date.now()} second`;

    await page.goto('/login');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'New project' }).click();
    await page.getByLabel('Project name').fill(projectName);
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible();

    const todoColumn = page.getByRole('region', { name: 'To do tasks' });
    await todoColumn.getByLabel('New task in To do').fill(firstTask);
    await todoColumn.getByRole('button', { name: 'Add task to To do' }).click();
    await expect(page.getByText(firstTask)).toBeVisible();
    await todoColumn.getByLabel('New task in To do').fill(secondTask);
    await todoColumn.getByRole('button', { name: 'Add task to To do' }).click();
    await expect(page.getByText(secondTask)).toBeVisible();

    const waitForReorder = () => page.waitForResponse((response) => (
      response.url().includes('/tasks/reorder') && response.request().method() === 'POST'
    ));
    let reorderSaved = waitForReorder();
    await page.getByRole('button', { name: `Drag task ${firstTask}` }).dragTo(page.getByLabel('In progress tasks'));
    await reorderSaved;
    reorderSaved = waitForReorder();
    await page.getByRole('button', { name: `Drag task ${secondTask}` }).dragTo(page.getByLabel('In progress tasks'));
    await reorderSaved;
    const progressCards = page.getByLabel('In progress tasks').locator('.task-card');
    const orderBeforeReload = await progressCards.allTextContents();
    await page.reload();
    await expect(page.getByLabel('In progress tasks').getByText(firstTask)).toBeVisible();
    await expect.poll(() => progressCards.allTextContents()).toEqual(orderBeforeReload);

    await page.getByRole('button', { name: 'Project options' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('menuitem', { name: 'Archive project' }).click();
    await page.getByRole('link', { name: 'Archived' }).click();
    await expect(page.getByText(projectName)).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText(projectName)).toHaveCount(0);

    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
