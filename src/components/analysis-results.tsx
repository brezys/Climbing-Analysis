import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ClimbAnalysisResponse } from '@/lib/gemini-api';
import { CheckCircle2, AlertTriangle, ArrowUpCircle } from 'lucide-react';

interface AnalysisResultsProps {
  results: ClimbAnalysisResponse | null;
}

export function AnalysisResults({ results }: AnalysisResultsProps) {
  if (!results) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          Climbing Analysis Results
        </CardTitle>
        <CardDescription>AI-powered analysis of your climbing technique</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-700 mb-2">Analysis</h3>
          <p className="text-blue-800">{results.analysis}</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <h3 className="text-lg font-semibold text-emerald-700 flex items-center gap-2 mb-2">
              <ArrowUpCircle className="h-5 w-5" />
              Suggested Techniques
            </h3>
            <ul className="space-y-2">
              {results.suggestedTechniques.map((technique, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="bg-emerald-200 text-emerald-800 rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-emerald-800">{technique}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
            <h3 className="text-lg font-semibold text-amber-700 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5" />
              Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {results.improvementAreas.map((area, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="bg-amber-200 text-amber-800 rounded-full h-5 w-5 flex items-center justify-center text-xs mt-0.5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-amber-800">{area}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 