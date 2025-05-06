'use server';
/**
 * @fileOverview A climbing path suggestion AI agent.
 *
 * - suggestClimbingPath - A function that handles the climbing path suggestion process.
 * - SuggestClimbingPathInput - The input type for the suggestClimbingPath function.
 * - SuggestClimbingPathOutput - The return type for the suggestClimbingPath function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestClimbingPathInputSchema = z.object({
  height: z.number().describe('The height of the climber in centimeters.'),
  weight: z.number().describe('The weight of the climber in kilograms.'),
  apeIndex: z.number().describe('The ape index of the climber in centimeters (arm span - height).'),
  climbingStyle: z.string().describe('A description of the climber\'s preferred climbing style.'),
  climbImageUrl: z.string().describe('URL of the climb image.'),
  holdColors: z.array(z.string()).describe('The colors of the holds available on the climb.'),
});
export type SuggestClimbingPathInput = z.infer<typeof SuggestClimbingPathInputSchema>;

const SuggestClimbingPathOutputSchema = z.object({
  suggestedPath: z.array(
    z.object({
      holdColor: z.string().describe('The color of the suggested hold.'),
      description: z.string().describe('Description of the hold and how to use it, taking into account the climber\'s style and biometrics.'),
    })
  ).describe('An array of suggested holds to use in sequence, and descriptions of how to use them.'),
  overallStrategy: z.string().describe('The overall strategy for the climb, considering the climber\'s style and biometrics.'),
});
export type SuggestClimbingPathOutput = z.infer<typeof SuggestClimbingPathOutputSchema>;

export async function suggestClimbingPath(input: SuggestClimbingPathInput): Promise<SuggestClimbingPathOutput> {
  return suggestClimbingPathFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestClimbingPathPrompt',
  input: {
    schema: z.object({
      height: z.number().describe('The height of the climber in centimeters.'),
      weight: z.number().describe('The weight of the climber in kilograms.'),
      apeIndex: z.number().describe('The ape index of the climber in centimeters (arm span - height).'),
      climbingStyle: z.string().describe('A description of the climber\'s preferred climbing style.'),
      climbImageUrl: z.string().describe('URL of the climb image.'),
      holdColors: z.array(z.string()).describe('The colors of the holds available on the climb.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedPath: z.array(
        z.object({
          holdColor: z.string().describe('The color of the suggested hold.'),
          description: z.string().describe('Description of the hold and how to use it, taking into account the climber\'s style and biometrics.'),
        })
      ).describe('An array of suggested holds to use in sequence, and descriptions of how to use them.'),
      overallStrategy: z.string().describe('The overall strategy for the climb, considering the climber\'s style and biometrics.'),
    }),
  },
  prompt: `You are an expert climbing coach. A climber will provide you with their biometric data, a description of their climbing style, and an image of the climb they want to do, as well as the colors of the holds on the climb.

  Based on this information, suggest an effective climbing path for the climber. Take into account their climbing style and biometric data. Provide an overall strategy for the climb, and a sequence of holds to use, with a description of how to use each hold.

  Climber Height: {{{height}}} cm
  Climber Weight: {{{weight}}} kg
  Climber Ape Index: {{{apeIndex}}} cm
  Climber Climbing Style: {{{climbingStyle}}}
  Climb Image: {{media url=climbImageUrl}}
  Hold Colors: {{{holdColors}}}

  Here is the suggested climb path:
  `,
});

const suggestClimbingPathFlow = ai.defineFlow<
  typeof SuggestClimbingPathInputSchema,
  typeof SuggestClimbingPathOutputSchema
>(
  {
    name: 'suggestClimbingPathFlow',
    inputSchema: SuggestClimbingPathInputSchema,
    outputSchema: SuggestClimbingPathOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
