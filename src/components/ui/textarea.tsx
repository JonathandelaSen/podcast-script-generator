import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[22px] border border-input/35 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base transition-colors outline-none placeholder:text-muted-foreground/85 focus-visible:border-[color:var(--ring)] focus-visible:ring-4 focus-visible:ring-[color:rgba(79,70,229,0.12)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
