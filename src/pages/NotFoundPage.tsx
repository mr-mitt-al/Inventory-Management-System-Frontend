import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="h-10 w-10" />}
      title="Page not found"
      description="That link does not point anywhere. It may have moved or never existed."
      action={
        <Link to="/">
          <Button>Back to shop</Button>
        </Link>
      }
    />
  );
}
