const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const parseSearchResult = async (searchTerm) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  try {
    const parsedData = await getSearchArticleDetails(page, searchTerm);
    // await getCategoryArticleDetails(page);
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

// const searchTerm = 'fintech';
const searchUrl = 'https://www.techinasia.com/search?query=';
const articleJsonUrl =
  'https://www.techinasia.com/wp-json/techinasia/2.0/posts/';

const category = 'investments';
const categoryUrl = 'https://www.techinasia.com/category/';

const getCategoryUrl = (categoryName) => {
  return `${categoryUrl}${categoryName}`;
};

const getArticleApiUrl = (articleSlug) => {
  return `${articleJsonUrl}${articleSlug}`;
};

const getSearchUrl = (searchTerm) => {
  return `${searchUrl}${searchTerm}`;
};

// category parsing

const getCategoryArticleDetails = async (page) => {
  await page.goto(getCategoryUrl(category));
  await page.waitForSelector('div.infinite-scroll div[data-cy="post-item"]', {
    timeout: 4000,
  });
  const scrollCount = 3;
  const articleSlugDict = {};
  const parsedArticles = [];
  for (let i = 1; i <= scrollCount; i++) {
    await getCategoryArticleSnippets(page, parsedArticles, articleSlugDict);
    await scrollToBottom(
      page,
      'div.infinite-scroll div[data-cy="post-item"]:last-child'
    );
  }
  console.log('num of articles parsed: ', parsedArticles.length);
  fs.writeFile(
    `${category}-tech-in-asia-articles.json`,
    JSON.stringify(parsedArticles),
    (err) => {
      if (err) throw err;
      else
        console.log(
          `article json file successfully generated at ${__dirname}/${category}-tech-in-asia-articles.json`
        );
    }
  );
};

const getCategoryArticleSnippets = async (
  page,
  parsedArticles,
  articleSlugDict
) => {
  const articles = await page.$$(
    'div.infinite-scroll div[data-cy="post-item"]'
  );

  for await (const article of articles) {
    const articleUrl = await article.$eval('a', (el) => el.href);
    const articleSlug = articleUrl.split('/').pop();
    if (articleSlugDict[`${articleSlug}`]) {
      console.log(`### skipping duplicated article ${articleSlug} ###`);
      continue;
    }
    articleSlugDict[`${articleSlug}`] = articleSlug;

    console.log(`--- saving article ${articleSlug} ---`);

    const articleSnippet = await article.evaluate((art) => {
      const articleInfoNode = art.childNodes[1];
      const articleSnippet = articleInfoNode.querySelector(
        '.jsx-2737968273.excerpt'
      ).innerText;
      return articleSnippet;
    });

    const fullArticleApiUrl = getArticleApiUrl(articleSlug);
    const articleRes = await fetch(fullArticleApiUrl);
    const articleJson = await articleRes.json();

    const articleJsonData = parseArticleJsonData(articleJson);
    articleJsonData['search_article_snippet'] = articleSnippet;
    articleJsonData['article_url'] = articleUrl;
    parsedArticles.push(articleJsonData);
  }
};

// search parsing
const getSearchArticleDetails = async (page, searchTerm) => {
  await page.goto(getSearchUrl(searchTerm));
  await page.waitForSelector('div.infinite-scroll > article', {
    timeout: 4000,
  });
  const scrollCount = 1;
  const articleSlugDict = {};
  const parsedArticles = [];

  for (let i = 1; i <= scrollCount; i++) {
    await getSearchArticleSnippets(page, parsedArticles, articleSlugDict);
    await scrollToBottom(page, 'div.infinite-scroll > article:last-child');
  }
  console.log('num of articles parsed: ', parsedArticles.length);
  fs.writeFile(
    `${searchTerm}-tech-in-asia-articles.json`,
    JSON.stringify(parsedArticles),
    (err) => {
      if (err) throw err;
      else
        console.log(
          `article json file successfully generated at ${__dirname}/${searchTerm}-tech-in-asia-articles.json`
        );
    }
  );
  return parsedArticles;
};

const getSearchArticleSnippets = async (
  page,
  parsedArticles,
  articleSlugDict
) => {
  const articles = await page.$$('div.infinite-scroll > article');

  for await (const article of articles) {
    const articleUrl = await article.$eval('a', (el) => el.href);
    const articleSlug = articleUrl.split('/').pop();
    if (articleSlugDict[`${articleSlug}`]) {
      console.log(`### skipping duplicated article ${articleSlug} ###`);
      continue;
    }
    articleSlugDict[`${articleSlug}`] = articleSlug;

    console.log(`--- saving article ${articleSlug} ---`);

    const articleSnippet = await article.evaluate((art) => {
      const articleInfoNode = art.childNodes[1];
      const articleSnippet = articleInfoNode.querySelector('p').innerText;
      return articleSnippet;
    });

    const fullArticleApiUrl = getArticleApiUrl(articleSlug);
    const articleRes = await fetch(fullArticleApiUrl);
    const articleJson = await articleRes.json();

    const articleJsonData = parseArticleJsonData(articleJson);
    articleJsonData['search_article_snippet'] = articleSnippet;
    articleJsonData['article_url'] = articleUrl;
    parsedArticles.push(articleJsonData);
  }
};

// universal methods
const parseArticleJsonData = (articleJson) => {
  const posts = articleJson['posts'][0];
  if (!posts) return null;
  const date_gmt = posts['date_gmt'];
  const html_content = posts['content'];
  const title = posts['title'];
  const slug = posts['slug'];
  const image_data = {
    source: posts['featured_image']['source'],
    attachment_meta: posts['featured_image']['attachment_meta'],
  };
  const categories = posts['categories'];
  const tags = posts['tags'];
  const read_time = posts['read_time'];
  const author_details = posts['author'];
  return {
    title,
    slug,
    date_gmt,
    read_time,
    html_content,
    author_details,
    categories,
    tags,
    image_data,
  };
};

async function scrollToBottom(page, lastChildSelector) {
  const delay = 2000;
  console.log('--- started scrolling ---');
  await scrollDown(page, lastChildSelector);
  await page.waitForTimeout(delay);
  console.log('--- stopped scrolling ---');
}

async function scrollDown(page, lastChildSelector) {
  await page.$eval(lastChildSelector, (e) => {
    e.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' });
  });
}

module.exports = { parseSearchResult };
