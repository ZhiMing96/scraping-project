const sgInvestors = require('./investorProfiles/Singapore_Investors.json');
const phInvestors = require('./investorProfiles/Philippines_Investors.json');
const mlInvestors = require('./investorProfiles/Malaysia_Investors.json');
const idInvestors = require('./investorProfiles/India_Investors.json');
const hkInvestors = require('./investorProfiles/HK_Investors.json');
const jpnInvestors = require('./investorProfiles/Japan_Tokyo_investors.json');
const germanyInvestors = require('./investorProfiles/Germany_investors.json');
const fs = require('fs');
const orgDetails = require('./orgdetails.json');
const investorsParsed = require('./allInvestorsParsed.json');
const redirects = require('./redirect-trace.json');
const onigiriOrgs = require('./onigiri_orgs.json');

const { parseCrunchbase, getOrgDetails } = require('./crunchbase-scraper');

const repopulateRedirects = async () => {
  for await (const info of redirects) {
    console.log('------- fetching info for: ', info.from);
    await parseCrunchbase(info.from, 'germany-investors', info.correct);
    console.log('------- done -------');
  }
};
// repopulateRedirects();
const fetchInvestorProfiles = async () => {
  const investorList = germanyInvestors.investor_profiles;
  const names = [
    // 'Act Venture Capital',
    'Baird Capital',
    // 'BMW i Ventures',
    // 'Dynamo Ventures',
    'eCAPITAL Entrepreneurial Partners',
    'Force Over Mass',
    'Industrifonden',
    'Innovacom',
    // '3M Ventures',
    // 'Prime Ventures',
    // 'Vertex Ventures',
  ];

  console.log('num of investors in list: ', investorList.length);
  for await (const investor of investorList) {
    if (investorsParsed.includes(investor.name)) {
      console.log('Investor already parsed: ', investor.name);
      continue;
    }
    if (names.includes(investor.name)) {
      console.log('------- fetching info for: ', investor.name);
      await parseCrunchbase(investor.name, 'germany-investors');
      console.log('------- done -------');
    }
  }
};
// fetchInvestorProfiles();

const fixSingleOrgDetail = async (detail) => {
  const orgDetail = await getOrgDetails(
    `https://www.crunchbase.com/organization/${detail}`
  );
  orgDetails[detail] = orgDetail;
  fs.writeFileSync('orgdetails.json', JSON.stringify(orgDetails));
};
// fixSingleOrgDetail('global-risk-partners');

const fixOrgDetails = async () => {
  for (const detail in orgDetails) {
    const value = orgDetails[detail];
    if (value.error || Object.keys(value).length === 1) {
      console.log('error in org: ', detail);
      const orgDetail = await getOrgDetails(
        `https://www.crunchbase.com/organization/${detail}`
      );
      orgDetails[detail] = orgDetail;
    }
  }

  // fs.writeFile('orgdetails.json', JSON.stringify(orgDetails), (err) => {
  //   if (err) throw err;
  //   console.log('Saved!');
  // });
};
// fixOrgDetails();

const parseOrgDetails = () => {
  const standardInfo = [
    'acquiredBy',
    'location',
    'employeeCount',
    'lastFundingRound',
    'ipoStatus',
    'website',
    'cbRank',
  ];
  for (const detail in orgDetails) {
    const details = orgDetails[detail];
    if (onigiriOrgs.includes(detail)) {
      delete orgDetails[detail];
      continue;
    }

    if (details.highlights) {
      const totalFundingAmt = details.highlights[0]['Total Funding Amount'];
      const investorCount = details.highlights[0]['Investors'];
      details.totalFundingAmt = totalFundingAmt || null;
      details.investorCount = investorCount || null;
      delete details.highlights;
    } else {
      details.totalFundingAmt = null;
      details.investorCount = null;
    }
    const detailedInfo = details.detailedInfo;
    if (detailedInfo && detailedInfo.industries) {
      const industries = detailedInfo.industries.map(
        ({ industry }) => industry
      );
      details.industries = industries;
      delete details.detailedInfo;
    } else {
      details.industries = [];
      delete details.detailedInfo;
    }
    standardInfo.forEach((header) => {
      if (!details[header]) {
        details[header] = null;
      }
    });
    orgDetails[detail] = details;
  }

  return orgDetails;

  // fs.writeFileSync('orgDetailsForInsertion.json', JSON.stringify(orgDetails));
  // console.log('Saved!');
};
// parseOrgDetails();

