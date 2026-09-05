import { Router } from "express";
import { PrismaClient } from "../generated/prisma/client.ts";

export function createDeliveryRoutes(prisma: PrismaClient) {
  const router = Router();

  // CREATE DELIVERY
  router.post("/", async (req, res) => {
    try {
      const {
        retailerId,
        customerName,
        customerPhone,
        deliveryAddress,
        itemDescription,
      } = req.body;

      if (
        !retailerId ||
        !customerName ||
        !customerPhone ||
        !deliveryAddress ||
        !itemDescription
      ) {
        return res.status(400).json({
          message: "All delivery fields are required",
        });
      }

      // Verify that the user creating the delivery is a retailer
      const retailer = await prisma.user.findUnique({
        where: {
          id: Number(retailerId),
        },
      });

      if (!retailer || retailer.role !== "RETAILER") {
        return res.status(403).json({
          message: "Only a retailer can create a delivery",
        });
      }

      const trackingCode = `RF-${Date.now()}`;

      const delivery = await prisma.delivery.create({
        data: {
          trackingCode,
          customerName,
          customerPhone,
          deliveryAddress,
          itemDescription,
          retailerId: Number(retailerId),
          status: "OPEN",
        },
      });

      res.status(201).json(delivery);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to create delivery",
      });
    }
  });

  // GET ALL DELIVERIES
  router.get("/", async (req, res) => {
    try {
      const deliveries = await prisma.delivery.findMany({
        include: {
          retailer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
            },
          },
          rider: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
            },
          },
          statusHistory: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(deliveries);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to fetch deliveries",
      });
    }
  });

  // GET DELIVERY BY TRACKING CODE
  router.get("/tracking/:trackingCode", async (req, res) => {
    try {
      const trackingCode = req.params.trackingCode;

      const delivery = await prisma.delivery.findUnique({
        where: {
          trackingCode,
        },
        include: {
          retailer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
            },
          },
          rider: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
            },
          },
          statusHistory: true,
        },
      });

      if (!delivery) {
        return res.status(404).json({
          message: "Delivery not found",
        });
      }

      res.json(delivery);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to find delivery",
      });
    }
  });

  // CONFIRM DELIVERY USING QR CODE
  router.post("/confirm", async (req, res) => {
    try {
      const { trackingCode, riderId } = req.body;

      if (!trackingCode || !riderId) {
        return res.status(400).json({
          message: "trackingCode and riderId are required",
        });
      }

      // Verify that the user is a rider
      const rider = await prisma.user.findUnique({
        where: {
          id: Number(riderId),
        },
      });

      if (!rider || rider.role !== "RIDER") {
        return res.status(403).json({
          message: "Only a rider can confirm a delivery",
        });
      }

      const delivery = await prisma.delivery.findUnique({
        where: {
          trackingCode,
        },
      });

      if (!delivery) {
        return res.status(404).json({
          message: "Delivery not found",
        });
      }

      if (delivery.riderId !== Number(riderId)) {
        return res.status(403).json({
          message: "This delivery is not assigned to you",
        });
      }

      if (delivery.qrConfirmedAt) {
        return res.status(400).json({
          message: "This delivery has already been confirmed",
          confirmedAt: delivery.qrConfirmedAt,
        });
      }

      const confirmedDelivery = await prisma.delivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          qrConfirmedAt: new Date(),
          qrConfirmedById: Number(riderId),
        },
        include: {
          rider: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
            },
          },
        },
      });

      res.json({
        message: "Delivery confirmed successfully",
        delivery: confirmedDelivery,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to confirm delivery",
      });
    }
  });

  // ASSIGN RIDER
  router.patch("/:id/assign", async (req, res) => {
    try {
      const deliveryId = Number(req.params.id);
      const riderId = Number(req.body.riderId);
      const dispatcherId = Number(req.body.dispatcherId);

      if (!riderId || !dispatcherId) {
        return res.status(400).json({
          message: "riderId and dispatcherId are required",
        });
      }

      // Verify that the person making the assignment is a dispatcher
      const dispatcher = await prisma.user.findUnique({
        where: { id: dispatcherId },
      });

          // Allow both DISPATCHER and ADMIN to assign riders
    if (!dispatcher || (dispatcher.role !== "DISPATCHER" && dispatcher.role !== "ADMIN")) {
      return res.status(403).json({
        message: "Only a dispatcher or admin can assign a rider.",
      });
    }

      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
      });

      if (!delivery) {
        return res.status(404).json({
          message: "Delivery not found",
        });
      }

      if (delivery.status !== "OPEN") {
        return res.status(400).json({
          message: `Delivery cannot be assigned because its status is ${delivery.status}`,
        });
      }

      const rider = await prisma.user.findUnique({
        where: { id: riderId },
      });

      if (!rider || rider.role !== "RIDER") {
        return res.status(400).json({
          message: "Selected user is not a valid rider",
        });
      }

      const updatedDelivery = await prisma.$transaction(
        async (tx) => {
          const updated = await tx.delivery.update({
            where: { id: deliveryId },
            data: {
              riderId,
              status: "ASSIGNED",
            },
          });

          await tx.statusHistory.create({
            data: {
              deliveryId,
              changedById: dispatcherId,
              oldStatus: "OPEN",
              newStatus: "ASSIGNED",
            },
          });

          return updated;
        }
      );

      res.json(updatedDelivery);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to assign rider",
      });
    }
  });

  // UPDATE DELIVERY STATUS
  router.patch("/:id/status", async (req, res) => {
    try {
      const deliveryId = Number(req.params.id);
      const riderId = Number(req.body.riderId);
      const newStatus = req.body.status;

      if (!riderId || !newStatus) {
        return res.status(400).json({
          message: "riderId and status are required",
        });
      }

      // Verify that the user is a rider
      const rider = await prisma.user.findUnique({
        where: {
          id: riderId,
        },
      });

      if (!rider || rider.role !== "RIDER") {
        return res.status(403).json({
          message: "Only a rider can update delivery status",
        });
      }

      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
      });

      if (!delivery) {
        return res.status(404).json({
          message: "Delivery not found",
        });
      }

      if (delivery.riderId !== riderId) {
        return res.status(403).json({
          message: "This rider is not assigned to this delivery",
        });
      }

      const validTransitions: Record<string, string[]> = {
        ASSIGNED: ["PICKED_UP"],
        PICKED_UP: ["DELIVERED"],
        DELIVERED: [],
      };

      const allowedStatuses =
        validTransitions[delivery.status] || [];

      if (!allowedStatuses.includes(newStatus)) {
        return res.status(400).json({
          message: `Cannot change status from ${delivery.status} to ${newStatus}`,
        });
      }

      const updatedDelivery = await prisma.$transaction(
        async (tx) => {
          const updated = await tx.delivery.update({
            where: { id: deliveryId },
            data: {
              status: newStatus,
            },
          });

          await tx.statusHistory.create({
            data: {
              deliveryId,
              changedById: riderId,
              oldStatus: delivery.status,
              newStatus,
            },
          });

          return updated;
        }
      );

      res.json(updatedDelivery);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to update delivery status",
      });
    }
  });

  return router;
}