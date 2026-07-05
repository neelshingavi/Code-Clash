import { z } from 'zod';

export const SignupSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, 'Letters, numbers, underscore only, 3-20 chars'),
  email: z.string().email(),
  leetcodeId: z.string().min(1).max(50),
  password: z.string().min(8, 'At least 8 characters')
    .regex(/[0-9]/, 'At least one number')
    .regex(/[^a-zA-Z0-9]/, 'At least one special character'),
});

export const CreateChallengeSchema = z.object({
  name: z.string().min(3).max(80),
  startDate: z.string().date(),
  endDate: z.string().date(),
  dailyTarget: z.number().int().positive(),
  easyPoints: z.number().int().min(0),
  mediumPoints: z.number().int().min(0),
  hardPoints: z.number().int().min(0),
  penaltyMode: z.enum(['none', 'minus_points', 'double_quota_next_day', 'rank_reduction', 'streak_reset']),
  penaltyAmount: z.number().int().min(0),
}).refine((v) => v.endDate > v.startDate, { message: 'End date must be after start date', path: ['endDate'] });

export const SubmitSolutionSchema = z.object({
  challengeId: z.string().uuid().nullable(), // null = personal log
  problemName: z.string().min(1).max(200),
  problemUrl: z.string().url().startsWith('https://leetcode.com/problems/'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