const generateOrgDetailSQLInsert = () => {
  const keys = [
    'permaLink',
    'orgName',
    'description',
    'location',
    'employeeCount',
    'lastFundingRound',
    'ipoStatus',
    'website',
    'cbRank',
    'socialLinks',
    'profileType',
    'totalFundingAmt',
    'investorCount',
    'industries',
    'acquiredBy',
  ];
  // has to be same order as array above
  let sql =
    'INSERT INTO onigiri.portfolio_companies (unique_identifier, company_name, description, headquarters_location, employee_count, last_funding_round,ipo_status,website,cb_rank,social_links,profile_type,total_funding_amt,investor_count,industries,acquired_by, data_source) VALUES \n';

  const processedOrgs = parseOrgDetails();

  for (org in processedOrgs) {
    const details = processedOrgs[org];
    let values = '(';
    keys.forEach((key) => {
      let info = details[key];
      if (!info) {
        values += null + ', ';
      } else if (isNaN(info)) {
        info = info.toString();
        if (info.includes("'")) {
          info = info.split("'").join("''");
        }
        values += "'" + info + "', ";
      } else {
        if (Array.isArray(info) && info.length === 0) {
          info = null;
        }
        values += info + ', ';
      }
    });
    // values = values.slice(0, -2) + '),\n';
    values += "'CRUNCHBASE'" + '),\n';
    sql += values;
  }
  sql = sql.trim();
  sql = sql.slice(0, -1) + ';';
  // console.log(sql);
  fs.writeFileSync('insertAllPortco.sql', sql);
};
generateOrgDetailSQLInsert();

const generateInsertSqlForHighlights = (
  queryToGetInvestorProfileId,
  totalInvestments,
  totalLeadCount,
  totalExitCount,
  totalDiversityInvestment
) => {
  const sql = `UPDATE onigiri.investor_profiles SET total_investments = ${
    totalInvestments ? parseInt(totalInvestments) : null
  }, total_lead_count = ${
    totalLeadCount ? parseInt(totalLeadCount) : null
  }, total_exit_count = ${
    totalExitCount ? parseInt(totalExitCount) : null
  }, diversity_investments = ${
    totalDiversityInvestment ? parseInt(totalDiversityInvestment) : null
  } WHERE id = (${queryToGetInvestorProfileId});\n`;

  let data = fs.readFileSync('./updateInvestorProfileHighlights.sql', {
    encoding: 'utf8',
    flag: 'r',
  });
  data += sql;
  fs.writeFileSync('./updateInvestorProfileHighlights.sql', data);
};

const generateDiversityUpdateScripts = (orgPermaLink, diversityTag) => {
  const sql = `UPDATE onigiri.portfolio_companies SET diversity_tag = '${diversityTag}' WHERE unique_identifier = '${orgPermaLink}';\n`;

  let data = fs.readFileSync('./updatePortcoDiversity.sql', {
    encoding: 'utf8',
    flag: 'r',
  });
  data += sql;
  fs.writeFileSync('./updatePortcoDiversity.sql', data);
};

const getPermaLinkFromOrgName = (orgName) => {
  for (const [key, value] of Object.entries(orgDetails)) {
    if (value.orgName === orgName) {
      console.log('key found!', key);
      return key;
    }
  }
  console.log('Key not found for org', orgName);
};

