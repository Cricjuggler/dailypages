import { Suspense } from "react";
import { ChooseFlow } from "@/components/upload/choose-flow";

export default function UploadChoosePage() {
  return (
    <Suspense>
      <ChooseFlow />
    </Suspense>
  );
}
