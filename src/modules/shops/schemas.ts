import { z } from "zod";
import { optionalUrl, phoneSchema, uuidSchema } from "@/lib/validation";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");

export const openingHoursSchema = z
  .partialRecord(z.enum(DAYS), z.array(z.object({ open: time, close: time })).max(3))
  .refine(
    (h) => Object.values(h).every((slots) => slots.every((s) => s.open < s.close)),
    "Closing time must be after opening time.",
  );

export const shopBasicsSchema = z.object({
  name: z.string().trim().min(2, "Enter the shop name.").max(80),
  categoryId: uuidSchema,
  description: z.string().trim().max(1000, "Keep the description under 1000 characters.").optional(),
});

export const shopContactSchema = z
  .object({
    phone: phoneSchema,
    whatsapp: phoneSchema.optional(),
    email: z.string().trim().email("Enter a valid email address.").optional(),
    website: optionalUrl,
  });

export const branchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  addressLine: z.string().trim().min(4, "Enter the street address.").max(200),
  locality: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2, "Enter the town or city.").max(80),
  region: z.string().trim().max(80).optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, "Enter a valid postal code.")
    .optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  phone: phoneSchema.optional(),
}).refine((b) => !(b.lat === 0 && b.lng === 0), { message: "Pick the shop location on the map.", path: ["lat"] });

export const verificationSchema = z.object({
  verificationNote: z
    .string()
    .trim()
    .min(5, "Add a registration number or a short note so we can verify the business.")
    .max(1000),
});

export const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["manager", "staff"]),
});
