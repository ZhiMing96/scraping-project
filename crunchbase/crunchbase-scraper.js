// const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const fetch = require('node-fetch');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const adblocker = AdblockerPlugin({
  blockTrackers: true, // default: false
});
puppeteer.use(adblocker);
puppeteer.use(StealthPlugin());

const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: {
      // this needed for mouse click
      width: 840,
      height: 630,
    },
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );

  return { browser, page };
};
const handlePageGoTo = async (page, url, searchTerm) => {
  // handle captcha and page notfound
  const timeout = Math.random() * 3000;
  console.log('navigating to url: ', url);
  let isRedirected = false;
  try {
    await page.goto(url, { timeout: 10000, waitUntil: ['domcontentloaded'] });
    console.log('page.goto done..');
    await page.waitForTimeout(timeout);
  } catch (err) {
    console.log('Error - First Navigation Timeout: ', err.message);
    console.log('Start 5s pause...');
    await page.waitForTimeout(5000);
    console.log('Reloading...');
    try {
      await page.reload({ waitUntil: ['domcontentloaded'] });
    } catch (err) {
      await page.screenshot({
        path: `./screenshots-error/reload-error-${searchTerm}.jpeg`,
        type: 'jpeg',
      });
      console.error(
        `please refer to screenshot taken here ${__dirname}/reload-error-${searchTerm}.jpeg`
      );
      console.log('Timeout Error After Reload: ', err.message);
    }
  }

  console.log('navigated...');
  try {
    await crunchbaseCaptchaBypass(page);
    const notFound = await checkForPageNotFound(page);
    if (notFound) {
      await handlePageNotFound(searchTerm, page);
      isRedirected = true;
    }
    console.log('done with go to');
    return isRedirected;
  } catch (e) {
    const notFound = await checkForPageNotFound(page);
    if (notFound) {
      await handlePageNotFound(searchTerm, page);
      isRedirected = true;
    }
    return isRedirected;
  }
};
const parseCrunchbase = async (
  ventureFirmName,
  folderToSaveTo,
  ventureFirmWebsite,
  correctPermaLink
) => {
  if (!folderToSaveTo) return;
  const { browser, page } = await launchBrowser();
  const permaLinkBasedOnVentureName = ventureFirmName
    .toLowerCase()
    .split(' ')
    .join('-');
  const urlName = correctPermaLink
    ? correctPermaLink
    : permaLinkBasedOnVentureName;
  console.log(urlName);
  const cbUrl = formatUrl(urlName);
  try {
    const investmentDetails = (await handleProfileTypes(
      page,
      cbUrl,
      ventureFirmWebsite
    )) || {
      error: 'Error getting Investment Details',
    };
    investmentDetails['permaLink'] = page.url().split('/')[4];
    const ventureInvestmentDetails = {};
    ventureInvestmentDetails[permaLinkBasedOnVentureName] = investmentDetails;
    const stringifiedData = JSON.stringify(ventureInvestmentDetails);
    try {
      fs.writeFileSync(
        `${folderToSaveTo}/${permaLinkBasedOnVentureName}-crunch-base.json`,
        stringifiedData,
        { encoding: 'utf8', flag: 'w' }
      );
      console.log(
        `Investor details saved successfully at ${folderToSaveTo}/${permaLinkBasedOnVentureName}-crunch-base.json`
      );
    } catch (err) {
      console.log('FAILED TO SAVE FILE FOR INVESTOR', ventureFirmName);
      console.log(err.message);
    }
    await browser.close();
    return ventureInvestmentDetails;
  } catch (err) {
    console.error('parseCrunchbase error: ', err);
    await page.screenshot({
      path: `./screenshots-error/root-error-${urlName}.jpeg`,
      type: 'jpeg',
    });
    console.error(
      `please refer to screenshot taken here ${__dirname}/screenshots-error/root-error${urlName}.jpeg`
    );
    await browser.close();
    return;
  }

  // await getFundingDetails(page);
  // await getEmployeeDetails(page);
};
const formatUrl = (urlName) => {
  return `https://www.crunchbase.com/organization/${urlName}`;
};
const crunchbaseCaptchaBypass = async (page) => {
  await page.waitForSelector('#px-captcha', { timeout: 3300 });
  console.log('captcha detected, waiting for 3.5s...');
  await page.waitForTimeout(3500);
  console.log('mouse pressing bypass..');
  await page.mouse.click(200, 200, { button: 'left', delay: 4500 });
  // await page.screenshot({
  //   path: `./${page.url().split('/').pop()}-captcha.jpeg`,
  //   type: 'jpeg',
  // });
  console.log('Bypass (shld be) completed');
  await page.waitForTimeout(2000);
  return;
};

