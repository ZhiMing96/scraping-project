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

const migrationDirectory = './migrations';
const filePathToInvestors = '/confidential/investorsInSingapore.json';
const folderToSaveData = './scrapped-investors';

const scrapeAndProcessData = async () => {
  try {
    if (!fs.existsSync(`${migrationDirectory}`)) {
      fs.mkdirSync(`${migrationDirectory}`);
    }
    if (!fs.existsSync(`${folderToSaveData}`)) {
      fs.mkdirSync(`${folderToSaveData}`);
    }

    await fetchInvestorProfiles(filePathToInvestors, folderToSaveData);

    removeCorrectRedirects(filePathToInvestors, folderToSaveData);
    await fixOrgDetails();
    generateOrgDetailSQLInsert(migrationDirectory);
    await cleanUpInvestmentJank(filePathToInvestors, folderToSaveData);
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
    console.log('Failed to process all investments: ', err.message);
  }
};
scrapeAndProcessData();
