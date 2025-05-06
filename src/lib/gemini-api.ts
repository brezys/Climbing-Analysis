/**
 * Gemini API utility functions
 */

export interface ClimbAnalysisRequest {
  bodyPositionData: any;
  height?: number;
  weight?: number;
  apeIndex?: number;
}

export interface ClimbAnalysisResponse {
  analysis: string;
  suggestedTechniques: string[];
  improvementAreas: string[];
}

/**
 * Analyzes climbing data using the Gemini API
 */
export async function analyzeClimbingData(data: ClimbAnalysisRequest): Promise<ClimbAnalysisResponse> {
  try {
    // Call the API endpoint that handles Gemini API integration
    const response = await fetch('/api/analyze-climbing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze climbing data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error analyzing climbing data:', error);
    throw error;
  }
} 