const checkForPageNotFound = async (page) => {
  try {
    await page.waitForSelector('page-not-found', { timeout: 2500 });
    return true;
  } catch (e) {
    return false;
  }
};

const handlePageNotFound = async (searchTerm, page) => {
  // search and take the top result
  const urlEncodeSearchTerm = searchTerm
    .split(' ')
    .join('%20')
    .split('-')
    .join('%20');
  try {
    const results = await page.evaluate(async (urlEncodeSearchTerm) => {
      const res = await fetch(
        `https://www.crunchbase.com/v4/data/autocompletes?query=${urlEncodeSearchTerm}&collection_ids=organizations&limit=5&source=topSearch`
      );
      const json = await res.json();
      return json.entities;
    }, urlEncodeSearchTerm);
    const topResultPermaLink =
      results.length > 0 ? results[0].identifier.permalink : '';
    if (!topResultPermaLink || topResultPermaLink === '') return;

    let trace = require('./redirect-trace.json');
    const obj = { from: searchTerm, to: topResultPermaLink };
    trace.push(obj);
    try {
      fs.writeFileSync('./redirect-trace.json', JSON.stringify(trace), {
        encoding: 'utf8',
        flag: 'w',
      });
      console.log('Saved redirect!');
    } catch (err) {
      console.log('Failed to save redirect!', err.message);
      console.log('redirect that failed: ', topResultPermaLink);
    }
    console.log('Redirect from Not Found:', topResultPermaLink);
    await handlePageGoTo(
      page,
      `https://www.crunchbase.com/organization/${topResultPermaLink}`,
      ''
    );
  } catch (e) {
    console.log('error - handlePageNotFound :', e);
  }
};

const getInvestmentDetails = async (page, firmUrl) => {
  try {
    await crunchbaseCaptchaBypass(page);
    const investorDetails = await handleProfileTypes(page, firmUrl);

    return investorDetails;
  } catch (e) {
    const investorDetails = await handleProfileTypes(page, firmUrl);

    return investorDetails;
  }
};

const handleProfileTypes = async (page, firmUrl, websiteToMatch) => {
  const searchTerm = firmUrl.split('/').pop();
  const isRedirected = await handlePageGoTo(page, firmUrl, searchTerm);
  const investmentDetails = await handleParseInvestmentsRedirect(
    page,
    websiteToMatch,
    isRedirected
  );
  return investmentDetails;
};
const handleParseInvestmentsRedirect = async (
  page,
  websiteToMatch,
  isRedirected
) => {
  const timeout = Math.random() * 1000;
  await page.waitForTimeout(timeout);
  try {
    await page.waitForSelector('div.mat-tab-link-container', {
      timeout: 7000,
    });
  } catch (e) {
    await handlePageGoTo(page, page.url(), page.url().split('/').pop());
    await page.waitForTimeout(1000);
  }
  websiteToMatch = isRedirected ? websiteToMatch : undefined;
  let orgDetails = await parseOrgDetails(page, websiteToMatch);
  if (isRedirected) {
    if (orgDetails && orgDetails['error']) {
      if (orgDetails['error'].includes('Redirect Failed')) {
        return { error: orgDetails['error'] };
      }
    } else {
      console.log('Redirect was successful! removing from redirect-trace now');
      const permaLink = page.url().split('/').pop();
      let redirects = require('./redirect-trace.json');
      redirects = redirects.filter(({ to }) => to !== permaLink);
      fs.writeFileSync('./redirect-trace.json', JSON.stringify(redirects));
      console.log('updated redirect-trace.json');
    }
  }

  const tabNavigations = await page.$$eval('div.mat-tab-links > a', (tabs) =>
    tabs.map((tab) => ({ value: tab.innerText.toLowerCase(), link: tab.href }))
  );
  let linkWithInvestmentDetails = '';
  for (let i = tabNavigations.length - 1; i >= 0; i--) {
    const tabValue = tabNavigations[i].value;
    const tabLink = tabNavigations[i].link;
    if (tabValue === 'investments') {
      linkWithInvestmentDetails = tabLink;
      break;
    } else if (tabValue === 'financials') {
      linkWithInvestmentDetails = tabLink;
      break;
    } else if (tabValue === 'summary') {
      return orgDetails;
    } else {
      continue;
    }
  }
  if (linkWithInvestmentDetails === '') return;
  // console.log('redirecting to url: ', linkWithInvestmentDetails);
  await handlePageGoTo(page, linkWithInvestmentDetails, '');
  const investmentDetails = await parseInvestmentDetails(page);
  if (!investmentDetails) return orgDetails;

  investmentDetails['orgDetails'] = orgDetails;
  return investmentDetails;
};

