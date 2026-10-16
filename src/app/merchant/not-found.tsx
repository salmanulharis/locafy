import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function MerchantNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="Not found"
          description="This page doesn't exist, or you aren't a member of the shop it belongs to."
          action={<LinkButton href="/merchant">Go to my shops</LinkButton>}
        />
      </Card>
    </div>
  );
}
