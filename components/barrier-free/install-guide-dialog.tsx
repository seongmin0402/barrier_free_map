"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUi } from "@/hooks/use-ui";

interface InstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

export function InstallGuideDialog({ open, onOpenChange }: InstallGuideDialogProps) {
  const ui = useUi();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{ui.installGuide.title}</DialogTitle>
          <p className="text-left text-sm text-muted-foreground">{ui.installGuide.lead}</p>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-semibold text-foreground">{ui.installGuide.iosTitle}</h3>
            <StepList steps={ui.installGuide.iosSteps} />
          </section>
          <section>
            <h3 className="text-sm font-semibold text-foreground">{ui.installGuide.androidTitle}</h3>
            <StepList steps={ui.installGuide.androidSteps} />
          </section>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {ui.installGuide.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
