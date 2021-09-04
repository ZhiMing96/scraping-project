const fetch = require('node-fetch');
const fs = require('fs');
const investorsInfo = require('./investor-list-raw.json');

const investorDataApi =
  'https://www.startupsg.gov.sg/api/v0/search/profiles/investor?type=listing&sort=-changed&from=';
const MAX_OFFSET = 630;
const NUM_PAGES = 64;
const cookie =
  'nlbi_2382632=55A0Ys9w03lKsUcwF1P6cwAAAADpvYXMIjw/kHvZCVpkJjCo; AMCVS_DF38E5285913269B0A495E5A%40AdobeOrg=1; visid_incap_2382632=DhZ6gYXpScaidrQ3TldTsi9cdWAAAAAAQkIPAAAAAABFgMkDlU9q/nUSrI25jJUz; AMCV_DF38E5285913269B0A495E5A%40AdobeOrg=1075005958%7CMCIDTS%7C18848%7CMCMID%7C26764735161939516912145322599990924003%7CMCOPTOUT-1628409984s%7CNONE%7CvVersion%7C4.4.1; incap_ses_1234_2382632=cELsbo/SDHCk5/Ia2AwgEV+CD2EAAAAAYpXiPfQApjbwy/RfRHHkSA==';

const getInvestors = async () => {
  const startupSgCatalogue = [];

  for (let i = 0; i < NUM_PAGES; i++) {
    const offset = i * 10;
    try {
      const res = await fetch(`${investorDataApi}${offset}`, {
        headers: {
          cookie: cookie,
        },
      });
      const data = await res.json();
      startupSgCatalogue.push(data);
      console.log('------ delaying ------');
      await delay(5000);
      console.log(`------ Iteration ${i} successful -----`);
    } catch (e) {
      console.log(e);
    }
  }
  console.log('startupSgCatalogue length: ', startupSgCatalogue.length);
  fs.writeFile(
    `${__dirname}/startup-sg.json`,
    JSON.stringify(startupSgCatalogue),
    (err) => {
      if (err) throw err;
      else
        console.log(
          `profile json file successfully generated at ${__dirname}/startup-sg.json`
        );
    }
  );
};

const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const processInfo = () => {
  const allInvestorInfo = investorsInfo.flatMap((info) => info.data);
  const keyedByName = allInvestorInfo.map((info) => {
    const displayName = info.displayName;
    const newObj = {
      [displayName]: info,
    };
    return newObj;
  });
  const investorInfoByName = {
    totalCount: keyedByName.length,
    data: keyedByName,
  };
  fs.writeFile(
    `${__dirname}/startup-sg-investors-by-name.json`,
    JSON.stringify(investorInfoByName),
    (err) => {
      if (err) throw err;
      else
        console.log(
          `json file successfully generated at ${__dirname}/startup-sg-investors-by-name.json`
        );
    }
  );
};
processInfo();
