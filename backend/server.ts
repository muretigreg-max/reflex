import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'; // <-- ADD THIS LINE

// Set up the PostgreSQL adapter
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });

// Pass the adapter to PrismaClient
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());

app.use(
  "/api/deliveries",
  createDeliveryRoutes(prisma)
);

app.use(
  "/api/users",
  createUserRoutes(prisma)
);

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

const PORT = 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Reflex API running on port ${PORT}`);
});