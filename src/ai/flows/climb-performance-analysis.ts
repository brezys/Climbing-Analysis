'use server';
/**
 * @fileOverview Analyzes a recorded climbing session to provide performance insights.
 *
 * - analyzeClimbingSession - A function that handles the analysis of a climbing session.
 * - AnalyzeClimbingSessionInput - The input type for the analyzeClimbingSession function.
 * - AnalyzeClimbingSessionOutput - The return type for the analyzeClimbingSession function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeClimbingSessionInputSchema = z.object({
  videoUrl: z.string().describe('The URL of the recorded climbing session video.'),
  holdUsage: z.string().describe('Information about which holds were used during the climb.'),
  timeOnEachHold: z.string().describe('The time spent on each hold during the climb.'),
  jointAngles: z.string().describe('Data about the climber’s joint angles during the climb.'),
  climberHeight: z.number().describe('The height of the climber in cm.'),
  climberWeight: z.number().describe('The weight of the climber in kg.'),
  climberApeIndex: z.number().describe('The ape index of the climber in cm (arm span - height).'),
});
export type AnalyzeClimbingSessionInput = z.infer<typeof AnalyzeClimbingSessionInputSchema>;

const AnalyzeClimbingSessionOutputSchema = z.object({
  performanceInsights: z.string().describe('Insights into the climber’s performance, technique, and hold selection.'),
  suggestedImprovements: z.string().describe('Personalized feedback and suggestions for improving the climber’s technique or hold selection.'),
});
export type AnalyzeClimbingSessionOutput = z.infer<typeof AnalyzeClimbingSessionOutputSchema>;

export async function analyzeClimbingSession(input: AnalyzeClimbingSessionInput): Promise<AnalyzeClimbingSessionOutput> {
  return analyzeClimbingSessionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeClimbingSessionPrompt',
  input: {
    schema: z.object({
      videoUrl: z.string().describe('The URL of the recorded climbing session video.'),
      holdUsage: z.string().describe('Information about which holds were used during the climb.'),
      timeOnEachHold: z.string().describe('The time spent on each hold during the climb.'),
      jointAngles: z.string().describe('Data about the climber’s joint angles during the climb.'),
      climberHeight: z.number().describe('The height of the climber in cm.'),
      climberWeight: z.number().describe('The weight of the climber in kg.'),
      climberApeIndex: z.number().describe('The ape index of the climber in cm (arm span - height).'),
    }),
  },
  output: {
    schema: z.object({
      performanceInsights: z.string().describe('Insights into the climber’s performance, technique, and hold selection.'),
      suggestedImprovements: z.string().describe('Personalized feedback and suggestions for improving the climber’s technique or hold selection.'),
    }),
  },
  prompt: `You are an expert climbing coach analyzing a climber's performance.

  Based on the following data from the climbing session, provide insights into the climber’s performance, technique, and hold selection.  Also suggest improvements to the climber’s technique or hold selection.

  Video URL: {{{videoUrl}}}
  Hold Usage: {{{holdUsage}}}
  Time on Each Hold: {{{timeOnEachHold}}}
  Joint Angles: {{{jointAngles}}}
  Climber Height: {{{climberHeight}}} cm
  Climber Weight: {{{climberWeight}}} kg
  Climber Ape Index: {{{climberApeIndex}}} cm

  Provide your analysis in a structured format:

  **Performance Insights:** [Detailed insights into the climber's performance]

  **Suggested Improvements:** [Specific and actionable suggestions for improvement]
  `,
});

const analyzeClimbingSessionFlow = ai.defineFlow<
  typeof AnalyzeClimbingSessionInputSchema,
  typeof AnalyzeClimbingSessionOutputSchema
>(
  {
    name: 'analyzeClimbingSessionFlow',
    inputSchema: AnalyzeClimbingSessionInputSchema,
    outputSchema: AnalyzeClimbingSessionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
