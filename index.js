const express = require('express');
const app = express();
var cors = require('cors');
const { parseSearchResult } = require('./techInAsia');
const port = 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  console.log(req.body);
  res.json({ text: 'hello world' });
});

app.post('/', async (req, res) => {
  const { source, keyword } = req.body;
  const searchData = await parseSearchResult(keyword);
  // if (searchData) {
  console.log(searchData);
  res.json(searchData);
  // }
  // res.send('Error');
  // res.end();
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
