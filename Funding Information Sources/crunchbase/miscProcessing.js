const antlerList = require('./antler_vcs.json');
const onigiriList = require('./onigiri_investors.json');
const sgInvestors = require('./investorProfiles/Singapore_Investors.json');
const phInvestors = require('./investorProfiles/Philippines_Investors.json');
const mlInvestors = require('./investorProfiles/Malaysia_Investors.json');
const idInvestors = require('./investorProfiles/India_Investors.json');
const hkInvestors = require('./investorProfiles/HK_Investors.json');
const jpnInvestors = require('./investorProfiles/Japan_Tokyo_investors.json');
const fs = require('fs');

const compileListOfInvestors = () => {
  const allInvestors = sgInvestors.investor_profiles
    .concat(phInvestors.investor_profiles)
    .concat(mlInvestors.investor_profiles)
    .concat(idInvestors.investor_profiles)
    .concat(hkInvestors.investor_profiles)
    .concat(jpnInvestors.investor_profiles)
    .map((investors) => investors.name)
    .sort();

  fs.writeFileSync('./allInvestorsParsed.json', JSON.stringify(allInvestors));
  console.log(`Saved, ${__dirname}/allInvestorsParsed.json`);
};
compileListOfInvestors();
const compareLists = () => {
  console.log('antler list count: ', antlerList.length);
  const outliers = antlerList.map((vc) => {
    const name = vc['VC Name'];
    if (!onigiriList.includes(name)) {
      const possibleMatches = onigiriList.filter(
        (vc) => vc.includes(name) || name.includes(vc)
      );
      let obj = {};
      obj[name] = { possibleMatches };
      return obj;
    }
  });
  const filtered = outliers.filter((data) => data !== undefined);
  console.log('no.of outliers: ', filtered.length);
  console.log(filtered);
};
// compareLists();

const processIndustries = () => {
  const currentSet = new Set(currIndustries);
  console.log('current industries count:', currentSet.size);
  console.log('new industries count:', newIndustries.length);
  let duplicateCount = 0;
  const unMatchedNewIndustries = [];
  newIndustries.forEach((industry) => {
    if (currentSet.has(industry)) {
      currentSet.delete(industry);
      duplicateCount++;
      return;
    }
    unMatchedNewIndustries.push(industry);
  });
  console.log('total duplicateCount', duplicateCount);
  console.log(
    'unMatchedNewIndustries length : ',
    unMatchedNewIndustries.length
  );
  const unMatchedCurrIndustries = [...currentSet];
  unMatchedCurrIndustries.sort();
  unMatchedNewIndustries.sort();
  const obj = {
    unMatchedCurrIndustries,
    unMatchedNewIndustries,
  };
  fs.writeFile('outliers.json', JSON.stringify(obj), (err) => {
    if (err) throw err;
    console.log('Saved!');
  });
};
// processIndustries();

const orgCheck = () => {
  for (org in processedOrgs) {
    if (Object.keys(processedOrgs[org]).length !== 15) {
      console.log('gg', Object.keys(processedOrgs[org]));
    }
  }
};
// orgCheck();