const processInvestmentHistory = () => {
  let bulkInsertStatement = `INSERT INTO onigiri.investments (announcement_date,funding_round,amt_raised,is_lead,org_identifier, investment_type, investor_profiles_id, portfolio_companies_id, data_source) VALUES\n`;
  fs.truncateSync('./updateInvestorProfileHighlights.sql');
  // fs.truncateSync('./singapore-insertion/updatePortcoDiversity copy.sql');
  germanyInvestors.investor_profiles.forEach((investor) => {
    const name = investor.name;
    // const investorProfileId = investor.id;
    const location = investor.headquarter_location;
    const processedName = name.split("'").join("''");
    const processedLocation = location.split("'").join("''");

    const queryToGetInvestorProfileId = `SELECT id FROM onigiri.investor_profiles WHERE "name" = '${processedName}' AND headquarter_location = '${processedLocation}'`;

    const fileName = name.toLowerCase().split(' ').join('-');
    const path = `./germany-investors/${fileName}-crunch-base.json`;
    console.log(path);
    // try {
    // } catch (err) {}
    const data = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
    const allInvestmentInfo = JSON.parse(data);
    const investmentInfo = allInvestmentInfo[fileName];
    if (investmentInfo.error) {
      console.log('!!!!!!!!!! Skipping This investor because of error: ', name);
      return;
    }

    let {
      recentInvestments,
      diversityInvestments,
      notableExits,
      investmentHighlights,
    } = investmentInfo;

    if (investmentHighlights) {
      // only run this if the keys have extra spaces
      const totalExitCount = investmentHighlights['Exits'];
      const totalInvestments = investmentHighlights['Investments'];
      const totalLeadCount = investmentHighlights['Lead Investments'];
      const totalDiversityInvestment =
        investmentHighlights['Diversity Investments'];
      generateInsertSqlForHighlights(
        queryToGetInvestorProfileId,
        totalInvestments,
        totalLeadCount,
        totalExitCount,
        totalDiversityInvestment
      );
    }
    if (!recentInvestments) {
      recentInvestments = [];
    }
    if (!diversityInvestments) {
      diversityInvestments = [];
    }
    if (!notableExits) {
      notableExits = [];
    }

    const filteredRecentInvestments = recentInvestments.map((investment) => {
      const announcementDate = investment['Announced Date'].value;
      const isLead = investment['Lead Investor'].value === 'Yes' ? true : false;
      const fundingRound = investment['Funding Round'].value;
      const amtRaised =
        investment['Money Raised'].value === '—'
          ? null
          : investment['Money Raised'].value;
      const orgSection = investment['Organization Name'];
      const permaLink = orgSection ? orgSection.orgDetails.permaLink : null;
      if (!permaLink) {
        console.log('no permaLink for this guy:', investment);
      }
      return {
        announcementDate,
        fundingRound,
        amtRaised,
        isLead,
        orgIdentifier: permaLink,
        type: 'Recent',
      };
    });
    console.log(
      'filteredRecentInvestments length',
      filteredRecentInvestments.length
    );

    diversityInvestments.forEach((investment) => {
      const orgSection = investment['Organization Name'];
      const permaLink = orgSection ? orgSection.orgDetails.permaLink : null;
      const diversityTag = investment['Diversity Spotlight (US Only)'].value;
      generateDiversityUpdateScripts(permaLink, diversityTag);
    });

    const filteredDiversityInvestments = diversityInvestments.map(
      (investment) => {
        const announcementDate = investment['Announced Date'].value;
        const fundingRound = investment['Funding Round'].value;
        const amtRaised =
          investment['Money Raised'].value === '—'
            ? null
            : investment['Money Raised'].value;
        const orgSection = investment['Organization Name'];
        const permaLink = orgSection ? orgSection.orgDetails.permaLink : null;
        console.log('permaLink', permaLink);
        return {
          announcementDate,
          fundingRound,
          amtRaised,
          isLead: null,
          orgIdentifier: permaLink,
          type: 'Diversity',
        };
      }
    );
    const filteredExitsInvestments = notableExits.map((company) => {
      const orgDetail = company.orgDetails;
      if (!orgDetail) {
        console.log('GGWP orgDetails key not in notable exit', company);
      }
      if (orgDetail.error) {
        console.log('GG org in notable exit not fixed', orgDetail.permaLink);
        return;
      }
      if (!orgDetail.permaLink) {
        console.log('no permaLink for org', orgDetail.orgName);
        const identifier = getPermaLinkFromOrgName(orgDetail.orgName);
        if (!identifier) return;
        orgDetail.permaLink = identifier;
      }
      return {
        announcementDate: null,
        fundingRound: null,
        amtRaised: null,
        isLead: null,
        orgIdentifier: orgDetail.permaLink,
        type: 'Unknown',
      };
    });

    filteredRecentInvestments
      .concat(filteredDiversityInvestments)
      .concat(filteredExitsInvestments)
      .forEach((investmentObj) => {
        let tmpString = '(';
        Object.keys(investmentObj).forEach((key) => {
          let value = investmentObj[key];
          if (isNaN(value)) {
            if (!value) {
              console.log(
                `key ${key} of ${investmentObj.orgIdentifier} is undefined`,
                investmentObj
              );
            }
            value = value.toString();
            if (value.includes("'")) {
              value = value.split("'").join("''");
            }
            tmpString += "'" + value + "', ";
          } else {
            if (typeof value == 'boolean') {
              tmpString += value.toString() + ', ';
            } else {
              tmpString += value + ', ';
            }
          }
        });
        tmpString += '(' + queryToGetInvestorProfileId + '), ';
        const queryToGetOrgProfileId = `SELECT id FROM onigiri.portfolio_companies WHERE unique_identifier = '${investmentObj.orgIdentifier}'`;
        tmpString += '(' + queryToGetOrgProfileId + "), 'CRUNCHBASE'),\n";
        bulkInsertStatement += tmpString;
      });
  });
  bulkInsertStatement = bulkInsertStatement.trim();
  bulkInsertStatement = bulkInsertStatement.slice(0, -1) + ';';
  // console.log(bulkInsertStatement);
  try {
    fs.writeFileSync('./insertInvestmentHistory copy.sql', bulkInsertStatement);
    console.log('saved file');
  } catch (e) {
    console.error(err);
  }
};
// processInvestmentHistory();

