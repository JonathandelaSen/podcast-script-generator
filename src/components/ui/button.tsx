import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "primary-gradient text-primary-foreground shadow-[0_16px_30px_rgba(53,37,205,0.18)] hover:-translate-y-0.5 hover:shadow-[0_22px_36px_rgba(53,37,205,0.24)]",
        outline:
          "border-[rgba(199,196,216,0.32)] bg-[rgba(255,255,255,0.7)] text-foreground hover:bg-[rgba(239,244,255,0.94)] hover:text-foreground aria-expanded:bg-[rgba(239,244,255,0.94)] aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary)_78%,white)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-[rgba(239,244,255,0.92)] hover:text-foreground aria-expanded:bg-[rgba(239,244,255,0.92)] aria-expanded:text-foreground",
        destructive:
          "bg-[rgba(255,218,214,0.96)] text-[#93000a] hover:bg-[rgba(255,218,214,1)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 rounded-xl px-2.5 text-xs in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-xl px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-8",
        "icon-xs":
          "size-7 rounded-xl in-data-[slot=button-group]:rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-xl in-data-[slot=button-group]:rounded-xl",
        "icon-lg": "size-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
