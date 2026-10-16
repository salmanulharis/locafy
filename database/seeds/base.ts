/**
 * Reference data required in every environment (including production):
 * categories, subscription plans, search synonyms and localities.
 * Idempotent: safe to run repeatedly.  Usage: pnpm db:seed
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";

type Cat = { slug: string; name: string; icon: string; scope?: "product" | "shop" | "both"; children?: [string, string][] };

export const CATEGORIES: Cat[] = [
  { slug: "mobiles", name: "Mobiles & Accessories", icon: "smartphone", children: [["smartphones", "Smartphones"], ["chargers-cables", "Chargers & Cables"], ["headphones", "Headphones & Earbuds"], ["phone-cases", "Cases & Screen Guards"]] },
  { slug: "electronics", name: "Electronics", icon: "tv", children: [["televisions", "Televisions"], ["laptops", "Laptops"], ["cameras", "Cameras"], ["computer-accessories", "Computer Accessories"]] },
  { slug: "appliances", name: "Home Appliances", icon: "refrigerator", children: [["kitchen-appliances", "Kitchen Appliances"], ["fans-coolers", "Fans & Coolers"], ["washing-machines", "Washing Machines"]] },
  { slug: "groceries", name: "Groceries", icon: "shopping-basket", children: [["rice-grains", "Rice, Flour & Grains"], ["spices", "Spices & Masalas"], ["snacks", "Snacks & Beverages"], ["dairy", "Dairy & Eggs"]] },
  { slug: "pharmacy", name: "Pharmacy & Health", icon: "pill", children: [["otc-medicines", "Over-the-counter"], ["health-devices", "Health Devices"]] },
  { slug: "hardware", name: "Hardware & Tools", icon: "wrench", children: [["power-tools", "Power Tools"], ["electricals", "Electricals & Lighting"], ["plumbing", "Plumbing"]] },
  { slug: "stationery", name: "Stationery & Books", icon: "book-open" },
  { slug: "fashion", name: "Fashion", icon: "shirt" },
  { slug: "footwear", name: "Footwear", icon: "footprints" },
  { slug: "home-kitchen", name: "Home & Kitchen", icon: "cooking-pot" },
  { slug: "beauty", name: "Beauty & Personal Care", icon: "sparkles" },
  { slug: "sports", name: "Sports & Fitness", icon: "dumbbell" },
  { slug: "toys", name: "Toys & Baby", icon: "baby" },
  { slug: "auto-parts", name: "Auto Parts & Accessories", icon: "car" },
  { slug: "pet-supplies", name: "Pet Supplies", icon: "paw-print" },
];

export const PLANS: (typeof schema.plans.$inferInsert)[] = [
  {
    code: "free", name: "Free", description: "Get discovered locally at no cost.", priceMinor: 0, currency: "INR", isDefault: true, sortOrder: 0,
    entitlements: { maxListings: 25, maxStorageMb: 50, maxBranches: 1, maxStaff: 2, maxActiveOffers: 2, advancedAnalytics: false, bulkImport: false, promotionScheduling: false, sponsoredPlacements: false },
  },
  {
    code: "starter", name: "Starter", description: "For growing shops with a larger range.", priceMinor: 49_900, currency: "INR", sortOrder: 1,
    entitlements: { maxListings: 200, maxStorageMb: 500, maxBranches: 2, maxStaff: 4, maxActiveOffers: 10, advancedAnalytics: false, bulkImport: false, promotionScheduling: true, sponsoredPlacements: false },
  },
  {
    code: "growth", name: "Growth", description: "Multiple branches, a team and deeper insights.", priceMinor: 149_900, currency: "INR", sortOrder: 2,
    entitlements: { maxListings: 1000, maxStorageMb: 2048, maxBranches: 5, maxStaff: 10, maxActiveOffers: 50, advancedAnalytics: true, bulkImport: true, promotionScheduling: true, sponsoredPlacements: false },
  },
  {
    code: "premium", name: "Premium", description: "Unlimited catalogue and sponsored placement access.", priceMinor: 399_900, currency: "INR", sortOrder: 3,
    entitlements: { maxListings: -1, maxStorageMb: 10240, maxBranches: 20, maxStaff: 30, maxActiveOffers: -1, advancedAnalytics: true, bulkImport: true, promotionScheduling: true, sponsoredPlacements: true },
  },
];

export const SYNONYMS: [string, string[]][] = [
  ["mobile", ["phone", "smartphone", "cellphone"]],
  ["tv", ["television"]],
  ["laptop", ["notebook"]],
  ["earphones", ["headphones", "earbuds", "headset"]],
  ["fridge", ["refrigerator"]],
  ["charger", ["adapter", "adaptor"]],
  ["cable", ["cord", "wire"]],
  ["ac", ["air conditioner"]],
  ["atta", ["wheat flour"]],
  ["dal", ["lentils"]],
  ["mixie", ["mixer grinder", "mixer"]],
  ["bulb", ["lamp", "light"]],
  ["slippers", ["chappals", "flip flops"]],
  ["specs", ["spectacles", "glasses"]],
  ["powerbank", ["power bank"]],
];

/** [name, district, region, postal code, lat, lng, population (approx)] — India. */
export const LOCALITIES: [string, string | null, string, string | null, number, number, number | null][] = [
  ["Kochi", "Ernakulam", "Kerala", "682011", 9.9312, 76.2673, 677381],
  ["Ernakulam", "Ernakulam", "Kerala", "682016", 9.9816, 76.2999, null],
  ["Edappally", "Ernakulam", "Kerala", "682024", 10.0261, 76.3125, null],
  ["Kakkanad", "Ernakulam", "Kerala", "682030", 10.0159, 76.3419, null],
  ["Vyttila", "Ernakulam", "Kerala", "682019", 9.9674, 76.3184, null],
  ["Aluva", "Ernakulam", "Kerala", "683101", 10.1004, 76.357, null],
  ["Fort Kochi", "Ernakulam", "Kerala", "682001", 9.9658, 76.2421, null],
  ["Thiruvananthapuram", "Thiruvananthapuram", "Kerala", "695001", 8.5241, 76.9366, 957730],
  ["Kozhikode", "Kozhikode", "Kerala", "673001", 11.2588, 75.7804, 609224],
  ["Thrissur", "Thrissur", "Kerala", "680001", 10.5276, 76.2144, 315957],
  ["Kollam", "Kollam", "Kerala", "691001", 8.8932, 76.6141, 349033],
  ["Kannur", "Kannur", "Kerala", "670001", 11.8745, 75.3704, 232486],
  ["Kottayam", "Kottayam", "Kerala", "686001", 9.5916, 76.5222, 136812],
  ["Alappuzha", "Alappuzha", "Kerala", "688001", 9.4981, 76.3388, 174164],
  ["Palakkad", "Palakkad", "Kerala", "678001", 10.7867, 76.6548, 130955],
  ["Malappuram", "Malappuram", "Kerala", "676505", 11.051, 76.0711, 101330],
  ["Thodupuzha", "Idukki", "Kerala", "685584", 9.8959, 76.7184, null],
  ["Kalpetta", "Wayanad", "Kerala", "673121", 11.6085, 76.083, null],
  ["Kasaragod", "Kasaragod", "Kerala", "671121", 12.4996, 74.9869, null],
  ["Pathanamthitta", "Pathanamthitta", "Kerala", "689645", 9.2648, 76.787, null],
  ["Bengaluru", "Bengaluru Urban", "Karnataka", "560001", 12.9716, 77.5946, 8443675],
  ["Mysuru", "Mysuru", "Karnataka", "570001", 12.2958, 76.6394, 920550],
  ["Mangaluru", "Dakshina Kannada", "Karnataka", "575001", 12.9141, 74.856, 488968],
  ["Chennai", "Chennai", "Tamil Nadu", "600001", 13.0827, 80.2707, 4646732],
  ["Coimbatore", "Coimbatore", "Tamil Nadu", "641001", 11.0168, 76.9558, 1050721],
  ["Madurai", "Madurai", "Tamil Nadu", "625001", 9.9252, 78.1198, 1017865],
  ["Hyderabad", "Hyderabad", "Telangana", "500001", 17.385, 78.4867, 6809970],
  ["Visakhapatnam", "Visakhapatnam", "Andhra Pradesh", "530001", 17.6868, 83.2185, 1728128],
  ["Mumbai", "Mumbai", "Maharashtra", "400001", 19.076, 72.8777, 12442373],
  ["Pune", "Pune", "Maharashtra", "411001", 18.5204, 73.8567, 3124458],
  ["Nagpur", "Nagpur", "Maharashtra", "440001", 21.1458, 79.0882, 2405665],
  ["New Delhi", "New Delhi", "Delhi", "110001", 28.6139, 77.209, 16787941],
  ["Noida", "Gautam Buddh Nagar", "Uttar Pradesh", "201301", 28.5355, 77.391, 637272],
  ["Gurugram", "Gurugram", "Haryana", "122001", 28.4595, 77.0266, 876969],
  ["Kolkata", "Kolkata", "West Bengal", "700001", 22.5726, 88.3639, 4496694],
  ["Ahmedabad", "Ahmedabad", "Gujarat", "380001", 23.0225, 72.5714, 5577940],
  ["Surat", "Surat", "Gujarat", "395003", 21.1702, 72.8311, 4467797],
  ["Jaipur", "Jaipur", "Rajasthan", "302001", 26.9124, 75.7873, 3046163],
  ["Lucknow", "Lucknow", "Uttar Pradesh", "226001", 26.8467, 80.9462, 2817105],
  ["Chandigarh", "Chandigarh", "Chandigarh", "160017", 30.7333, 76.7794, 960787],
  ["Bhopal", "Bhopal", "Madhya Pradesh", "462001", 23.2599, 77.4126, 1798218],
  ["Indore", "Indore", "Madhya Pradesh", "452001", 22.7196, 75.8577, 1964086],
  ["Patna", "Patna", "Bihar", "800001", 25.5941, 85.1376, 1684222],
  ["Guwahati", "Kamrup Metropolitan", "Assam", "781001", 26.1445, 91.7362, 957352],
  ["Bhubaneswar", "Khordha", "Odisha", "751001", 20.2961, 85.8245, 837737],
];

