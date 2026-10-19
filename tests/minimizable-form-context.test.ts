import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { useContextMock } = vi.hoisted(() => ({ useContextMock: vi.fn() }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useContext: useContextMock,
}));
vi.mock("@/i18n/client", () => ({
  useTranslation: () => ({ t: () => "แตะเพื่อทำต่อ" }),
}));

import { MinimizableFormHost } from "@/components/shared/minimizable-form-context";

describe("MinimizableFormHost resume pill", () => {
  it.each([
    { minimized: true, minimizing: false },
    { minimized: false, minimizing: true },
  ])("clears the mobile nav while minimized=$minimized and minimizing=$minimizing", (state) => {
    useContextMock.mockReset();
    useContextMock.mockReturnValueOnce({ restore: vi.fn() }).mockReturnValueOnce({
      active: { id: "draft", title: "Draft", content: null },
      ...state,
    });

    const markup = renderToStaticMarkup(createElement(MinimizableFormHost));
    const pillClass = markup.match(/<button[^>]*class="([^"]*)"/)?.[1];

    expect(pillClass).toContain("bottom-[calc(7rem+env(safe-area-inset-bottom))]");
    expect(pillClass).toContain("md:bottom-6");
    expect(pillClass).not.toMatch(/\bbottom-20\b/);
  });
});
