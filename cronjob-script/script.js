const GITHUB_API_URL = "https://api.github.com";
const GITHUB_TOKEN = "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"; 
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 2000;

document.getElementById("fetch-button").addEventListener("click", async () => {
  const repoUrl = document.getElementById("repo-url").value;
  const repoPath = extractRepoPath(repoUrl);

  if (!repoPath) {
    alert("Invalid GitHub repository URL");
    return;
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("fetch-button").disabled = true;

  try {
    const stargazers = await fetchAllStargazers(repoPath);
    const enrichedStargazers = await enrichStargazersInBatches(stargazers);
    const csvData = generateCSV(enrichedStargazers);
    downloadCSV(csvData, "stargazers.csv");
  } catch (error) {
    console.error("Error fetching stargazers:", error);
    alert("Failed to fetch stargazers.");
  } finally {
    document.getElementById("loading").style.display = "none";
    document.getElementById("fetch-button").disabled = false;
  }
});

document.getElementById("fetch-24h-button").addEventListener("click", async () => {
  const repoUrl = document.getElementById("repo-url").value;
  const repoPath = extractRepoPath(repoUrl);

  if (!repoPath) {
    alert("Invalid GitHub repository URL");
    return;
  }

  document.getElementById("loading").style.display = "block";
  document.getElementById("fetch-24h-button").disabled = true;

  try {
    const recentStargazers = await fetchRecentStargazers(repoPath);
    const enrichedStargazers = await enrichStargazersInBatches(recentStargazers);
    const csvData = generateCSV(enrichedStargazers);
    downloadCSV(csvData, "stargazers_last_24h.csv");
  } catch (error) {
    console.error("Error fetching recent stargazers:", error);
    alert("Failed to fetch recent stargazers.");
  } finally {
    document.getElementById("loading").style.display = "none";
    document.getElementById("fetch-24h-button").disabled = false;
  }
});

// Extract repository path from URL
function extractRepoPath(url) {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
}

// Fetch all stargazers
async function fetchAllStargazers(repoPath) {
  let stargazers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoPath}/stargazers?page=${page}&per_page=100`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3.star+json" },
    });

    if (!response.ok) throw new Error(`Failed to fetch stargazers: ${response.statusText}`);

    const data = await response.json();
    stargazers = stargazers.concat(data);
    hasMore = data.length === 100;
    page++;
  }

  return stargazers;
}

// Fetch recent stargazers (last 24 hours)
async function fetchRecentStargazers(repoPath) {
  const allStargazers = await fetchAllStargazers(repoPath);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return allStargazers
    .filter(s => new Date(s.starred_at) >= twentyFourHoursAgo)
    .sort((a, b) => new Date(b.starred_at) - new Date(a.starred_at));
}

// Fetch additional details for stargazers
async function enrichStargazersInBatches(stargazers) {
  const enrichedStargazers = [];

  for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
    const batch = stargazers.slice(i, i + BATCH_SIZE);
    const enrichedBatch = await Promise.all(
      batch.map(async (s) => {
        const userDetails = await fetchUserDetailsWithRetry(s.user.login);
        return {
          username: s.user.login,
          email: userDetails.email || "N/A",
          twitter: userDetails.twitter_username ? `https://twitter.com/${userDetails.twitter_username}` : "N/A",
          profile_url: s.user.html_url,
        };
      })
    );

    enrichedStargazers.push(...enrichedBatch);
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
  }

  return enrichedStargazers;
}

// Fetch user details with retry logic
async function fetchUserDetailsWithRetry(username, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${GITHUB_API_URL}/users/${username}`, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
      if (!response.ok) throw new Error(`Failed to fetch details for ${username}`);
      return response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }
}

// Generate CSV
function generateCSV(stargazers) {
  const headers = ["Username", "Email", "Twitter", "Profile URL"];
  const rows = stargazers.map(s => [s.username, s.email, s.twitter, s.profile_url]);
  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

// Download CSV
function downloadCSV(data, filename) {
  const blob = new Blob([data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.getElementById("download-link");
  link.href = url;
  link.download = filename;
  link.style.display = "block";
}
