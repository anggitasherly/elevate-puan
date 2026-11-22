"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { legalDocs } from "@/lib/legal-content";

export default function LegalLink({ doc }) {
  const [open, setOpen] = useState(false);
  const content = legalDocs[doc];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-bold text-brand-deep underline-offset-2 hover:underline"
      >
        {content.title}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 rounded-3xl p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-ink-title">
              {content.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-muted">
              {content.updated}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-ink-muted">
            <p>{content.intro}</p>
            {content.sections.map((s) => (
              <div key={s.heading}>
                <h3 className="font-bold text-ink-title">{s.heading}</h3>
                <p className="mt-1">{s.body}</p>
              </div>
            ))}
          </div>

          <Button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-full bg-linear-to-r from-cta-from to-cta-to text-[15px] font-bold shadow-lg shadow-cta-to/30 hover:opacity-90"
          >
            Saya mengerti
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}