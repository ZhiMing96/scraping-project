const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const parseInvestorProfile = async (investorName) => {
  const browser = await puppeteer.launch({ headless: true, slowMo: 250 });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  try {
    const name = formatName(investorName);
    const parsedData = await getInvestorDetails(page, name);
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

const getInvestorDetails = async (page, name) => {
  await page.goto(`https://signal.nfx.com/investors/${name}`);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const whitelist = ['document', 'script', 'xhr', 'fetch'];
    if (!whitelist.includes(req.resourceType())) {
      return req.abort();
    }
    req.continue();
  });
  const dataPresent = await checkForData(page);
  if (!dataPresent) return;

  const basicInfo = await page.$eval('div.relative.identity-block', (block) => {
    const name = block.querySelector('h1').innerText;
    const titleNodes = block.querySelectorAll('h3 > span');
    const titles = Array.from(titleNodes).map((role) => role.innerText);
    const currJobTitleNode = block.querySelector('h3 + h3');
    const currJobTitle = currJobTitleNode
      ? currJobTitleNode.innerText
      : 'Unknown';
    return {
      name,
      titles,
      currJobTitle,
    };
  });

  await page.waitForSelector('div#vc-profile');

  const summaryInfoRows = await page.$$('div.line-separated-row.row');
  let summaryInfo = [];

  for await (const info of summaryInfoRows) {
    const infoChildren = await info.$$eval('div', (infos) =>
      infos.map((i) => i.innerText)
    );
    if (infoChildren.length !== 2) {
      continue;
    }
    summaryInfo.push({ label: infoChildren[0], value: infoChildren[1] });
  }

  const socialLinks = await page.$$eval('span.sn-linkset > a', (links) =>
    links.map((link) => link.href)
  );

  const investorSectors = await page.$$eval('a.vc-list-chip', (sectors) =>
    sectors.map((sector) => ({ tag: sector.innerText, link: sector.href }))
  );

  const investmentList = await getPastInvestments(page);

  const experienceData = await page.$$eval(
    'div.line-separated-row.flex.justify-between >span>span>span.middot-separator',
    (exps) =>
      exps.map((exp) => {
        const positionNode = exp.parentNode;
        const position = positionNode.innerText.trim();
        const companyNode = exp.parentNode.parentNode;
        companyNode.removeChild(positionNode);
        const company = companyNode.innerText.trim();
        const period = companyNode.nextSibling.innerText;
        return {
          position,
          company,
          period,
        };
      })
  );
  const fundingProfile = {
    basicInfo,
    socialLinks,
    experienceData,
    summaryInfo,
    investorSectors,
    investmentList,
  };
  // fs.writeFile(
  //   `${name}-signal-profile.json`,
  //   JSON.stringify(fundingProfile),
  //   (err) => {
  //     if (err) throw err;
  //     else
  //       console.log(
  //         `profile json file successfully generated at ${__dirname}/${name}-signal-profile.json`
  //       );
  //   }
  // );
  return fundingProfile;
};

const getPastInvestments = async (page) => {
  try {
    await page.waitForSelector('tbody.past-investments-table-body', {
      timeout: 3000,
    });
    const loadAllInvestments = await page.$('table + div > div > button');

    if (loadAllInvestments) await loadAllInvestments.click();

    await page.waitForSelector('tbody.past-investments-table-body');

    const recentInvestments = await page.$$(
      'tbody.past-investments-table-body > tr'
    );
    const investmentList = [];
    for await (const investment of recentInvestments) {
      const coInvestorRow = await investment.$('td.coinvestors-row');
      if (coInvestorRow) {
        const coInvestors = await coInvestorRow.evaluate((el) =>
          el.innerText.trim().split(':')[1].split(',')
        );
        ivmt = investmentList.pop();
        if (ivmt) {
          ivmt.coInvestors = coInvestors;
          investmentList.push(ivmt);
        }
        continue;
      }
      const colValues = await investment.$$eval('td > div', (cols) =>
        cols.map((col) => {
          const children = col.childNodes;
          let value = '';
          children.forEach((child) => {
            if (child.className === 'white-dot-separator') value += '·';
            else value += child.textContent;
          });
          return value;
        })
      );
      const trimmedValues = colValues.filter((val) => val !== '');
      const roundInfo = colValues.filter((val) => val.includes('·'));
      const companyName = trimmedValues[0];
      const totalRaised = trimmedValues[roundInfo.length + 1];
      const roundDetails = roundInfo.map((value) => {
        const details = value.split('·');
        const stage = details[0];
        const date = details[1];
        const roundSize = details[2];
        return {
          stage,
          date,
          roundSize,
        };
      });
      investmentList.push({
        companyName,
        roundDetails,
        totalRaised,
        coInvestors: [],
      });
    }
    return investmentList;
  } catch (e) {
    console.error('No Past Investments');
    return [];
  }
};

const formatName = (name) => {
  return name.toLowerCase().replace(' ', '-');
};

const checkForData = async (page) => {
  try {
    await page.waitForSelector('div.relative.identity-block', {
      timeout: 7000,
    });
    return true;
  } catch (e) {
    console.log('--- Profile Not Found');
    return false;
  }
};

module.exports = { parseInvestorProfile };