const parseInvestmentDetails = async (page) => {
  try {
    try {
      await page.waitForSelector('row-card.overview-card', { timeout: 7000 });
    } catch (e) {
      await handlePageGoTo(page, page.url(), page.url().split('/').pop());
      await page.waitForTimeout(1000);
    }
    const investmentSummarySection = await page.$$eval(
      'phrase-list-card.ng-star-inserted',
      (contents) => contents.map((content) => content.innerText)
    );
    const investmentHighlights = {};
    try {
      const highlights = await page.$$(
        'anchored-values.ng-star-inserted > div.spacer.ng-star-inserted'
      );
      for await (const highlight of highlights) {
        const header = await highlight.$eval('label-with-info', (el) =>
          el.innerText ? el.innerText.trim() : el.innerText
        );
        const value = await highlight.$eval(
          'field-formatter',
          (el) => el.innerText
        );
        investmentHighlights[header] = value;
      }
    } catch (e) {
      console.log('Investor has no highlights');
    }

    const recentInvestments = [];
    const sections = await page.$$(
      'div.main-content > row-card.ng-star-inserted'
    );
    let investmentSection;
    let exitsSection;
    let diversitySection;
    for await (const section of sections) {
      const heading = await section.$eval('h2', (el) =>
        el.innerText.toLowerCase()
      );
      if (heading === 'investments') {
        investmentSection = section;
      }
      if (heading === 'exits') {
        exitsSection = section;
      }
      if (heading === 'diversity investments') {
        diversitySection = section;
      }
    }
    if (!investmentSection) return;

    const tableRows = await investmentSection.$$('tr.ng-star-inserted');
    const tableHeaders = (
      await investmentSection.$$eval('th.ng-star-inserted', (headers) =>
        headers.map((header) => header.innerText.trim())
      )
    ).slice(0, 5);

    for await (const row of tableRows) {
      const rowValues = await row.$$eval('td.ng-star-inserted', (values) =>
        values.map((rowValue) => {
          const rowLink = rowValue.querySelector('a');
          if (rowLink) {
            return {
              value: rowValue.innerText,
              link: rowLink.href,
            };
          }
          return {
            value: rowValue.innerText,
            link: null,
          };
        })
      );
      const tableValues = {};
      for (let i = 0; i < rowValues.length; i++) {
        const header = tableHeaders[i];
        tableValues[header] = rowValues[i];
      }
      recentInvestments.push(tableValues);
    }

    const diversityInvestments = [];
    if (diversitySection) {
      const tableRows = await diversitySection.$$('tr.ng-star-inserted');
      const tableHeaders = (
        await diversitySection.$$eval('th.ng-star-inserted', (headers) =>
          headers.map((header) => header.innerText.trim())
        )
      ).slice(0, 5);

      for await (const row of tableRows) {
        const rowValues = await row.$$eval('td.ng-star-inserted', (values) =>
          values.map((rowValue) => {
            const rowLink = rowValue.querySelector('a');
            if (rowLink) {
              return {
                value: rowValue.innerText,
                link: rowLink.href,
              };
            }
            return {
              value: rowValue.innerText,
              link: null,
            };
          })
        );
        const tableValues = {};
        for (let i = 0; i < rowValues.length; i++) {
          const header = tableHeaders[i];
          tableValues[header] = rowValues[i];
        }
        diversityInvestments.push(tableValues);
      }
    }

    const notableExits = [];
    if (exitsSection) {
      const notableExitNodes = await exitsSection.$$(
        'image-list-card.ng-star-inserted > ul > li'
      );
      for await (const exit of notableExitNodes) {
        let companyImgLink;
        try {
          companyImgLink = await exit.$eval('img', (el) => el.src);
        } catch (e) {
          companyImgLink = '';
        }

        const { companyName, companyCBProfileUrl } = await exit.$eval(
          'div.fields > a.link-accent',
          (el) => {
            return {
              companyName: el.innerText.trim(),
              companyCBProfileUrl: el.href,
            };
          }
        );
        let companyDescription;
        try {
          companyDescription = await exit.$eval(
            'div.fields > field-formatter > span',
            (el) => el.innerText.trim()
          );
        } catch (e) {
          companyDescription = '';
        }

        notableExits.push({
          companyName,
          companyCBProfileUrl,
          companyImgLink,
          companyDescription,
        });
      }
    }
    let companyWithDetails;
    let data = {};
    try {
      data = fs.readFileSync('orgdetails.json', {
        encoding: 'utf8',
        flag: 'r',
      });
    } catch (err) {
      console.log(
        '!!!! did not read ordDetails for this investor',
        err.message
      );
    }
    companyWithDetails = JSON.parse(data);
    let newOrgsAdded = 0;

    for await (const investment of recentInvestments) {
      try {
        const timeout = Math.random() * 1000;
        await page.waitForTimeout(timeout);
        const orgNameWithLink = investment['Organization Name'];
        const orgName = orgNameWithLink.value;
        const permaLink = orgNameWithLink.link.split('/').pop();
        console.log('getting orgdetails for: ', orgName);
        if (companyWithDetails[permaLink]) {
          orgNameWithLink.orgDetails = companyWithDetails[permaLink];
          investment['Organization Name'] = orgNameWithLink;
        } else {
          const orgDetails = await getOrgDetails(orgNameWithLink.link);
          orgNameWithLink.orgDetails = orgDetails;
          investment['Organization Name'] = orgNameWithLink;
          companyWithDetails[permaLink] = orgDetails;
          newOrgsAdded++;
        }
      } catch (e) {
        console.log(`Error parsing org. skipping...`);
        continue;
      }
    }
    try {
      console.log('New Orgs parsed: ', newOrgsAdded);
      if (newOrgsAdded > 0) {
        fs.writeFileSync(
          'orgdetails.json',
          JSON.stringify(companyWithDetails),
          {
            encoding: 'utf8',
            flag: 'w',
          }
        );
        console.log('Saved new orgdetails!');
      }
    } catch (err) {
      console.log('error saving orgDetails.json: ', err.message);
    }
    newOrgsAdded = 0;
    for await (const investment of diversityInvestments) {
      try {
        const timeout = Math.random() * 1000;
        await page.waitForTimeout(timeout);
        const orgNameWithLink = investment['Organization Name'];
        const orgName = orgNameWithLink.value;
        const permaLink = orgNameWithLink.link.split('/').pop();
        console.log('getting orgdetails for: ', orgName);
        if (companyWithDetails[permaLink]) {
          orgNameWithLink.orgDetails = companyWithDetails[permaLink];
          investment['Organization Name'] = orgNameWithLink;
        } else {
          const orgDetails = await getOrgDetails(orgNameWithLink.link);
          orgNameWithLink.orgDetails = orgDetails;
          investment['Organization Name'] = orgNameWithLink;
          companyWithDetails[permaLink] = orgDetails;
          newOrgsAdded++;
        }
      } catch (e) {
        console.log(e);
        continue;
      }
    }
    if (diversityInvestments.length > 0) {
      try {
        console.log('New Orgs parsed: ', newOrgsAdded);
        if (newOrgsAdded > 0) {
          fs.writeFileSync(
            'orgdetails.json',
            JSON.stringify(companyWithDetails),
            {
              encoding: 'utf8',
              flag: 'w',
            }
          );
          console.log('Saved new orgdetails!');
        }
      } catch (err) {
        console.log('error saving orgDetails.json: ', err.message);
      }
    }
    newOrgsAdded = 0;
    for await (const exit of notableExits) {
      try {
        const timeout = Math.random() * 1000;
        await page.waitForTimeout(timeout);
        const orgName = exit.companyName;
        const permaLink = exit.companyCBProfileUrl.split('/').pop();
        console.log('getting orgdetails for:', orgName);
        if (companyWithDetails[permaLink]) {
          exit.orgDetails = companyWithDetails[permaLink];
        } else {
          const orgDetails = await getOrgDetails(exit.companyCBProfileUrl);
          exit.orgDetails = orgDetails;
          companyWithDetails[permaLink] = orgDetails;
          newOrgsAdded++;
        }
      } catch (e) {
        console.log(e);
        continue;
      }
    }
    if (notableExits.length > 0) {
      try {
        console.log('New Orgs parsed: ', newOrgsAdded);
        if (newOrgsAdded > 0) {
          fs.writeFileSync(
            'orgdetails.json',
            JSON.stringify(companyWithDetails),
            {
              encoding: 'utf8',
              flag: 'w',
            }
          );
          console.log('Saved new orgdetails!');
        }
      } catch (err) {
        console.log('error saving orgDetails.json: ', err.message);
      }
    }

    return {
      investmentSummarySection,
      investmentHighlights,
      recentInvestments,
      diversityInvestments,
      notableExits,
    };
  } catch (e) {
    console.log('Error parsing investment details', e.message);
    return { error: e.message };
  }
};

