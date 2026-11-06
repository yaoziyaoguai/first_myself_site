// @vitest-environment node
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { preparePublicHtml } from "@/lib/interactive-html/profile";

const opened = [];
function open(name) {
  const html = readFileSync(
    `docs/article-updates/governance-longform-03/interactive/${name}.html`,
    "utf8",
  );
  expect(preparePublicHtml(Buffer.from(html), { adapt: false }).ok).toBe(true);
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
  });
  opened.push(dom);
  const document = dom.window.document;
  const change = (selector, value) => {
    const element = document.querySelector(selector);
    if (element.type === "checkbox") element.checked = value;
    else element.value = value;
    element.dispatchEvent(
      new dom.window.Event(element.type === "range" ? "input" : "change", {
        bubbles: true,
      }),
    );
  };
  return {
    document,
    change,
    click: (selector) => document.querySelector(selector).click(),
  };
}
afterEach(() => {
  for (const dom of opened.splice(0)) dom.window.close();
});

describe("article interactive explanations", () => {
  it("separates runtime recovery, validated output, and consumer evidence over time", () => {
    const { document, click } = open("delivery-timeline");
    expect(document.querySelector("#run output").textContent).toBe("正常成功");
    expect(document.querySelector("#conclusion").dataset.delivered).toBe(
      "false",
    );
    click("#next");
    expect(document.querySelector("#artifact output").textContent).toBe(
      "产出已校验",
    );
    expect(document.querySelector("#consumer output").textContent).toBe(
      "尚无证据",
    );
    click("#next");
    expect(document.querySelector("#conclusion").dataset.delivered).toBe(
      "true",
    );
    expect(document.querySelector("#clock").textContent).toBe("09:57");
  });
  it("retains confirmed output evidence after a later runtime failure, and forgets future evidence when scrubbing back", () => {
    const { document, change } = open("delivery-timeline");
    change("#scenario", "regressed");
    expect(document.querySelector("#run output").textContent).toBe("失败");
    expect(document.querySelector("#conclusion").dataset.delivered).toBe(
      "true",
    );
    change("#minute", "9");
    expect(document.querySelector("#run output").textContent).toBe("尚无证据");
    expect(document.querySelector("#conclusion").dataset.delivered).toBe(
      "false",
    );
  });
  it.each(["forced", "open"])(
    "does not invent delivery evidence for %s",
    (scenario) => {
      const { document, change } = open("delivery-timeline");
      change("#scenario", scenario);
      change("#minute", "60");
      expect(document.querySelector("#conclusion").dataset.delivered).toBe(
        "false",
      );
      expect(document.querySelector("#artifact output").textContent).toBe(
        "尚无证据",
      );
    },
  );
  it("executes the dated dependency chain only after its upstream evidence exists", () => {
    const { document, change, click } = open("dependency-steps");
    expect(document.querySelector("#b").dataset.state).toBe("pending");
    click("#step");
    expect(document.querySelector("#b").dataset.state).toBe("done");
    expect(document.querySelector("#c").dataset.state).toBe("pending");
    click("#step");
    expect(document.querySelector("#c").dataset.state).toBe("done");
    change("#seed", false);
    click("#step");
    expect(document.querySelector("#b").dataset.state).toBe("blocked");
    expect(document.querySelector("#c").dataset.state).toBe("blocked");
  });
  it("draws a real two-object waiting cycle that repeated execution cannot complete", () => {
    const { document, click } = open("dependency-steps");
    click('button[data-mode="cycle"]');
    click("#step");
    click("#step");
    expect(document.querySelector("#a strong").textContent).toBe("A[D]");
    expect(document.querySelector("#b strong").textContent).toBe("B[D]");
    expect(document.querySelector("#a").dataset.state).toBe("blocked");
    expect(document.querySelector("#b").dataset.state).toBe("blocked");
    expect(document.querySelector("#edge1").getAttribute("d")).toContain("C");
    expect(document.querySelector("#edge2").getAttribute("d")).toContain("C");
    expect(document.querySelector("#seed").disabled).toBe(true);
  });
});
