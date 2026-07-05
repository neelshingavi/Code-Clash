import 'server-only';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

export async function getProblemMeta(slug: string) {
  try {
    const res = await fetch(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query getQ($slug: String!) { question(titleSlug: $slug) { title difficulty } }`,
        variables: { slug },
      }),
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    return json?.data?.question as { title: string; difficulty: 'Easy' | 'Medium' | 'Hard' } | null;
  } catch (err) {
    console.error("LeetCode getProblemMeta Error:", err);
    return null;
  }
}

export async function hasRecentAccept(leetcodeUsername: string, titleSlug: string) {
  try {
    const res = await fetch(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query recent($username: String!) {
          recentAcSubmissionList(username: $username, limit: 20) { titleSlug timestamp }
        }`,
        variables: { username: leetcodeUsername },
      }),
      cache: 'no-store',
    });
    const json = await res.json();
    const list = json?.data?.recentAcSubmissionList ?? [];
    return list.some((s: { titleSlug: string }) => s.titleSlug === titleSlug);
  } catch (err) {
    console.error("LeetCode hasRecentAccept Error:", err);
    return false;
  }
}
