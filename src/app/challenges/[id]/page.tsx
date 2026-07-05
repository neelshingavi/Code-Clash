import { notFound } from 'next/navigation';
import { getChallengeWithLeaderboard } from '@/data/challenges';
import LiveArenaClient from './LiveArenaClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChallengePage(props: PageProps) {
  const { id } = await props.params;
  const { user, challenge, participants } = await getChallengeWithLeaderboard(id);

  if (!challenge) {
    return notFound();
  }

  return (
    <LiveArenaClient 
      challengeId={id}
      initialChallenge={challenge} 
      initialParticipants={participants} 
      currentUser={user} 
    />
  );
}
