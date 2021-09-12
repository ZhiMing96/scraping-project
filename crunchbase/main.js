const {
  fixOrgDetails,
  generateOrgDetailSQLInsert,
  cleanUpInvestmentJank,
  processInvestmentHistory,
} = require('./processing.js');

const {
  generalDownMigrationForNewlyAddedPortcos,
  generalDownMigrationForInvestorProfilesEdits,
} = require('./miscProcessing');

const fs = require('fs');

const cleanAndProcessScrappedData = async () => {
  try {
    if (!fs.existsSync('./migrations')) {
      fs.mkdirSync('./migrations');
    }
    await fixOrgDetails();
    generateOrgDetailSQLInsert('/migrations');
    await cleanUpInvestmentJank();
    await processInvestmentHistory('/migrations');
    generalDownMigrationForNewlyAddedPortcos('/migrations');
    generalDownMigrationForInvestorProfilesEdits('/migrations');
  } catch (err) {
    console.log('Failed to process all investments: ', err.message);
  }
};
cleanAndProcessScrappedData();