export async function seedBase(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  try {
    let order = 0;
    for (const c of CATEGORIES) {
      const [parent] = await db
        .insert(schema.categories)
        .values({ slug: c.slug, name: c.name, icon: c.icon, sortOrder: order++, scope: c.scope ?? "both" })
        .onConflictDoUpdate({ target: schema.categories.slug, set: { name: c.name, icon: c.icon } })
        .returning({ id: schema.categories.id });
      let childOrder = 0;
      for (const [slug, name] of c.children ?? []) {
        await db
          .insert(schema.categories)
          .values({ slug, name, parentId: parent!.id, sortOrder: childOrder++, scope: "product" })
          .onConflictDoUpdate({ target: schema.categories.slug, set: { name, parentId: parent!.id } });
      }
    }
    for (const p of PLANS) {
      await db.insert(schema.plans).values(p).onConflictDoNothing({ target: schema.plans.code });
    }
    for (const [term, synonyms] of SYNONYMS) {
      await db.insert(schema.searchSynonyms).values({ term, synonyms }).onConflictDoNothing({ target: schema.searchSynonyms.term });
    }
    const existing = await db.select({ n: sql<number>`count(*)::int` }).from(schema.localities);
    if ((existing[0]?.n ?? 0) === 0) {
      await db.insert(schema.localities).values(
        LOCALITIES.map(([name, district, region, postalCode, lat, lng, population]) => ({
          name,
          district,
          region,
          postalCode,
          countryCode: "in",
          location: { lat, lng },
          population,
        })),
      );
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("seeds/base.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  seedBase(url)
    .then(() => console.log("Base reference data seeded."))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
