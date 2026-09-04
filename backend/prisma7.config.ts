import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "postgresql://neondb_owner:npg_1wJQ6jgeYxKR@ep-bitter-heart-zaqm4shd-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});