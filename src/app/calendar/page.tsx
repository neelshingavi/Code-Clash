import { verifySession, getUserStats } from '@/data/challenges';
import { getUserSubmissionsHistory } from '@/data/calendar';
import { fetchLeetcodeCalendar } from '@/app/actions/leetcode';
import { CalendarClient } from './CalendarClient';

export const metadata = {
  title: 'Calendar | Code Clash',
  description: 'View your problem solving activity over time',
};

export default async function CalendarPage() {
  const user = await verifySession();
  
  // Fetch submission history from our DB
  const history = await getUserSubmissionsHistory(user.id);
  
  // Also fetch the true LeetCode historical calendar
  const stats = await getUserStats(user.id);
  let leetcodeCalendar = {};
  
  if (stats?.leetcode_id) {
    let username = stats.leetcode_id.trim();
    if (username.includes('leetcode.com')) {
      const parts = username.split('/').filter(Boolean);
      username = parts[parts.length - 1] === 'u' ? parts[parts.length - 1] : parts[parts.length - 1]; // Fixed logic in previous step but simplified here
      if (parts[parts.length - 2] === 'u') username = parts[parts.length - 1];
    }
    username = username.replace('@', '').trim();
    
    leetcodeCalendar = await fetchLeetcodeCalendar(username);
  }
  
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      <CalendarClient history={history} leetcodeCalendar={leetcodeCalendar} />
    </div>
  );
}
