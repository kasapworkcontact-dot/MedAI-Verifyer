import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonResultProps {
  matchPercentage: number;
  details: {
    formAnalysis: string;
    imageAnalysis: string;
    recommendations: string[];
  };
}

const ComparisonResult = ({ matchPercentage, details }: ComparisonResultProps) => {
  const getStatusIcon = () => {
    if (matchPercentage >= 80) return <CheckCircle className="h-6 w-6 text-success" />;
    if (matchPercentage >= 60) return <AlertCircle className="h-6 w-6 text-warning" />;
    return <XCircle className="h-6 w-6 text-destructive" />;
  };

  const getStatusText = () => {
    if (matchPercentage >= 80) return "Excellent Match";
    if (matchPercentage >= 60) return "Partial Match";
    return "Poor Match";
  };

  const getStatusColor = () => {
    if (matchPercentage >= 80) return "text-success";
    if (matchPercentage >= 60) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="medical-card p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="text-center space-y-3 sm:space-y-4">
        <div className="flex items-center justify-center space-x-2 sm:space-x-3">
          {getStatusIcon()}
          <h3 className="text-lg sm:text-xl font-bold text-foreground">Comparison Results</h3>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-muted-foreground">Match Accuracy</span>
            <span className={cn("text-xl sm:text-2xl font-bold", getStatusColor())}>
              {matchPercentage}%
            </span>
          </div>
          <Progress value={matchPercentage} className="h-2 sm:h-3" />
          <p className={cn("text-xs sm:text-sm font-medium", getStatusColor())}>
            {getStatusText()}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2 sm:space-y-3">
          <h4 className="font-semibold text-sm sm:text-base text-foreground">Form Analysis</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">{details.formAnalysis}</p>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          <h4 className="font-semibold text-sm sm:text-base text-foreground">Image Analysis</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">{details.imageAnalysis}</p>
        </div>
      </div>

      {details.recommendations.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <h4 className="font-semibold text-sm sm:text-base text-foreground">Recommendations</h4>
          <ul className="space-y-2">
            {details.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start space-x-2 text-xs sm:text-sm text-muted-foreground">
                <span className="text-primary mt-0.5 sm:mt-1">•</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ComparisonResult;