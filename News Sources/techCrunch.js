const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const getSearchUrl = (searchTerm) => {
  return `https://search.techcrunch.com/search;_ylc=X3IDMgRncHJpZAM3OXNBVENCRFQxeVEzMXViWEltSndBBG5fc3VnZwMxMARwb3MDMARwcXN0cgMEcHFzdHJsAzAEcXN0cmwDNARxdWVyeQNUZWNoBHRfc3RtcAMxNjI3MDk2MzYy?p=${searchTerm}`;
};

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  try {
    await getTechCrunchSearchArticles(browser, page);
  } catch (e) {
    console.error(e);
    await browser.close();
  }
})();

const getTechCrunchSearchArticles = async (browser, page) => {
  const articleSearchResults = [];
  const searchUrl = getSearchUrl('Tech');
  await page.goto(searchUrl);
  for (let i = 1; i <= 3; i++) {
    await page.waitForSelector('ul.compArticleList', { timeout: 4000 });
    await processSearchArticles(page, articleSearchResults);
    const nextPageBtn = await page.$('div.compPagination > a.next');
    await nextPageBtn.click();
    await page.waitForNavigation();
    console.log('------ going to next page ------ ');
  }
  console.log('length', articleSearchResults.length);
  fs.writeFile(
    `Tech-techcrunch-articles.json`,
    JSON.stringify(articleSearchResults),
    (err) => {
      if (err) throw err;
      else
        console.log(
          `article json file successfully generated at ${__dirname}/Tech-techcrunch-articles.json`
        );
    }
  );
};

const processSearchArticles = async (page, articleSearchResults) => {
  const articles = await page.$$('ul.compArticleList li');
  for await (const article of articles) {
    const articleFromSearchUrl = await article.$eval('a', (el) => el.href);

    const articleUrlArray = articleFromSearchUrl.split('%2f');
    articleUrlArray.pop();
    while (
      articleUrlArray.length > 0 &&
      articleUrlArray[0] != 'techcrunch.com'
    ) {
      articleUrlArray.shift();
    }

    const articleUrl = 'https://' + articleUrlArray.join('/');

    const { articleTitle, articleSnippet, isExtraCrunch } =
      await article.evaluate((art) => {
        const isExtraCrunch = art.querySelector('.xtrcrnch') ? true : false;
        const descriptionNode = art.querySelector('div.d-tc:not(.va-top)');
        if (!descriptionNode) {
          return { articleTitle: 'Unknown', articleSnippet: '', isExtraCrunch };
        }
        const articleTitle = descriptionNode.querySelector('h4 > a').innerText;
        const articleSnippet = descriptionNode.querySelector('p').innerHTML;
        return { articleTitle, articleSnippet, isExtraCrunch };
      });
    const {
      authorDetails,
      dateTime,
      htmlContent,
      articleImgUrl,
      articleTags,
      twitterDetails,
    } = await parseFullArticlePage(articleFromSearchUrl);

    console.log(`--- parsedFullArticlePage: ${articleTitle} --- `);

    const data = {
      isExtraCrunch,
      articleUrl,
      articleImgUrl,
      articleTitle,
      authorDetails,
      articleSnippet,
      dateTime,
      htmlContent,
      articleTags,
      twitterDetails,
    };
    articleSearchResults.push(data);
  }
};

const parseFullArticlePage = async (articleUrl) => {
  const browser = await puppeteer.launch();
  const articlePage = await browser.newPage();
  await articlePage.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  await articlePage.goto(articleUrl, {
    timeout: 0,
    waitUntil: 'domcontentloaded',
  });
  console.log('--- page reloading ---');
  // this is needed to fix perpetual loading jank
  await articlePage.reload({ waitUntil: 'networkidle2', timeout: 0 });
  console.log('--- page reloaded ---');

  await articlePage.waitForSelector('div.article__byline');

  const { authorDetails, twitterDetails, dateTime } = await articlePage.$eval(
    'div.article__byline',
    (el) => {
      const nameNodes = el.querySelectorAll(
        'div > a, span:not(.article__byline__meta) > a'
      );
      const authorDetails = [];
      const twitterNodes = el.querySelectorAll(
        'span.article__byline__meta > a'
      );
      const twitterDetails = Array.from(twitterNodes).map((node) => ({
        handle: node.innerText,
        url: node.href,
      }));
      nameNodes.forEach((el) => {
        const name = el.innerText;
        const profileUrl = el.href;
        authorDetails.push({ name, profileUrl });
      });

      const dateTime = el.querySelector('time').innerText.split('•');

      return { authorDetails, twitterDetails, dateTime };
    }
  );

  const articleImgUrl = await articlePage.$eval('img', (el) => el.src);
  const htmlContent = await articlePage.$eval(
    'div.article-content',
    (content) => {
      const iframes = content.querySelectorAll('div.embed.breakout');
      iframes.forEach((frame) => {
        frame.remove();
      });
      return content.innerHTML;
    }
  );

  const articleTags = await articlePage.$$eval(
    'div.article__tags ul > li',
    (tags) => tags.map((tag) => tag.innerText)
  );
  await browser.close();
  return {
    authorDetails,
    dateTime,
    authorDetails,
    htmlContent,
    articleImgUrl,
    articleTags,
    twitterDetails,
  };
};
