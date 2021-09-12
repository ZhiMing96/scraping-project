const {
  fixOrgDetails,
  generateOrgDetailSQLInsert,
  cleanUpInvestmentJank,
  processInvestmentHistory,
  fetchInvestorProfiles,
  removeCorrectRedirects,
} = require('./processing.js');

const {
  generalDownMigrationForNewlyAddedPortcos,
  generalDownMigrationForInvestorProfilesEdits,
} = require('./miscProcessing');

const fs = require('fs');

const scrapeAndProcessData = async () => {
  try {
    if (!fs.existsSync('./migrations')) {
      fs.mkdirSync('./migrations');
    }
    if (!fs.existsSync('./scrapped-investors')) {
      fs.mkdirSync('./scrapped-investors');
    }
    removeCorrectRedirects(
      '/confidential/investorsInSingapore.json',
      'scrapped-investors'
    );
    await fixOrgDetails();
    generateOrgDetailSQLInsert('/migrations');
    await cleanUpInvestmentJank(
      '/confidential/investorsInSingapore.json',
      'scrapped-investors'
    );
    await processInvestmentHistory(
      '/migrations',
      '/confidential/investorsInSingapore.json',
      'scrapped-investors'
    );
    generalDownMigrationForNewlyAddedPortcos(
      '/migrations',
      '/confidential/investorsInSingapore.json'
    );
    generalDownMigrationForInvestorProfilesEdits(
      '/migrations',
      '/confidential/investorsInSingapore.json'
    );
  } catch (err) {
    console.log('Failed to process all investments: ', err.message);
  }
};
scrapeAndProcessData();
