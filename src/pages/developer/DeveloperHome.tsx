import { HeroSection } from "@/components/developer/landing/HeroSection";
import { IntegrationOverview } from "@/components/developer/landing/IntegrationOverview";
import { UseCasesSection } from "@/components/developer/landing/UseCasesSection";
import { SecuritySection } from "@/components/developer/landing/SecuritySection";
import { CodeSnippetSection } from "@/components/developer/landing/CodeSnippetSection";
import { SDKSection } from "@/components/developer/landing/SDKSection";
import { OpenBankingSection } from "@/components/developer/landing/OpenBankingSection";
import { AdvancedFeaturesGate } from "@/components/developer/landing/AdvancedFeaturesGate";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function DeveloperHome() {
  return (
    <div className="space-y-16 pb-8">
      <HeroSection />
      <IntegrationOverview />
      <UseCasesSection />
      <CodeSnippetSection />
      <SecuritySection />
      <OpenBankingSection />
      <SDKSection />
      <AdvancedFeaturesGate />
      <DocNavigation
        nextPage={{
          title: "Getting Started",
          path: "/developer/getting-started"
        }}
      />
    </div>
  );
}
