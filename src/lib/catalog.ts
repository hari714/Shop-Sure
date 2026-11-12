// Demo storefront listings. Verified shops' items are also mirrored into each shop's PayPal Catalog by the seed script.
export type Listing = {
  id: string;
  storeSlug: "asha" | "newleaf" | "megasale";
  storeName: string;
  title: string;
  price: number; // USD
  normalPrice: number;
  description: string;
};

export const LISTINGS: Listing[] = [
  { id: "asha-scarf", storeSlug: "asha", storeName: "Asha's Handmade", title: "Hand-woven cotton scarf", price: 32, normalPrice: 32, description: "Hand-woven on a wooden loom. Natural dyes." },
  { id: "asha-mug", storeSlug: "asha", storeName: "Asha's Handmade", title: "Hand-painted ceramic mug", price: 24, normalPrice: 24, description: "Glazed stoneware, dishwasher safe." },
  { id: "asha-candle", storeSlug: "asha", storeName: "Asha's Handmade", title: "Sandalwood soy candle", price: 18, normalPrice: 18, description: "40-hour burn, cotton wick." },
  { id: "newleaf-plant", storeSlug: "newleaf", storeName: "New Leaf Store", title: "Mini succulent gift set", price: 28, normalPrice: 28, description: "Three succulents in recycled pots." },
  { id: "newleaf-journal", storeSlug: "newleaf", storeName: "New Leaf Store", title: "Recycled paper journal", price: 15, normalPrice: 15, description: "A5, 120 pages." },
  { id: "mega-scarf", storeSlug: "megasale", storeName: "MEGA SALE Outlet", title: "Designer cashmere scarf", price: 9, normalPrice: 180, description: "95% OFF today only!!" },
  { id: "mega-headphones", storeSlug: "megasale", storeName: "MEGA SALE Outlet", title: "Premium wireless headphones", price: 19, normalPrice: 349, description: "Clearance — last 3 left!" },
];

export function listingsFor(slug: Listing["storeSlug"]) {
  return LISTINGS.filter((l) => l.storeSlug === slug);
}
