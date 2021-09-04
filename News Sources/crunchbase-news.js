const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const parseSearchResult = async (searchTerm) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  try {
    const parsedData = await getSearchArticleDetails(page, searchTerm);
    setTimeout(async () => {
      await browser.close();
    }, 2000);
    return parsedData;
  } catch (e) {
    console.error(e);
    setTimeout(async () => {
      await browser.close();
    }, 2000);
    return undefined;
  }
};

const getSearchArticleDetails = async (page, searchTerm) => {
  await page.goto(getSearchUrl(searchTerm));
};

parseSearchResult('Fintech');
