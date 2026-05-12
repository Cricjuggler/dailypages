import { ReaderView } from "@/components/reader/reader-view";
import { APP_DATA } from "@/lib/mock-data";

export default function ReaderPage() {
  return <ReaderView book={APP_DATA.activeBook} content={APP_DATA.todayContent} />;
}
