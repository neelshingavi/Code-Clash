export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string
          leetcode_id: string | null
          global_rank: string
          avatar_url: string | null
          total_score: number
          current_streak: number
          created_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          leetcode_id?: string | null
          global_rank?: string
          avatar_url?: string | null
          total_score?: number
          current_streak?: number
          created_at?: string
        }
        Update: {
          email?: string
          username?: string
          leetcode_id?: string | null
          global_rank?: string
          avatar_url?: string | null
          total_score?: number
          current_streak?: number
        }
      }
      challenges: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          daily_target: number
          penalty_mode: 'none' | 'minus_points' | 'double_quota_next_day' | 'rank_reduction' | 'streak_reset'
          penalty_amount: number
          created_by: string
          created_at: string
        }
      }
      challenge_participants: {
        Row: {
          id: string
          challenge_id: string
          user_id: string
          score: number
          rank: string
          temporary_quota: number | null
          last_evaluated_date: string
          created_at: string
        }
      }
      submissions: {
        Row: {
          id: string
          user_id: string
          challenge_id: string | null
          problem_name: string
          problem_url: string
          difficulty: 'easy' | 'medium' | 'hard'
          points_earned: number
          solved_date: string
          created_at: string
        }
      }
    }
  }
}