const getOrgDetails = async (url) => {
  const { browser, page } = await launchBrowser();

  const searchTerm = url.split('/').pop();
  try {
    await handlePageGoTo(page, url, searchTerm);
    const orgDetails = await parseOrgDetails(page);
    orgDetails['permaLink'] = page.url().split('/').pop();
    await browser.close();
    return orgDetails;
  } catch (err) {
    console.log('getOrgDetails Error:', err);
    await page.screenshot({
      path: `./screenshots-error/org-detail-error-${searchTerm}.jpeg`,
      type: 'jpeg',
    });
    console.error(
      `please refer to screenshot taken here ${__dirname}/screenshots-error/org-detail-error-${searchTerm}.jpeg`
    );
    await browser.close();
    return {
      error: err.message,
      screenshotPath: `./screenshots-error/org-detail-error-${searchTerm}.jpeg`,
      html: htmlContent,
    };
  }
};

const parseOrgDetails = async (page, websiteToMatch) => {
  try {
    try {
      await page.waitForSelector('profile-header', { timeout: 7000 });
    } catch (e) {
      await handlePageGoTo(page, page.url(), page.url().split('/').pop());
      await page.waitForTimeout(1000);
    }

    const profileType = await page.$eval(
      'div.profile-type',
      (el) => el.innerText
    );

    const orgName = await page.$eval('h1.profile-name', (el) =>
      el.innerText.trim()
    );

    const aboutDetails = await page.$(
      'profile-section > section-card > mat-card'
    );
    const description = await aboutDetails.$eval('description-card', (el) =>
      el.innerText.trim()
    );
    const orgSummary = {
      orgName,
      description,
      profileType: profileType.toLowerCase(),
    };
    const headers = [
      'location',
      'employeeCount',
      'lastFundingRound',
      'ipoStatus',
      'website',
      'cbRank',
    ];
    let domainToMatch = '';
    if (websiteToMatch) {
      if (websiteToMatch.includes('//')) {
        websiteToMatch = websiteToMatch.split('//').pop();
      }
      if (websiteToMatch.includes('www.')) {
        websiteToMatch = websiteToMatch.split('www.').pop();
      }
      domainToMatch = websiteToMatch;
      console.log('domain to match for investor redirect is: ', domainToMatch);
    }
    const { values, websiteMatch } = await aboutDetails.$$eval(
      'fields-card > ul > li',
      (data, domainToMatch) => {
        let websiteMatch = false;
        let values = data.map((el) => {
          const textContent = el.innerText;
          if (
            textContent &&
            domainToMatch &&
            textContent.toLowerCase().includes(domainToMatch)
          ) {
            websiteMatch = true;
          }
          return el.innerText;
        });
        return { values, websiteMatch };
      },
      domainToMatch
    );
    try {
      if (websiteToMatch && !websiteMatch) {
        throw new Error('Redirect Failed, Website did not match');
      }
    } catch (e) {
      await page.screenshot({
        path: `./screenshots-error/redirect-error-${page
          .url()
          .split('/')
          .pop()}.jpeg`,
        type: 'jpeg',
      });
      return { error: e.message };
    }
    if (values[0].includes('Acquired by')) {
      const acquiredBy = values.shift().split('\n')[1];
      orgSummary.acquiredBy = acquiredBy;
    }
    if (values[values.length - 1].includes('Actively Hiring')) {
      values.pop();
    }
    for (let i = 0; i < values.length; i++) {
      const key = headers[i];
      orgSummary[key] = values[i];
    }
    try {
      let highlightSpanId =
        profileType.toLowerCase() === 'investment firm'
          ? 'span#investor_overview_highlights'
          : 'span#company_overview_highlights';

      const highlights = await page.$eval(
        `profile-section > ${highlightSpanId}`,
        (el) => {
          const highlightsNode = el.parentNode;
          const highlightChips = highlightsNode.querySelectorAll(
            'section-card > mat-card > div.section-content-wrapper > div.section-content > anchored-values > div'
          );
          return Array.from(highlightChips)
            .map((el) => {
              const keyNode = el.querySelector('label-with-info');
              if (!keyNode) return;
              const key = keyNode.innerText ? keyNode.innerText.trim() : '';
              const valueNode = el.querySelector('field-formatter');
              if (!valueNode) return;
              const value = valueNode.innerText
                ? valueNode.innerText.trim()
                : '';
              const obj = {};
              obj[key] = value;
              return obj;
            })
            .filter((el) => el !== undefined);
        }
      );
      orgSummary['highlights'] = highlights;
    } catch (e) {
      console.log('No Highlights', e.message);
    }

    const detailsSection = await page.$(
      'div.main-content > row-card.ng-star-inserted'
    );
    const details = await detailsSection.$$(
      'div.section-content > fields-card > ul > li'
    );
    const detailedInfo = {};
    for await (const detail of details) {
      try {
        const header = await detail.$eval('label-with-info', (el) =>
          el.innerText ? el.innerText.trim().toLowerCase() : null
        );
        if (header === 'industries') {
          const industries = await detail.$$eval(
            'chips-container > a',
            (chips) =>
              chips.map((chip) => {
                return {
                  industry: chip.innerText.trim(),
                  industryLink: chip.href,
                };
              })
          );
          detailedInfo[header] = industries;
          break;
        }
      } catch (e) {
        console.log('Error in detailed info loop');
        continue;
      }
    }
    orgSummary['detailedInfo'] = detailedInfo;
    let socialLinks;
    try {
      socialLinks = await detailsSection.$$eval(
        'div.section-content > fields-card:last-child > ul > li > field-formatter > link-formatter > a',
        (links) => links.map((link) => link.href)
      );
    } catch (e) {
      socialLinks = [];
    }

    orgSummary.socialLinks = socialLinks;
    return orgSummary;
  } catch (e) {
    console.log('Error parsing org details: ', e.message);
    await page.screenshot({
      path: `./screenshots-error/org-detail-error-${page
        .url()
        .split('/')
        .pop()}.jpeg`,
      type: 'jpeg',
    });
    return { error: e.message };
  }
};

