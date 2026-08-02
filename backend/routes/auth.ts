import bcrypt from "bcryptjs";
import express, { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { generateToken } from "../jwt.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware.js";
import { validate } from "../lib/validate.js";

const router = express.Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(
      /^\w+$/,
      "Username may only contain letters, numbers and underscores",
    ),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;

router.post(
  "/register",
  async (req: Request<unknown, unknown, RegisterBody>, res: Response) => {
    try {
      const body = validate(registerSchema, req.body, res);
      if (!body) return;

      const { username, email, password } = body;

      const emailCheck = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (emailCheck) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }

      const usernameCheck = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (usernameCheck) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: { username, email, passwordHash: hashedPassword },
        select: { id: true, username: true, email: true },
      });

      const token = generateToken(user.id);

      res.status(201).json({
        message: "User registered successfully",
        user,
        token,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  },
);

router.post(
  "/login",
  async (req: Request<unknown, unknown, LoginBody>, res: Response) => {
    try {
      const body = validate(loginSchema, req.body, res);
      if (!body) return;

      const { email, password } = body;

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, username: true, email: true, passwordHash: true },
      });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const token = generateToken(user.id);

      res.json({
        message: "Login successful",
        user: { id: user.id, username: user.username, email: user.email },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  },
);

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, username: true, email: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;
