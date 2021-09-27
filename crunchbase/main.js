const {
  fixOrgDetails,
  generateOrgDetailSQLInsert,
  cleanUpInvestmentJank,
  processInvestmentHistory,
  fetchInvestorProfiles,
  removeCorrectRedirects,
  fetchSingleInvestor, // to fix single investor
} = require('./processing.js');

const {
  generalDownMigrationForNewlyAddedPortcos,
  generalDownMigrationForInvestorProfilesEdits,
} = require('./miscProcessing');

const fs = require('fs');

const migrationDirectory = './migrations';
const filePathToInvestors = './united-states-investors.json';
const folderToSaveData = './scrapped-us-investors';

const scrapeData = async () => {
  if (!fs.existsSync(`${folderToSaveData}`)) {
    fs.mkdirSync(`${folderToSaveData}`);
  }
  try {
    await fetchInvestorProfiles(filePathToInvestors, folderToSaveData);
  } catch (e) {
    console.log('scrapping terminated due to error', e.message);
  }
};
// scrapeData();

const processData = async () => {
  try {
    if (!fs.existsSync(`${migrationDirectory}`)) {
      fs.mkdirSync(`${migrationDirectory}`);
    }
    if (!fs.existsSync(`${folderToSaveData}`)) {
      fs.mkdirSync(`${folderToSaveData}`);
    }
    fs.writeFileSync(`./investors-require-manual-fix.json`, '[]');
    await fixOrgDetails();
    generateOrgDetailSQLInsert(migrationDirectory);

    await cleanUpInvestmentJank(filePathToInvestors, folderToSaveData);
    const manualFixingList = require('./investors-require-manual-fix.json');
    // For investors who do not exist on crunchbase, change error to "error: not found"

    if (manualFixingList.length > 0) {
      throw new Error(
        'Manually fix all investors in ./investors-require-manual-fix.json before proceeding'
      );
    }

    // From here onwards if an investor has an error, we will skip it because the assumption is that they do not exist on cb.
    await processInvestmentHistory(
      migrationDirectory,
      filePathToInvestors,
      folderToSaveData
    );
    generalDownMigrationForNewlyAddedPortcos(
      migrationDirectory,
      filePathToInvestors
    );
    generalDownMigrationForInvestorProfilesEdits(
      migrationDirectory,
      filePathToInvestors
    );
  } catch (err) {
    console.log('Failed to process all investments: ', err);
  }
};
processData();

// to fix manual  jank
// fetchSingleInvestor(
//   "Arthur Ventures",
//   folderToSaveData,
//   '',
//   'arthur-ventures-llc'
// );
