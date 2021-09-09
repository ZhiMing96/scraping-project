const puppeteer = require('puppeteer');
const fs = require('fs');

const twtterHandle = 'chamath';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  try {
    await getTwitterProfileDetails(page);
    // await browser.close();
  } catch (e) {
    console.error(e);
    await browser.close();
  }
})();

const getTwitterProfileDetails = async (page) => {
  await page.goto(`https://twitter.com/${twtterHandle}`);
  await page.waitForTimeout(3000);

  await page.waitForSelector('div[data-testid="tweet"]', { timeout: 4000 });
  const profileTextsNodes = await page.$$(
    'a[aria-hidden="true"] ~ div > div ~ div'
  );
  const profileDescription = [];
  for await (profileTexts of profileTextsNodes) {
    const description = await profileTexts.$$eval(
      'div > span:empty, span > a, span > span, div > a > svg',
      (texts) => texts.map((text) => text.innerText)
    );
    console.log(description);
  }

  const allTweetData = [];
  const numScrolls = 0;
  const uniqueTweetLabels = {};

  for (let i = 0; i < numScrolls; i++) {
    await getTweetData(page, allTweetData, uniqueTweetLabels);
    await page.waitForTimeout(2000);
    await scrollToBottom(page);
    await page.waitForTimeout(2000);
  }
  console.log('num of total tweets: ', allTweetData.length);
  fs.writeFile(`${twtterHandle}-tweets.json`, JSON.stringify(allTweetData));
};

const getTweetData = async (page, allTweetData, uniqueTweetLabels) => {
  const tweets = await page.$$(
    'div > section > div > div > div > div > div article'
  );

  for await (tweet of tweets) {
    const uniqueLabel = await tweet.evaluate((el) => el.attributes[0].value);
    if (uniqueTweetLabels[`${uniqueLabel}`]) {
      console.log('### skipping repeated tweet ###');
      continue;
    }

    uniqueTweetLabels[`${uniqueLabel}`] = uniqueLabel;
    const { imgLinks, profilePicUrl } = await tweet.$$eval('img', (imgs) => {
      if (imgs.length == 1) {
        return '';
      }
      const profilePicUrl = imgs[0].src;
      const imgSrcs = [];
      for (let i = 1; i < imgs.length; i++) {
        imgSrcs.push(imgs[i].src.trim());
      }
      return { imgSrcs, profilePicUrl };
    });
    const time = await tweet.$eval('time', (time) => time.innerText);

    const tweetUrl = await tweet.$eval('a', (el) => el.href);

    const isRetweet = await tweet.$eval('div[data-testid="tweet"]', (el) => {
      const retweetElement = el.parentNode.firstChild.innerText;
      if (retweetElement == '') return false;
      return true;
    });

    const articleText = await tweet.$$eval(
      'div[data-testid="tweet"] span',
      (texts) => {
        texts.forEach((text) => {
          if (
            text.lastElementChild &&
            text.lastElementChild.tagName != 'SPAN'
          ) {
            return;
          }
          while (text.lastElementChild) {
            text.removeChild(text.lastElementChild);
          }
        });
        const unwantedText = [
          '',
          '·',
          ' ',
          'Show this thread',
          'The media could not be played.',
          'Reload',
          'https://',
        ];
        const textContent = texts
          .map((text) => text.innerText)
          .filter((text) => !unwantedText.includes(text));

        return textContent;
      }
    );
    const tweetText = [];
    for (let i = 2; i < articleText.length - 3; i++) {
      tweetText.push(articleText[i]);
    }
    const tweetData = {
      tweetUrl,
      isRetweet,
      profilePicUrl,
      imgLinks,
      tweetTime: time,
      tweetUser: articleText[0],
      tweetUsername: articleText[1],
      tweetText,
      commentCount: articleText[articleText.length - 3],
      retweetCount: articleText[articleText.length - 2],
      likeCount: articleText[articleText.length - 1],
    };
    console.log('--- saving new tweet ---');
    allTweetData.push(tweetData);
  }
  return;
};

async function scrollToBottom(page) {
  const delay = 2000;
  console.log('--- started scrolling ---');
  await scrollDown(page);
  await page.waitForTimeout(delay);
  console.log('--- stopped scrolling ---');
}

async function scrollDown(page) {
  await page.$eval('div > section > div > div > div:last-child', (e) => {
    e.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' });
  });
}
