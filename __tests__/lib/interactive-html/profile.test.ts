import { describe, expect, it } from "vitest";
import {
  adaptAuthorToolHtml,
  decodePublicHtmlBytes,
  normalizePublicHtml,
  preparePublicHtml,
  validatePublicHtml,
} from "@/lib/interactive-html/profile";
import { INTERACTIVE_HTML_LIMITS } from "@/lib/interactive-html/marker";

function codes(html: string): string[] {
  return validatePublicHtml(html).map((issue) => issue.code);
}

function doc(body: string, head = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("公开副本 profile 审查", () => {
  it("接受内联 CSS/JS、data 图片与 #锚点", () => {
    expect(
      codes(
        doc(
          `<img src="${PNG}" alt=""><a href="#top">跳转</a><div style="color: red"></div><script>document.title = "x"</script>`,
          `<style>.a { color: blue }</style>`,
        ),
      ),
    ).toEqual([]);
  });

  it("拒绝远程脚本、远程图片与 srcset", () => {
    expect(
      codes(doc(`<script src="https://example.com/a.js"></script>`)),
    ).toContain("INTERACTIVE_REMOTE_SCRIPT");
    expect(codes(doc(`<img src="https://example.com/a.png">`))).toContain(
      "INTERACTIVE_REMOTE_RESOURCE",
    );
    expect(codes(doc(`<img src="${PNG}" srcset="a.png 2x">`))).toContain(
      "INTERACTIVE_SRCSET",
    );
  });

  it("拒绝相对资源、CSS @import 与远程 url()", () => {
    expect(codes(doc(`<img src="assets/a.png">`))).toContain(
      "INTERACTIVE_REMOTE_RESOURCE",
    );
    expect(
      codes(doc("", `<style>@import url(https://x.test/a.css);</style>`)),
    ).toContain("INTERACTIVE_CSS_IMPORT");
    expect(
      codes(doc(`<div style="background:url(https://x.test/a.png)"></div>`)),
    ).toContain("INTERACTIVE_CSS_URL");
    expect(
      codes(doc("", `<style>.a{background:url(https://x.test/a.png)}</style>`)),
    ).toContain("INTERACTIVE_CSS_URL");
  });

  it("只允许白名单 data MIME，HTML/JS 资源一律拒绝", () => {
    expect(
      codes(doc(`<img src="data:text/html;base64,PHNjcmlwdD4=">`)),
    ).toContain("INTERACTIVE_REMOTE_RESOURCE");
    expect(
      codes(
        doc(`<script src="data:text/javascript;base64,YWxlcnQoMSk="></script>`),
      ),
    ).toContain("INTERACTIVE_REMOTE_SCRIPT");
    expect(codes(doc(`<img src="${PNG}">`))).toEqual([]);
  });

  it("拒绝表单、嵌套文档、base 与 meta refresh/CSP", () => {
    for (const element of [
      "<form></form>",
      "<iframe></iframe>",
      "<object></object>",
      "<embed>",
      '<base href="/">',
      '<link rel="stylesheet" href="x">',
    ]) {
      expect(codes(doc(element))).toContain("INTERACTIVE_FORBIDDEN_ELEMENT");
    }
    expect(
      codes(
        doc("", `<meta http-equiv="refresh" content="0;url=https://x.test">`),
      ),
    ).toContain("INTERACTIVE_FORBIDDEN_META");
    expect(
      codes(
        doc(
          "",
          `<meta http-equiv="Content-Security-Policy" content="default-src *">`,
        ),
      ),
    ).toContain("INTERACTIVE_FORBIDDEN_META");
    expect(
      codes(doc("", `<meta name="referrer" content="unsafe-url">`)),
    ).toContain("INTERACTIVE_FORBIDDEN_META");
  });

  it("拒绝表单动作、ping 与 _blank 顶层跳转", () => {
    expect(
      codes(doc(`<button formaction="https://x.test">x</button>`)),
    ).toContain("INTERACTIVE_FORBIDDEN_ATTR");
    expect(codes(doc(`<a href="#x" ping="https://x.test">x</a>`))).toContain(
      "INTERACTIVE_FORBIDDEN_ATTR",
    );
    expect(
      codes(doc(`<a href="https://example.com" target="_blank">x</a>`)),
    ).toContain("INTERACTIVE_LINK_TARGET");
  });

  it("拒绝 javascript: 链接与相对链接", () => {
    expect(codes(doc(`<a href="javascript:alert(1)">x</a>`))).toContain(
      "INTERACTIVE_LINK_PROTOCOL",
    );
    expect(codes(doc(`<a href="/other">x</a>`))).toContain(
      "INTERACTIVE_RELATIVE_LINK",
    );
    expect(codes(doc(`<a href="https://example.com">x</a>`))).toEqual([]);
    expect(codes(doc(`<a href="mailto:a@example.com">x</a>`))).toEqual([]);
  });

  it("拒绝非空 #am-source 隐藏源文", () => {
    expect(
      codes(doc(`<textarea id="am-source">secret markdown</textarea>`)),
    ).toContain("INTERACTIVE_HIDDEN_SOURCE");
    expect(codes(doc(`<textarea id="am-source"></textarea>`))).toEqual([]);
  });
});

describe("字节解码与规范化", () => {
  it("拒绝空、超限、非法 UTF-8、NUL 与孤立代理项", () => {
    expect(decodePublicHtmlBytes(new Uint8Array()).ok).toBe(false);
    const huge = new Uint8Array(
      INTERACTIVE_HTML_LIMITS.maxDocumentBytes + 1,
    ).fill(0x61);
    expect(decodePublicHtmlBytes(huge).ok).toBe(false);
    expect(decodePublicHtmlBytes(new Uint8Array([0xff, 0xfe])).ok).toBe(false);
    expect(decodePublicHtmlBytes(new TextEncoder().encode("a\u0000b")).ok).toBe(
      false,
    );
    // 孤立代理项无法由严格 UTF-8 解码产生；该分支只防御异常上游字符串。
    expect(decodePublicHtmlBytes(new TextEncoder().encode("a\uFFfdb")).ok).toBe(
      true,
    );
  });

  it("去 BOM 并统一换行，之后字节固定", () => {
    expect(normalizePublicHtml("﻿a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("answer-me-with-html 适配", () => {
  const generator = `<meta name="generator" content="Answer me with HTML 0.4.8">`;

  it("清空隐藏源文并移除复制按钮", () => {
    const html = doc(
      `<textarea id="am-source">原始 Markdown</textarea><button data-am="copy">复制</button><button data-am="theme">主题</button>`,
      generator,
    );
    const adapted = adaptAuthorToolHtml(html);
    expect(adapted.adaptations).toHaveLength(2);
    expect(adapted.html).not.toContain("原始 Markdown");
    expect(adapted.html).not.toContain('data-am="copy"');
    expect(adapted.html).toContain('data-am="theme"');
    expect(adapted.remainingSource).toBe(false);
  });

  it("非生成器页面不做任何改写", () => {
    const html = doc(`<textarea id="am-source">用户自己的文本</textarea>`);
    const adapted = adaptAuthorToolHtml(html);
    expect(adapted.adaptations).toEqual([]);
    expect(adapted.html).toBe(html);
    expect(adapted.remainingSource).toBe(true);
  });

  it("生成器页面的所有 #am-source 都会被清空", () => {
    const html = doc(
      `<textarea id="am-source">秘密</textarea>`,
      generator,
    ).replace("</body>", `<textarea id="am-source">第二份</textarea></body>`);
    const adapted = adaptAuthorToolHtml(html);
    expect(adapted.html).not.toContain("秘密");
    expect(adapted.html).not.toContain("第二份");
    expect(adapted.remainingSource).toBe(false);
  });
});

describe("preparePublicHtml", () => {
  it.each(["\uFEFF<!doctype html><p>demo</p>", "<!doctype html>\r\n<p>demo</p>"])(
    "服务端不悄悄规范化上传字节 %#",
    (source) => {
      const result = preparePublicHtml(Buffer.from(source), { adapt: false });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.map((item) => item.code)).toContain("INTERACTIVE_NON_CANONICAL");
      expect(preparePublicHtml(Buffer.from(source), { adapt: true }).ok).toBe(true);
    },
  );
  it("adapt:false 时拒绝生成器原始文件", () => {
    const original = Buffer.from(
      doc(
        `<textarea id="am-source">原始 Markdown</textarea>`,
        `<meta name="generator" content="Answer me with HTML 0.4.8">`,
      ),
      "utf8",
    );
    const result = preparePublicHtml(original, { adapt: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain(
        "INTERACTIVE_HIDDEN_SOURCE",
      );
    }
  });

  it("adapt:true 产出稳定 hash 与准确字节数", () => {
    const original = Buffer.from(
      doc(
        `<textarea id="am-source">原始 Markdown</textarea>`,
        `<meta name="generator" content="Answer me with HTML 0.4.8">`,
      ),
      "utf8",
    );
    const result = preparePublicHtml(original, { adapt: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.byteLength).toBe(
      Buffer.byteLength(result.value.html, "utf8"),
    );
    expect(result.value.sha256).toMatch(/^[a-f0-9]{64}$/);
    const again = preparePublicHtml(Buffer.from(result.value.html, "utf8"), {
      adapt: false,
    });
    expect(again.ok && again.value.sha256).toBe(result.value.sha256);
  });
});
