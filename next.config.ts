import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Content Security Policy - 防止 XSS 和注入攻击
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: https:; " +
              "font-src 'self'; " +
              "connect-src 'self' https:; " +
              "frame-ancestors 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self';",
          },
          // 防止点击劫持（clickjacking）
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // 防止 MIME 类型嗅探
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // 防止反射型 XSS
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer Policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions Policy（之前叫 Feature Policy）
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(), " +
              "microphone=(), " +
              "camera=(), " +
              "payment=(), " +
              "usb=(), " +
              "magnetometer=(), " +
              "gyroscope=(), " +
              "accelerometer=()",
          },
          // Strict Transport Security（HTTPS only）
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);