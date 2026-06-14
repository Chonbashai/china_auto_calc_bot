import axios from 'axios';

async function probe() {
  const jsUrl =
    'https://www.vtb.ru/_platform/app.js?version=2026-06-13&page=/personal/platezhi-i-perevody/obmen-valjuty/yuan';
  const response = await axios.get(jsUrl, { responseType: 'text' });
  const js = response.data;
  console.log('js length', js.length);

  const apis = [...js.matchAll(/\/[a-zA-Z0-9_\-/.]*(?:rate|exchange|currency|cny|yuan)[a-zA-Z0-9_\-/.]*/gi)].map(
    (m) => m[0],
  );
  console.log('paths', [...new Set(apis)].slice(0, 40));

  const https = [...js.matchAll(/https:\/\/[^"'`\\]+/g)].map((m) => m[0]);
  const filtered = https.filter((u) => /rate|exchange|currency|cny|yuan|api/i.test(u));
  console.log('urls', [...new Set(filtered)].slice(0, 30));
}

probe().catch(console.error);
