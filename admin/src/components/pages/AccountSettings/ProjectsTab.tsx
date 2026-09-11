import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Mock for now — swap for a Firestore query (e.g. projects where
// memberIds contains this account's id) once that collection exists.
const mockProjects = [
  { name: "Dashboard Revamp", description: "Admin panel redesign for Q1" },
  { name: "Billing Migration", description: "Move billing to new provider" },
  { name: "Mobile App", description: "iOS/Android companion app" },
];

export default function ProjectsTab() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {mockProjects.map((project) => (
        <Card key={project.name} className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-sm">{project.name}</CardTitle>
            <CardDescription>{project.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}