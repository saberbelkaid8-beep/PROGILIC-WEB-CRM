import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0', timeout: 10000 }).catch(e => console.log("Navigation timeout"));
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({path: 'screenshot.png'});
  const info = await page.evaluate(() => {
    return {
      hasAppLogs: typeof window.APP_LOGS !== 'undefined',
      logs: window.APP_LOGS || []
    };
  });
  console.log("INFO:", info);
  await browser.close();
})();
