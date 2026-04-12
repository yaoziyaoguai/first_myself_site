import { buildConfig } from "payload";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

// 测试：不调用 lexicalEditor()，只引用
const editor = lexicalEditor;

export default buildConfig({
  serverURL: "http://localhost:3000",
  secret: "test-secret-for-debug-only",
  // 不传入 editor
  db: {} as any,
});
