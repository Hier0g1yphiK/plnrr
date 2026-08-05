import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const basePrisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

export const prisma = basePrisma.$extends({
  query: {
    checklistTemplate: {
      async create({ args, query }) {
        if (args.data.name) args.data.nameLower = args.data.name.toLowerCase();
        return query(args);
      },
      async update({ args, query }) {
        if (args.data.name) {
          const name =
            typeof args.data.name === "string"
              ? args.data.name
              : args.data.name.set;
          if (name) args.data.nameLower = name.toLowerCase();
        }
        return query(args);
      },
      async createMany({ args, query }) {
        const data = Array.isArray(args.data) ? args.data : [args.data];
        data.forEach((d) => {
          if (d.name) d.nameLower = d.name.toLowerCase();
        });
        return query(args);
      },
    },
  },
});