// const getInvestmentDetails = async (name, filePath) => {
//   await parseCrunchbase(name, filePath);
// };

// getInvestmentDetails('mystartr', 'india-investors');

const cleanUpInvestmentJank = () => {
  germanyInvestors.investor_profiles.forEach((investor) => {
    const name = investor.name;

    const fileName = name.toLowerCase().split(' ').join('-');
    const path = `./germany-investors/${fileName}-crunch-base.json`;
    console.log('parsing this now:', path);
    const data = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' });
    const allInvestmentInfo = JSON.parse(data);
    investmentInfo = allInvestmentInfo[fileName];
    if (investmentInfo.error) {
      console.log('!!!!!!!!!! This investor has an error: ', name);
      return;
    }
    let {
      recentInvestments,
      diversityInvestments,
      investmentHighlights,
      notableExits,
    } = investmentInfo;
    if (investmentHighlights) {
      Object.keys(investmentHighlights).forEach((key) => {
        const keysArray = [
          'Exits',
          'Investments',
          'Lead Investments',
          'Acquisitions',
          'Diversity Investments',
        ];
        if (keysArray.includes(key)) {
          return;
        }
        const value = investmentHighlights[key];
        const oldKey = key;
        const newKey = key.trim();
        investmentHighlights[newKey] = value;
        delete investmentHighlights[oldKey];
      });
    }
    recentInvestments =
      recentInvestments &&
      recentInvestments.map((investment) => fix(investment));
    diversityInvestments =
      diversityInvestments &&
      diversityInvestments.map((investment) => fix(investment));
    investmentInfo.recentInvestments = recentInvestments;
    investmentInfo.diversityInvestments = diversityInvestments;
    if (notableExits) {
      notableExits.forEach((company) => {
        const orgDetail = company.orgDetails;
        if (!orgDetail) {
          console.log('GGWP orgDetails key not in notable exit', company);
        }
        if (!orgDetail.permaLink) {
          console.log('no permaLink for org', orgDetail.orgName);
          const identifier = getPermaLinkFromOrgName(orgDetail.orgName);
          if (!identifier) return;
          orgDetail.permaLink = identifier;
        }
        if (!orgDetail.error) {
          return;
        }
        console.log(
          'Org in notable exit not fixed, looking up db now.....',
          orgDetail.permaLink
        );
        const orgInRecord = orgDetails[orgDetail.permaLink];
        if (!orgInRecord) {
          console.log(
            '!! GG orgDetail.json does not have this org as well: ',
            orgDetail.permaLink
          );
        }
        company.orgDetails = orgInRecord;
        console.log('Yay found', company.orgDetails);
      });
    }

    const permaLink = investmentInfo.permalink;
    delete investmentInfo.permalink;
    investmentInfo.permaLink = permaLink;

    const obj = {};
    obj[fileName] = investmentInfo;
    // console.log('obj: ', obj);

    fs.writeFileSync(path, JSON.stringify(obj));
    console.log('saved');
  });
};
const fix = (investment) => {
  const orgSection = investment['Organization Name'];
  if (
    orgSection &&
    !orgSection.orgDetails.error &&
    orgSection.orgDetails.permaLink
  ) {
    return investment;
  }
  if (!orgSection) {
    console.log('!!!!!!!!! GG this guy no orgSection at all', investment);
  }
  let permaLink = orgSection.orgDetails.permaLink;

  if (!permaLink) {
    permaLink = orgSection.link.split('/').pop();
    orgSection.orgDetails.permaLink = permaLink;
  }

  if (orgSection.orgDetails.error) {
    orgDetail = orgDetails[permaLink];
    if (orgDetail) {
      console.log('filling in orgDetail:', orgDetail);
      orgSection.orgDetails = orgDetail;
    } else {
      console.log("!!!!!! gg can't find org details in portco list", permaLink);
    }
  }
  investment['Organization Name'] = orgSection;
  return investment;
};
// cleanUpInvestmentJank();
