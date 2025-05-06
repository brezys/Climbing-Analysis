import { NextResponse } from 'next/server';
import type { ClimbAnalysisRequest, ClimbAnalysisResponse } from '@/lib/gemini-api';

export async function POST(request: Request) {
  try {
    const data: ClimbAnalysisRequest = await request.json();
    
    // Validate input
    if (!data.bodyPositionData) {
      return NextResponse.json(
        { error: 'Body position data is required' },
        { status: 400 }
      );
    }
    
    // Get Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is missing' },
        { status: 500 }
      );
    }
    
    try {
      // Call the Gemini API
      const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this climbing data and provide feedback:
                  Height: ${data.height || 'Not provided'} cm
                  Weight: ${data.weight || 'Not provided'} kg
                  Ape index: ${data.apeIndex || 'Not provided'} cm
                  
                  Provide analysis of the climber's technique based on these measurements.
                  Focus on what the climber should pay attention to based on their body type.
                  Format your response in JSON with these fields exactly:
                  {
                    "analysis": "your overall analysis here",
                    "suggestedTechniques": ["technique 1", "technique 2", "technique 3"],
                    "improvementAreas": ["area 1", "area 2", "area 3"]
                  }`
                }
              ]
            }
          ]
        }),
      });
      
      if (!geminiResponse.ok) {
        console.error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
        throw new Error(`Failed to call Gemini API: ${geminiResponse.statusText}`);
      }
      
      const result = await geminiResponse.json();
      
      // Extract text from Gemini response
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        throw new Error('Invalid response from Gemini API');
      }
      
      // Extract JSON from the response text
      let jsonResponse: ClimbAnalysisResponse;
      
      try {
        // The response may contain markdown formatting or other text
        // Look for JSON inside the response text
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not find JSON in response');
        }
      } catch (jsonError) {
        console.error('Error parsing Gemini JSON response:', jsonError);
        // Fallback to default response
        jsonResponse = {
          analysis: "Based on the provided measurements, we can provide some general climbing advice. Please enable AI analysis for more specific feedback.",
          suggestedTechniques: [
            "Focus on keeping your center of gravity closer to the wall",
            "Use your legs more to push yourself upward rather than pulling with arms",
            "Practice 'quiet feet' technique to improve foot placement"
          ],
          improvementAreas: [
            "Balance and weight distribution",
            "Efficient movement between holds",
            "Energy conservation during climbs"
          ]
        };
      }
      
      return NextResponse.json(jsonResponse);
      
    } catch (geminiError) {
      console.error('Error with Gemini API:', geminiError);
      
      // Fallback response if Gemini API fails
      const fallbackResponse: ClimbAnalysisResponse = {
        analysis: "We're experiencing issues with our AI analysis system. Here are some general climbing tips in the meantime.",
        suggestedTechniques: [
          "Focus on keeping your center of gravity closer to the wall",
          "Use your legs more to push yourself upward rather than pulling with arms",
          "Practice 'quiet feet' technique to improve foot placement"
        ],
        improvementAreas: [
          "Balance and weight distribution",
          "Efficient movement between holds",
          "Energy conservation during climbs"
        ]
      };
      
      // Log additional information for debugging
      if (process.env.NODE_ENV !== 'production') {
        console.log('Using fallback response due to Gemini API error');
        console.log('API Key present:', !!geminiApiKey);
        console.log('Error details:', geminiError);
      }
      
      return NextResponse.json(fallbackResponse);
    }
    
  } catch (error) {
    console.error('Error in climbing analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze climbing data' },
      { status: 500 }
    );
  }
} 