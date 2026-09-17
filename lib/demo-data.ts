export const performances = [
  { date: "Sep 17", day: "Thu", time: "20:30", show: "Acrobatic Pirate", hotel: "Stella Palace", status: "Completed" },
  { date: "Sep 18", day: "Fri", time: "21:00", show: "Fire Show I", hotel: "Lyttos Beach", status: "Planned" },
  { date: "Sep 19", day: "Sat", time: "20:45", show: "Cuba Latin", hotel: "Eliros Mare", status: "Planned" },
  { date: "Sep 20", day: "Sun", time: "21:15", show: "Acrobatic Aerial II", hotel: "Pilot Beach", status: "Planned" },
];

export const shows = [
  { name: "Acrobatic Pirate", partner: "Yarik", artists: 3, performances: 4, rate: 650, token: "pirate-7Hk92Lm" },
  { name: "Fire Show I", partner: "Yarik", artists: 3, performances: 5, rate: 420, token: "fire-I-9Qp41Ds" },
  { name: "Cuba Latin", partner: "Maria", artists: 4, performances: 4, rate: 420, token: "latin-3Ft66Jx" },
];

export const expenses = [
  { date: "Sep 15", show: "Acrobatic Pirate", category: "Transport", payer: "Partner", amount: 185, status: "Submitted" },
  { date: "Sep 12", show: "Fire Show I", category: "Props", payer: "Company", amount: 320, status: "Approved" },
  { date: "Sep 08", show: "Cuba Latin", category: "Costumes", payer: "Artist", amount: 94, status: "Submitted" },
];
