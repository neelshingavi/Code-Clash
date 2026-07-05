const fetch = require('node-fetch');
async function test() {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }
  `;
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { username: 'neelshingavi', limit: 5 } })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
