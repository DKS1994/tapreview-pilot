export const BUSINESS = {
  name: "Kaapi Katte",
  locality: "Koramangala, Bangalore",
  // Get this from Google's "Place ID Finder". Ask the user for the real value.
  placeId: "PUT_REAL_PLACE_ID_HERE",
  aspects: [
    { key: "staff",   pos: "Friendly staff",  neg: "Unfriendly staff" },
    { key: "coffee",  pos: "Great coffee",     neg: "Weak coffee" },
    { key: "vibe",    pos: "Cozy vibe",        neg: "Noisy vibe" },
    { key: "speed",   pos: "Quick service",    neg: "Slow at peak" },
    { key: "value",   pos: "Good value",       neg: "Overpriced" },
    { key: "seating", pos: "Laptop-friendly",  neg: "Cramped seating" },
  ],
  items: ["Filter coffee", "Cold coffee", "Croissant", "Masala chai"],
} as const;
