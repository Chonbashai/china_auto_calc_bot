import axios from 'axios';
import fs from 'fs';

async function probe() {
  const response = await axios.get(
    'https://www.vtb.ru/personal/platezhi-i-perevody/obmen-valjuty/yuan/',
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      responseType: 'text',
    },
  );

  const html = response.data;
  fs.writeFileSync('scripts/vtb-page.html', html);

  const apiPaths = [...html.matchAll(/\/api\/[a-zA-Z0-9_\-/.]+/g)].map((m) => m[0]);
  console.log('api paths', [...new Set(apiPaths)].slice(0, 40));

  const jsonLike = [...html.matchAll(/"buy"[^}]{0,200}/gi)].slice(0, 10);
  console.log('buy json', jsonLike.map((m) => m[0]));

  const cnyBlocks = [...html.matchAll(/.{0,80}CNY.{0,120}/g)].slice(0, 10);
  console.log('cny blocks', cnyBlocks.map((m) => m[0]));
}

probe().catch(console.error);
