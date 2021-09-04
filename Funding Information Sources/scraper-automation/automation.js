const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const adblocker = AdblockerPlugin({
  blockTrackers: true, // default: false
});
puppeteer.use(adblocker);
puppeteer.use(StealthPlugin());

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  return { browser, page };
};

const getPortfolioCompanies = async (companyName, companyLink) => {
  console.log('entered');
  const { page, browser } = await launchBrowser();
  await page.goto(companyLink);
  let currentUrl = page.url();
  console.log('currentUrl', currentUrl);
  const kebabName = companyName.split(' ').join('-');
  try {
    const portfolio = await handleEventListener(page, browser);
    if (portfolio.length > 0) {
      const stringifiedData = JSON.stringify(portfolio);
      fs.writeFile(`./${kebabName}-portfolio.json`, stringifiedData, (err) => {
        if (err) throw err;
        else
          console.log(
            `json file successfully generated at ${__dirname}/${kebabName}-portfolio.json`
          );
      });
    }
    await browser.close();
  } catch (e) {
    console.log('Error: ', e.message);
    await browser.close();
  }
};

const handleEventListener = async (page, browser) => {
  try {
    let portfolio = await page.evaluate(async () => {
      const companies = [];
      document.addEventListener('mouseover', function (event) {
        event.target.style.borderColor = 'red';
        event.target.style.borderWidth = 'thick';
        // reset the color after a short delay
        setTimeout(function () {
          event.target.style.borderColor = '';
          event.target.style.borderWidth = 'medium';
        }, 500);
      });
      document.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          let isHeld = true;
          let activeTimeoutId = setTimeout(() => {
            if (isHeld) {
              console.log('Element of choice: ', e.target);
              const tagName = e.target.tagName.toLowerCase();
              const className = e.target.className.split(' ').join('.');
              const allCompanies = document.querySelectorAll(
                `${tagName}.${className}`
              );
              console.log('company count: ', allCompanies.length);
              allCompanies.forEach((companyNode) => {
                const linkNode = companyNode.querySelectorAll('a');
                const links = Array.from(linkNode).map((el) => el.href);
                const company = {
                  links,
                  value: companyNode.innerText,
                };
                console.log(company);
                companies.push(company);
              });
            }
          }, 1800);

          e.target.addEventListener('mouseup', (e) => {
            isHeld = false;
            clearTimeout(activeTimeoutId);
          });
        }
      });
      const delay = (t) => {
        return new Promise((resolve) => setTimeout(resolve, t));
      };
      await delay(20000);
      return companies;
    });
    console.log('portfolio length', portfolio.length);
    if (portfolio.length === 0) {
      portfolio = await handleEventListener(page, browser);
    }
    if (portfolio.length > 0) {
      return portfolio;
    }
  } catch (e) {
    console.log('error at handleEventListener: ', e.message);
    return await handleEventListener(page, browser);
  }
};
getPortfolioCompanies('wm', 'https://wavemaker.vc/sea/');
