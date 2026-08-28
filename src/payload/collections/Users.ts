import type { CollectionConfig } from "payload";

const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
  },
  auth: {
    cookies: {
      sameSite: "Lax",
      secure: true,
    },
  },
  fields: [
    {
      name: "role",
      type: "select",
      label: "角色",
      defaultValue: "viewer",
      options: [
        { label: "管理员", value: "admin" },
        { label: "编辑", value: "editor" },
        { label: "访客", value: "viewer" },
      ],
      required: true,
      saveToJWT: true,
      admin: {
        description: "决定用户可以执行的操作权限",
      },
      access: {
        create: ({ req }) => req.user?.role === "admin",
        update: ({ req }) => req.user?.role === "admin",
      },
    },
  ],
  access: {
    admin: ({ req }) =>
      req.user?.role === "admin" || req.user?.role === "editor",
    // 只有认证用户才能查看用户列表
    read: ({ req }) => {
      if (!req.user) return false;
      // 管理员可以查看所有用户，普通用户只能查看自己
      if (req.user.role === "admin") return true;
      return {
        id: {
          equals: req.user.id,
        },
      };
    },
    // 只有管理员可以创建用户
    create: ({ req }) => req.user?.role === "admin",
    // 非管理员只能更新自己的普通资料；role 字段还有独立的管理员校验。
    update: ({ req, data }) => {
      if (!req.user) return false;
      if (req.user.role === "admin") return true;
      if (data?.role && data.role !== req.user.role) return false;
      return {
        id: {
          equals: req.user.id,
        },
      };
    },
    // 只有管理员可以删除用户
    delete: ({ req }) => req.user?.role === "admin",
  },
};

export default Users;
