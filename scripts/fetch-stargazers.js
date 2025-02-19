const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const GITHUB_API_URL = "https://api.github.com";
const GH_TOKEN = process.env.GH_TOKEN;
const REPOSITORY = process.env.REPOSITORY;
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 2000;

// Helper function to make API requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Stargazers-Fetch-Action',
        'Authorization': `token ${GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3.star+json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Fetch all stargazers
async function fetchAllStargazers() {
  let stargazers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await makeRequest(
      `${GITHUB_API_URL}/repos/${REPOSITORY}/stargazers?page=${page}&per_page=100`
    );
    stargazers = stargazers.concat(data);
    hasMore = data.length === 100;
    page++;
  }

  return stargazers;
}

// Fetch user details with retry logic
async function fetchUserDetailsWithRetry(username, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await makeRequest(`${GITHUB_API_URL}/users/${username}`);
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }
}

// Enrich stargazers with additional details
async function enrichStargazersInBatches(stargazers) {
  const enrichedStargazers = [];

  for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
    const batch = stargazers.slice(i, i + BATCH_SIZE);
    const enrichedBatch = await Promise.all(
      batch.map(async (s) => {
        const userDetails = await fetchUserDetailsWithRetry(s.user.login);
        return {
          username: s.user.login,
          email: userDetails.email || 'N/A',
          twitter: userDetails.twitter_username ? 
            `https://twitter.com/${userDetails.twitter_username}` : 'N/A',
          profile_url: s.user.html_url,
          starred_at: s.starred_at
        };
      })
    );

    enrichedStargazers.push(...enrichedBatch);
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  }

  return enrichedStargazers;
}

// Generate CSV content
function generateCSV(stargazers) {
  const headers = ['Username', 'Email', 'Twitter', 'Profile URL', 'Starred At'];
  const rows = stargazers.map(s => [
    s.username,
    s.email,
    s.twitter,
    s.profile_url,
    s.starred_at
  ]);
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

async function main() {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });

    // Fetch and process stargazers
    console.log('Fetching stargazers...');
    const stargazers = await fetchAllStargazers();
    
    console.log('Enriching stargazer data...');
    const enrichedStargazers = await enrichStargazersInBatches(stargazers);
    
    // Save full dataset
    const csvData = generateCSV(enrichedStargazers);
    await fs.writeFile(
      path.join(process.cwd(), 'data', 'stargazers.csv'),
      csvData
    );
    
    // Save last 24 hours dataset
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentStargazers = enrichedStargazers
      .filter(s => new Date(s.starred_at) >= twentyFourHoursAgo)
      .sort((a, b) => new Date(b.starred_at) - new Date(a.starred_at));
    
    const recentCsvData = generateCSV(recentStargazers);
    await fs.writeFile(
      path.join(process.cwd(), 'data', 'stargazers_last_24h.csv'),
      recentCsvData
    );

    console.log('Stargazers data updated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();