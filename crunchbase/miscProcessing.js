// const antlerList = require('./antler_vcs.json');
// const onigiriList = require('./onigiri_investors.json');
// const sgInvestors = require('./investorProfiles/Singapore_Investors.json');
// const phInvestors = require('./investorProfiles/Philippines_Investors.json');
// const mlInvestors = require('./investorProfiles/Malaysia_Investors.json');
// const idInvestors = require('./investorProfiles/India_Investors.json');
// const hkInvestors = require('./investorProfiles/HK_Investors.json');
// const jpnInvestors = require('./investorProfiles/Japan_Tokyo_investors.json');
const fs = require('fs');
const orgDetails = require('./orgdetails.json');
const orgdetailOld = require('./orgdetails-old.json');

const generalDownMigrationForNewlyAddedPortcos = (
  migrationDirectory,
  filePathToInvestors
) => {
  let uniqueIdentifiers = [];
  migrationDirectory = migrationDirectory ? migrationDirectory : '';
  let investorData;
  try {
    investorData = require(`${filePathToInvestors}`);
  } catch (e) {
    console.log(`${filePathToInvestors} invalid: `, e.message);
    return;
  }
  if (!investorData) return;
  for (const detail in orgDetails) {
    if (!Object.keys(orgdetailOld).includes(detail)) {
      if (detail.includes("'")) {
        detail = detail.split("'").join("''");
      }
      const detailStr = "'" + detail + "'";
      uniqueIdentifiers.push(detailStr);
      continue;
    }
  }
  // change this to loop through investors that has been scraped
  const names = investorData.investor_profiles.map(({ name }) => {
    if (name.includes("'")) {
      name = name.split("'").join("''");
    }
    return "'" + name + "'";
  });
  const sql = `DELETE FROM onigiri.portfolio_companies WHERE unique_identifier IN (${uniqueIdentifiers});`;
  const sql2 = `DELETE FROM onigiri.investments WHERE org_identifier IN (${uniqueIdentifiers});`;
  const sql3 = `DELETE FROM onigiri.invesments WHERE investor_profile_id IN (SELECT id FROM onigiri.investor_profiles WHERE name IN (${names}))`;
  fs.writeFileSync(`.${migrationDirectory}/downSqlForPortco.sql`, sql);
  fs.writeFileSync(
    `.${migrationDirectory}/downSqlForInvestmentHistory.sql`,
    sql2
  );
  // fs.writeFileSync('downSqlForInvestmentHistory2.sql', sql3);
};

const generalDownMigrationForInvestorProfilesEdits = (
  migrationDirectory,
  filePathToInvestors
) => {
  migrationDirectory = migrationDirectory ? migrationDirectory : '';
  let investorData;
  try {
    investorData = require(`${filePathToInvestors}`);
  } catch (e) {
    console.log(`${filePathToInvestors} invalid: `, e.message);
    return;
  }
  if (!investorData) return;
  const ids = investorData.investor_profiles
    .map(({ name }) => {
      if (name.includes("'")) {
        name = name.split("'").join("''");
      }
      return "'" + name + "'";
    })
    .slice(0, -1);

  const sql = `UPDATE onigiri.investor_profiles SET total_investments = null, total_lead_count = null, total_exit_count = null, diversity_investments = null WHERE name IN (${ids});`;
  fs.writeFileSync(`.${directory}/downSqlForHighlights.sql`, sql);
};
// getAllIds();

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
// compileListOfInvestors();
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

module.exports = {
  generalDownMigrationForNewlyAddedPortcos,
  generalDownMigrationForInvestorProfilesEdits,
};
