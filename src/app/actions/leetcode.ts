"use server";

export async function fetchLeetcodeCalendar(username: string) {
  const url = "https://leetcode.com/graphql";
  const graphqlQuery = `
    query userProfileCalendar($username: String!) {
      matchedUser(username: $username) {
        userCalendar {
          submissionCalendar
        }
      }
    }
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { username },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`LeetCode API responded with status ${response.status}`);
    }

    const data = await response.json();
    const calendarStr = data?.data?.matchedUser?.userCalendar?.submissionCalendar;
    
    if (!calendarStr) {
      return {};
    }

    return JSON.parse(calendarStr);
  } catch (error) {
    console.error("Failed to fetch LeetCode calendar:", error);
    // Graceful fallback: return empty object instead of crashing the calendar page.
    return {};
  }
}

export type RecentSubmission = {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
};

export async function fetchRecentSubmissions(username: string, limit: number = 15): Promise<RecentSubmission[]> {
  const url = "https://leetcode.com/graphql";
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { username, limit } }),
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Failed to fetch recent submissions");
    const data = await response.json();
    return data?.data?.recentAcSubmissionList || [];
  } catch (error) {
    console.error("Failed to fetch recent submissions:", error);
    return [];
  }
}

export async function fetchQuestionDifficulty(titleSlug: string): Promise<string> {
  const url = "https://leetcode.com/graphql";
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        difficulty
      }
    }
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { titleSlug } }),
      cache: "force-cache", // Difficulty rarely changes, caching is good
    });

    if (!response.ok) throw new Error("Failed to fetch question difficulty");
    const data = await response.json();
    const diff = data?.data?.question?.difficulty?.toLowerCase();
    
    // Strict sanitization to match Postgres ENUM constraint check (difficulty in ('easy', 'medium', 'hard'))
    if (diff === 'medium') return 'medium';
    if (diff === 'hard') return 'hard';
    return 'easy';
  } catch (error) {
    console.error("Failed to fetch question difficulty:", error);
    return "easy"; // Safe fallback
  }
}
