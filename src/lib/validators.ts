import { ClientStage } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(2, "Business name is required"),
  businessDescription: z.string().min(20, "Add at least 20 characters"),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const createRequestSchema = z.object({
  title: z.string().min(2, "Title is required").max(120),
  description: z.string().max(400).optional().or(z.literal("")),
  dueDate: z.iso.date().optional().or(z.literal("")),
});

export const updateStageSchema = z.object({
  stage: z.enum(ClientStage),
});
