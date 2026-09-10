import { ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface RecentActivitiesTabProps {
  displayName?: string;
}

// Mock for now — swap for a Firestore query (e.g. activities where
// userId == id, ordered by created_at desc) once that collection exists.
const mockActivities = [
  { text: "commented on Dashboard Revamp's project", time: "2h ago" },
  { text: "commented on Billing Migration's project", time: "1d ago" },
  { text: "commented on Mobile App's project", time: "3d ago" },
];

export default function RecentActivitiesTab({
  displayName,
}: RecentActivitiesTabProps) {
  return (
    <div className="max-w-2xl rounded-lg border border-zinc-800">
      {mockActivities.map((activity, i) => (
        <div key={i}>
          <button className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-900 transition-colors">
            <span>
              {displayName} {activity.text}
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {activity.time}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
          {i < mockActivities.length - 1 && (
            <Separator className="bg-zinc-800" />
          )}
        </div>
      ))}
    </div>
  );
}