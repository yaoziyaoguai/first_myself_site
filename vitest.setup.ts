import "@testing-library/jest-dom/vitest";

// 设置测试环境变量
process.env.PAYLOAD_SECRET = "test-secret-for-unit-tests";
process.env.DATABASE_URI = "postgres://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