// const getFundingDetails = async (page) => {
//   let url =
//     'https://www.crunchbase.com/organization/wavemaker-partners/investor_financials';
//   await page.goto(url);

//   try {
//     crunchbaseCaptchaBypass(page);
//     getFundingPageDetails(page);
//   } catch (e) {
//     getFundingPageDetails(page);
//   }
// };

// const getFundingPageDetails = async (page) => {
//   const sectionsOfText = await page.$$('div.section-content');
//   const fundingSummarySection = await sectionsOfText[1].$$eval(
//     'field-formatter.ng-star-inserted',
//     (texts) => texts.map((text) => text.innerText)
//   );
//   let fundingTextConnectors = [
//     'has raised a total of ',
//     ' across ',
//     ' funds, their latest being ',
//     '. This fund was announced on ',
//     ', and raised a total of ',
//   ];
//   let fundingSummary = '';
//   for (let i = 0; i < fundingSummarySection.length; i++) {
//     if (i <= fundingTextConnectors.length && i > 0) {
//       fundingSummary =
//         fundingSummary + financialStatements[i - 1] + fundingDetails[i];
//     } else {
//       fundingSummary = fundingSummary + fundingDetails[i];
//     }
//   }
//   console.log(fundingSummary);
//   return;
// };

// const getEmployeeDetails = async (page) => {
//   let url = 'https://www.crunchbase.com/organization/wavemaker-partners/people';
//   await page.goto(url);
//   try {
//     await crunchbaseCaptchaBypass(page);
//     await getEmplopyeePageDetails(page);
//   } catch (e) {
//     await getEmplopyeePageDetails(page);
//   }
// };

// const getEmplopyeePageDetails = async (page) => {
//   await page.setRequestInterception(true);
//   page.on('request', (interceptedRequest) => {
//     interceptedRequest.continue();
//   });
//   page.on('response', async (response) => {
//     const request = response.request();
//     if (request.url().includes('contacts?source=profile-contacts-card')) {
//       console.log(`---------- ${request.url()} -------------`);
//       console.log(response.json());
//     }
//   });
// };
// parseCrunchbase('kindred-capital', 'sg-investors');
// parseCrunchbase('Spiral Ventures');
// getOrgDetails('https://www.crunchbase.com/organization/superbottoms');
module.exports = { parseCrunchbase, getOrgDetails };
