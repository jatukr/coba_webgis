const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Basic route
app.get('/api/test', (req, res) => {
  res.json({ message: 'WebGIS API is working!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 