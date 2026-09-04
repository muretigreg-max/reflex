import { Router } from "express";
import { PrismaClient } from "../generated/prisma/client.ts";

export function createUserRoutes(prisma: PrismaClient) {
  const router = Router();

  // REGISTER NEW USER
  router.post("/register", async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        password,
        role,
      } = req.body;

      // Validate required fields
      if (!name || !phone || !password || !role) {
        return res.status(400).json({
          message: "Name, phone, password and role are required",
        });
      }

      // Only allow RETAILER or RIDER registration
      if (role !== "RETAILER" && role !== "RIDER") {
        return res.status(400).json({
          message: "You can only register as a retailer or rider",
        });
      }

      // Check if phone already exists
      const existingPhone = await prisma.user.findUnique({
        where: {
          phone,
        },
      });

      if (existingPhone) {
        return res.status(409).json({
          message: "An account with this phone number already exists",
        });
      }

      // Check if email already exists
      if (email) {
        const existingEmail = await prisma.user.findUnique({
          where: {
            email,
          },
        });

        if (existingEmail) {
          return res.status(409).json({
            message: "An account with this email already exists",
          });
        }
      }

      // Create the user
      const user = await prisma.user.create({
        data: {
          name,
          phone,
          email: email || null,
          password,
          role,
        },
      });

      // Never return the password
      const { password: _, ...safeUser } = user;

      res.status(201).json({
        message: "Account created successfully",
        user: safeUser,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Registration failed",
      });
    }
  });

  // LOGIN
  router.post("/login", async (req, res) => {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({
          message: "Phone and password are required",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          phone,
        },
      });

      if (!user || user.password !== password) {
        return res.status(401).json({
          message: "Invalid phone number or password",
        });
      }

      // Never send the password back to the frontend
      const { password: _, ...safeUser } = user;

      res.json(safeUser);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Login failed",
      });
    }
  });

  // GET ALL USERS
  router.get("/", async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      res.json(users);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch users",
      });
    }
  });
  // ADMIN CREATE USER
router.post("/admin-create", async (req, res) => {
  try {
    const {
      adminId,
      name,
      phone,
      email,
      password,
      role,
    } = req.body;

    if (!adminId || !name || !phone || !password || !role) {
      return res.status(400).json({
        message: "Admin ID, name, phone, password and role are required",
      });
    }

    // Verify the person creating the account is an ADMIN
    const admin = await prisma.user.findUnique({
      where: {
        id: Number(adminId),
      },
    });

    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only an admin can create users",
      });
    }

    // Admin can create operational users
    if (
      role !== "ADMIN" &&
      role !== "DISPATCHER" &&
      role !== "RETAILER" &&
      role !== "RIDER"
    ) {
      return res.status(400).json({
        message: "Invalid user role",
      });
    }

    // Check phone
    const existingPhone = await prisma.user.findUnique({
      where: {
        phone,
      },
    });

    if (existingPhone) {
      return res.status(409).json({
        message: "An account with this phone number already exists",
      });
    }

    // Check email
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (existingEmail) {
        return res.status(409).json({
          message: "An account with this email already exists",
        });
      }
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        password,
        role,
      },
    });

    // Never return the password
    const { password: _, ...safeUser } = user;

    res.status(201).json({
      message: "User created successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create user",
    });
  }
});

  return router;
}