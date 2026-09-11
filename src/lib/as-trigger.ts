import type { ReactElement } from "react";

/**
 * Base UI primitives (Dialog.Trigger, Menu.Trigger, ...) render as their own
 * element by default and use a `render={<Element/>}` prop — not Radix's
 * `asChild` — to swap in a caller-supplied element instead. `render` takes
 * the *shell* element (for its type/props/className) while the primitive's
 * own `children` becomes the rendered content, so this helper splits a
 * normal-looking `<Button>Add account</Button>` into the `{ render, children }`
 * pair those primitives expect: `<DialogTrigger {...asTrigger(<Button>Add account</Button>)} />`.
 */
export function asTrigger(element: ReactElement) {
  const props = element.props as { children?: React.ReactNode };
  return { render: element, children: props.children };
}
