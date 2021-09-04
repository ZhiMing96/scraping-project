const fetch = require('node-fetch');
const fileInfo = require('./initialized-capital-signal.json');
const fs = require('fs');

const hello = async () => {
  fs.readFile('./initialized-capital-signal.json', function (error, content) {
    var data = JSON.parse(content);
    console.log(data);
  });
};
