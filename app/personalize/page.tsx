import { Suspense } from "react";
import { PersonalizeFlow } from "@/components/personalize/personalize-flow";

export default function PersonalizePage() {
  return (
    <Suspense>
      <PersonalizeFlow />
    </Suspense>
  );
}
