import { useState } from "react";
import Header from "@/components/Header";
import UploadSection from "@/components/UploadSection";
import ComparisonResult from "@/components/ComparisonResult";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Zap } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

const Dashboard = () => {
  const [formFiles, setFormFiles] = useState<UploadedFile[]>([]);
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);
  const { toast } = useToast();

  const handleCompare = async () => {
    if (formFiles.length === 0 || imageFiles.length === 0) {
      toast({
        title: "Missing Files",
        description: "Please upload files in both sections before comparing.",
        variant: "destructive",
      });
      return;
    }

    setIsComparing(true);
    
    // Simulate API call with mock data
    setTimeout(() => {
      const mockResults = [
        {
          matchPercentage: 85,
          details: {
            formAnalysis: "Equipment form contains detailed specifications for cardiac monitor model CM-2000. All required fields completed with proper documentation.",
            imageAnalysis: "Image shows cardiac monitor matching model CM-2000 specifications. Device appears in good condition with visible model number and serial number.",
            recommendations: [
              "Verify serial number matches form documentation",
              "Check calibration date on device display",
              "Confirm all accessories are present as listed"
            ]
          }
        },
        {
          matchPercentage: 45,
          details: {
            formAnalysis: "Form indicates ventilator model VT-300 with specific settings and maintenance requirements documented.",
            imageAnalysis: "Image shows different equipment model (VT-250). Serial numbers do not match form specifications.",
            recommendations: [
              "Re-upload correct equipment image",
              "Verify equipment model number on form",
              "Check if multiple devices need to be documented",
              "Contact equipment manager for clarification"
            ]
          }
        },
        {
          matchPercentage: 92,
          details: {
            formAnalysis: "Defibrillator documentation complete with all safety checks passed. Model DF-500 specifications match requirements.",
            imageAnalysis: "High-quality image clearly shows DF-500 defibrillator. All visible components match form documentation perfectly.",
            recommendations: [
              "Documentation is excellent - no action required",
              "Store in equipment compliance database",
              "Schedule next inspection as per protocol"
            ]
          }
        }
      ];

      const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
      setComparisonResult(randomResult);
      setIsComparing(false);

      toast({
        title: "Analysis Complete",
        description: `Comparison finished with ${randomResult.matchPercentage}% match accuracy.`,
        variant: randomResult.matchPercentage >= 70 ? "default" : "destructive",
      });
    }, 3000);
  };

  const resetComparison = () => {
    setComparisonResult(null);
    setFormFiles([]);
    setImageFiles([]);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div 
        className="absolute inset-0 opacity-5 bg-cover bg-center bg-no-repeat pointer-events-none" 
        style={{ backgroundImage: 'url(/medical-bg.jpg)' }}
      />
      <div className="relative z-10">
        <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 sm:space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground px-4">Medical Equipment Verification</h2>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Upload your equipment check forms and corresponding device images to verify compliance 
            and ensure documentation accuracy.
          </p>
        </div>

        {/* Upload Sections */}
        <div className="grid md:grid-cols-2 gap-8">
          <UploadSection
            title="Equipment Check Form"
            description="Upload the completed equipment check form (PDF or image)"
            onFilesUploaded={setFormFiles}
            uploadedFiles={formFiles}
          />
          
          <UploadSection
            title="Equipment Image"
            description="Upload a clear photo of the medical equipment"
            onFilesUploaded={setImageFiles}
            uploadedFiles={imageFiles}
          />
        </div>

        {/* Comparison Controls */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
          <Button
            onClick={handleCompare}
            disabled={formFiles.length === 0 || imageFiles.length === 0 || isComparing}
            variant="medical"
            size="lg"
            className="w-full sm:w-auto sm:px-8"
          >
            {isComparing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Compare Documents
              </>
            )}
          </Button>

          {comparisonResult && (
            <Button
              onClick={resetComparison}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              New Comparison
            </Button>
          )}
        </div>

        {/* Results Section */}
        {comparisonResult && (
          <div className="space-y-6">
            <ComparisonResult
              matchPercentage={comparisonResult.matchPercentage}
              details={comparisonResult.details}
            />
          </div>
        )}

        {/* Info Section */}
        {!comparisonResult && (
          <div className="medical-card p-6 bg-muted/20">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">How it works</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Upload your equipment check form and a clear image of the device</li>
                  <li>• Get detailed match percentage and specific recommendations</li>
                  <li>• Ensure your medical equipment documentation is accurate and complete</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
};

export default Dashboard;