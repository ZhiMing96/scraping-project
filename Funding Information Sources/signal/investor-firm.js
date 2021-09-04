const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { parseInvestorProfile } = require('./investor-profile');

const parseInvestorFirm = async (firmName) => {
  const browser = await puppeteer.launch({ headless: true, slowMo: 250 });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
  );
  try {
    const name = formatName(firmName);
    const parsedData = await getFirmDetails(page, name);
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

const getFirmDetails = async (page, name) => {
  await page.goto(`https://signal.nfx.com/firms/${name}`);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const whitelist = ['document', 'script', 'xhr', 'fetch'];
    if (!whitelist.includes(req.resourceType())) {
      return req.abort();
    }
    req.continue();
  });
  await page.waitForSelector('div.vc-search-card-grid');
  const employees = await page.$$eval(
    'div.vc-search-card-grid > div.vc-search-card.mb2',
    (people) => {
      return people.map((person) => {
        const imgNode = person.querySelector('div > img');
        const imgLink = imgNode.src;
        const nameNode = person.querySelector('a.vc-search-card-name');
        const name = nameNode.innerText;
        const investorProfileLink = nameNode.href;
        const titleNode = person.querySelector('a.vc-search-card-name + div');
        const firm = titleNode.querySelector('a').innerText;
        const position = titleNode.querySelector('span:last-child').innerText;
        return {
          name,
          investorProfileLink,
          firm,
          position,
          imgLink,
        };
      });
    }
  );
  for await (employee of employees) {
    console.log(`parsing data for ${employee.name}`);
    const employeeDetails = await parseInvestorProfile(employee.name);
    console.log(`-- completed --`);
    employee.employeeDetails = employeeDetails;
  }
  const firmDirectoryPath = path.join(__dirname, `${name}-signal.json`);

  fs.writeFile(firmDirectoryPath, JSON.stringify(employees), (err) => {
    if (err) throw err;
    else
      console.log(
        `profile json file successfully generated at ${firmDirectoryPath}`
      );
  });
};

const formatName = (name) => {
  return name.toLowerCase().replace(' ', '-');
};

parseInvestorFirm('INITIALIZED CAPITAL');
