# scraping-project
Web Scrapper project for consolidating news sources and company financials, with PuppeteerJS 


**Main Project: Crunchbase Scraper Location**
1. Scraping code: ./crunchbase/crunchbase-scraper.js
2. Processing code: ./crunchbase/processing.js
3. Main Abstraction: ./crunchbase/main.js




**Preparation Needed** 
- a `.json` file that contains a list of investors, keyed by `invesor_profiles`
  sample: 
  ```
  {
  "investor_profiles": [
    {
      "id": "",
      "name": "Acacia Capital Partners",
      "headquarter_location": "Cambridge",
      "investor_type": "Venture Capital (VC)",
      "website_url": "http://acaciacp.com"
    },
  ]}
  ```
  
 **To Scrape and Process Info** 
 1. fill in all the necessary paths to `scrapeAndProcessData` method in `main.js`
 - `migrationDirectory`, `filePathToInvestors`, `folderToSaveData`
 3. run  
 ``` 
 node main.js
 ```
  
 **Scraping Logic**
 1. Take in `investorName` and `folderToSaveData` as parameters 
 2. conduct scraping of data with PuppeteerJS 
 3. For every page navigation, check for 1. Page Not Found 2. Mouse Click Captcha
  - if Not found, utilise search on the platform and use first search result as investor. (all redirects are recorded in `redirect-trace.json` for cleaning later on)
4. For every investor, grab basic information about portfolio companies. 
5. save all details in `folderToSaveData`   
  sample: 
  ```
  {
  "acacia-capital-partners": {
    {
      "investmentSummarySection": [...],
      "investmentHighlights": {...}
      "recentInvestments": [...],
      "diversityInvestments": [...],
      "notableExits": [...],
    },
  }
  }
  ```
  **Processing**
  1. clean data 
  2. generate SQL migration statements in `/migrations` folder
  


PS. Apologies for the messy repo, will clean it up real soon!
