import { chromium } from 'playwright';

const VTB_YUAN_URL =
  'https://www.vtb.ru/personal/platezhi-i-perevody/obmen-valjuty/yuan/';
const CALCUS_URL = 'https://calcus.ru/rastamozhka-auto';

function isValidYuanRate(value) {
  return Number.isFinite(value) && value > 8 && value < 20;
}

function parseRateFromText(text) {
  const normalized = text.replace(/\u00a0/g, ' ');
  const lines = normalized.split('\n');

  for (const line of lines) {
    if (!/юан|cny|¥/i.test(line)) continue;
    const match = line.match(/(\d{1,2}[.,]\d{2,4})/);
    if (match) {
      const value = Number.parseFloat(match[1].replace(',', '.'));
      if (isValidYuanRate(value)) return value;
    }
  }

  const matches = normalized.match(/(\d{1,2}[.,]\d{2,4})/g) ?? [];
  for (const match of matches) {
    const value = Number.parseFloat(match.replace(',', '.'));
    if (isValidYuanRate(value)) return value;
  }
  return null;
}

async function testVtbRate() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const capturedRates = [];

  page.on('response', async (response) => {
    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('json')) return;
    try {
      const body = await response.text();
      const rate = parseRateFromText(body);
      if (rate !== null) capturedRates.push(rate);
    } catch {
      // ignore
    }
  });

  await page.goto(VTB_YUAN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5_000);

  const bodyRate = parseRateFromText(await page.locator('body').innerText());
  const rate = capturedRates[0] ?? bodyRate;

  await browser.close();

  if (rate === null) {
    throw new Error('VTB rate not found');
  }

  console.log(`VTB integration test passed: rate=${rate}`);
}

function mapYearToAgeGroup(year) {
  const age = new Date().getFullYear() - year;
  if (age < 3) return 'до 3 лет';
  if (age < 5) return 'от 3 до 5 лет';
  if (age < 7) return 'от 5 до 7 лет';
  return 'более 7 лет';
}

async function testCalcusWidget() {
  const domain = process.env.CALCUS_WIDGET_DOMAIN ?? 'tgbotauto.chonbai.ru';
  const widgetRes = await fetch(
    `https://calcus.ru/get-widget?calc=Customs&domain=${encodeURIComponent(domain)}`,
    { headers: { Referer: 'https://calcus.ru/widget/Customs' } },
  );
  if (!widgetRes.ok) throw new Error(`get-widget HTTP ${widgetRes.status}`);
  const widget = await widgetRes.json();
  const actionMatch = widget.html.match(/action="([^"]+)"/);
  if (!actionMatch) throw new Error('widget form action not found');
  const action = new URL(actionMatch[1], 'https://calcus.ru').href;
  const body = new URLSearchParams({
    owner: '1',
    age: mapYearToAgeCode(2022),
    engine: '1',
    power: '90',
    power_unit: '2',
    value: '1800',
    price: '82000',
    curr: 'CNY',
  });
  const calcRes = await fetch(action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: 'https://calcus.ru/rastamozhka-auto',
      Origin: 'https://calcus.ru',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!calcRes.ok) throw new Error(`calculate HTTP ${calcRes.status}`);
  const data = await calcRes.json();
  const total = Number.parseFloat(String(data.total).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(total) || total <= 0) throw new Error('invalid widget total');
  console.log(`Calcus widget integration test passed: customs=${Math.round(total)}`);
}

function mapYearToAgeCode(year) {
  const ageMonths = (new Date().getFullYear() - year) * 12;
  if (ageMonths < 36) return '0-3';
  if (ageMonths < 60) return '3-5';
  if (ageMonths < 84) return '5-7';
  return '7-0';
}

async function testCalcusCustomsPlaywright() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(CALCUS_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const accept = page.getByRole('button', { name: /я согласен/i });
  if ((await accept.count()) > 0) await accept.first().click();

  await page.locator('select[name="owner"]').selectOption({ index: 0 });
  await page.locator('select[name="age"]').selectOption({ label: mapYearToAgeGroup(2022) });
  await page.locator('select[name="engine"]').selectOption({ label: 'Бензиновый' });
  await page.locator('select[name="power_unit"]').selectOption({ label: 'кВт' });
  await page.locator('input[name="value"]').fill('1800');
  await page.locator('input[name="power"]').fill('90');
  await page.locator('select[name="curr"]').selectOption({ label: 'Китайский юань' });
  await page.locator('input[name="price"]').fill('82000');

  const submit = page.locator('input.calc-submit[type="submit"]').first();
  if ((await submit.count()) > 0) await submit.click();
  await page.waitForTimeout(4_000);

  const bodyText = await page.locator('body').innerText();
  const labels = ['Таможенный сбор', 'Таможенная пошлина', 'Акциз', 'НДС', 'Утилизационный сбор'];
  let total = 0;
  let found = 0;

  for (const label of labels) {
    const patterns = [
      new RegExp(`${label}[^\\d]{0,30}([\\d\\s]+)\\s*₽`, 'i'),
      new RegExp(`${label}[^\\d]{0,40}(\\d[\\d\\s]+)`, 'i'),
    ];
    for (const regex of patterns) {
      const match = bodyText.match(regex);
      if (match) {
        const value = Number.parseInt(match[1].replace(/\s/g, ''), 10);
        if (Number.isFinite(value) && value > 0) {
          total += value;
          found += 1;
          break;
        }
      }
    }
  }

  await browser.close();

  if (found === 0 || total <= 0) {
    throw new Error('Calcus customs components not found');
  }

  console.log(`Calcus integration test passed: customs=${total}, components=${found}`);
}

async function main() {
  await testVtbRate();
  await testCalcusWidget();
}

main().catch((error) => {
  console.error('Integration test failed:', error);
  process.exit(1);
});
