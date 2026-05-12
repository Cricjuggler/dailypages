import { RecapView } from "@/components/recap/recap-view";
import { APP_DATA } from "@/lib/mock-data";

export default function RecapPage() {
  return (
    <RecapView
      recap={APP_DATA.recap}
      book={APP_DATA.activeBook}
      stats={APP_DATA.stats}
    />
  );
}
