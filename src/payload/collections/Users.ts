import type { CollectionConfig } from "payload";

const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
  },
  auth: true,
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
      admin: {
        description: "决定用户可以执行的操作权限",
      },
    },
  ],
  access: {
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
    // 只有管理员可以更新其他用户，用户可以更新自己（但不能改角色）
    update: ({ req, data }) => {
      if (!req.user) return false;
      if (req.user.role === "admin") return true;
      // 普通用户只能更新自己，且不能改角色
      if (data?.role && data.role !== req.user.role) {
        return false; // 防止权限提升
      }
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