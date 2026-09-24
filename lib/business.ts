export const BUSINESS = {
  name: "Chaileela",
  locality: "Kolar Road, Bhopal",
  // Get this from Google's "Place ID Finder". Ask the user for the real value.
  placeId: "PUT_REAL_PLACE_ID_HERE",
  aspects: [
    { key: "staff",   pos: "Friendly staff",  neg: "Unfriendly staff" },
    { key: "chai",    pos: "Great chai",       neg: "Weak chai" },
    { key: "vibe",    pos: "Cozy vibe",        neg: "Noisy vibe" },
    { key: "speed",   pos: "Quick service",    neg: "Slow at peak" },
    { key: "value",   pos: "Good value",       neg: "Overpriced" },
    { key: "seating", pos: "Laptop-friendly",  neg: "Cramped seating" },
  ],
  // Representative picks from Chaileela's real menu categories (chaileela.com/menu).
  items: ["Chai", "Cold Coffee", "Bun Maska", "Maggie", "Sandwiches", "French Fries"],
} as const;
