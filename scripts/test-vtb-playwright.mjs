import { chromium } from 'playwright';

const VTB_YUAN_URL =
  'https://www.vtb.ru/personal/platezhi-i-perevody/obmen-valjuty/yuan/';

function parseRate(text) {
  const normalized = text.replace(/\u00a0/g, ' ');
  const labeled = [...normalized.matchAll(/(?:продаж|покуп|курс)[^\d]{0,40}(\d{1,2}[.,]\d{2,4})/giu)];
  const candidates = labeled
    .map((m) => Number.parseFloat(m[1].replace(',', '.')))
    .filter((v) => v > 5 && v < 30);
  if (candidates.length) return candidates[0];

  const all = [...normalized.matchAll(/(\d{1,2}[.,]\d{2,4})/g)]
    .map((m) => Number.parseFloat(m[1].replace(',', '.')))
    .filter((v) => v > 9 && v < 20);
  return all[0] ?? null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(VTB_YUAN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const text = await page.locator('body').innerText();
  const rate = parseRate(text);
  console.log('VTB rate:', rate);
  await browser.close();

  if (!rate) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
