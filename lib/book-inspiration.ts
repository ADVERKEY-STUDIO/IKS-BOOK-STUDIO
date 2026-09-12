import { bookPersonaPatch, type BookPersona } from "./book-persona.ts";

export const inspirationAspects = ["typography", "palette", "illustration", "layout"] as const;
export type InspirationAspect = typeof inspirationAspects[number];
export type BookInspiration = {
  version: 1;
  references: Partial<Record<InspirationAspect, string>>;
  notes: string;
};
export type InspirationBook = {
  id: string;
  title: string;
  creators: string;
  publisher: string;
  edition: string;
  category: "Scripture & commentary" | "Devotional stories" | "Traditional art" | "Historical manuscripts";
  sourceUrl: string;
  images: { url: string; label: string; kind: "Interior" | "Cover" | "Manuscript" }[];
  tags: string[];
  description: string;
  evidence: string;
  rights: string;
  direction: Record<InspirationAspect, string>;
  palette: BookPersona["palette"];
  personaId: BookPersona["id"];
  fontTheme: string;
  pageAesthetic: string;
  bookBorder: string;
};

const tara = "https://tarabooks.com/wp-content/uploads/2025/02/";
const publisherRights = "Publisher-hosted reference preview. Copyright remains with the credited creators and publisher. No reuse license is asserted; these images are not imported into your book.";
const interiors = (names: string[]) => names.map((name, index) => ({ url: tara + name + ".jpg", label: `Publisher interior sample ${index + 1}`, kind: "Interior" as const }));

// A curated catalogue of real editions. Direction fields are our editorial interpretation,
// not claims about the original book's exact font, palette, or production specification.
export const inspirationBooks: InspirationBook[] = [
  {
    id: "sitas-ramayana", title: "Sita’s Ramayana", creators: "Samhita Arni · Moyna Chitrakar · Design: Jonathan Yamakami", publisher: "Tara Books", edition: "156 pages · ISBN 9789380340036",
    category: "Devotional stories", sourceUrl: "https://tarabooks.com/shop/sitas-ramayana/",
    images: interiors(["sitas_ramayana_2", "sitas_ramayana_1", "sitas_ramayana_3"]), tags: ["Patua painting", "Narrative panels", "Expressive line"],
    description: "A retelling of the Ramayana through Sita’s perspective, illustrated in the Patua tradition. Large portraits and sequential scenes offer different ways to pace a story.",
    evidence: "Publisher interior samples. Modern retelling; not an original scripture edition.", rights: publisherRights,
    direction: { typography: "Quiet, compact text blocks set apart from active artwork; keep original verses in a separate, readable hierarchy.", palette: "Warm vermilion, leafy green and golden yellow, balanced by cream reading areas.", illustration: "Expressive ink contours and richly colored narrative painting. Develop original characters and scenes from this manuscript.", layout: "Alternate a dominant portrait with sequential action panels and spacious text areas. Choose the composition from the passage." },
    palette: { ink: "#283b2b", accent: "#b73826", support: "#c29931", paper: "#fff8e6" }, personaId: "folk-story-caravan", fontTheme: "Storybook Serif", pageAesthetic: "Playful Panels", bookBorder: "No Border",
  },
  {
    id: "gita-mewar", title: "The Gita", creators: "Allah Baksh · Alok Bhalla · Chandra Prakash Deval", publisher: "Niyogi Books", edition: "Mewari Miniature Painting (1680–1698) · 484 pages",
    category: "Scripture & commentary", sourceUrl: "https://niyogibooksindia.com/books/the-gita/",
    images: [{ url: "https://niyogibooksindia.com/wp-content/uploads/2023/10/978-93-86906-93-9_20221117235627.png", label: "Publisher cover; interior preview available from source when supplied", kind: "Cover" }],
    tags: ["Verse & painting", "Miniature tradition", "Commentary"], description: "A study of Allah Baksh’s painted interpretation of the Gita, accompanied by commentary and Hindi translation. A promising reference for adult scripture editions.",
    evidence: "Cover and publisher description verified. Interior composition has not been reviewed. The dates in the subtitle refer to the paintings.", rights: publisherRights,
    direction: { typography: "Distinguish original verse, translation and commentary with generous line spacing and a restrained serif hierarchy.", palette: "Restrained earth red and gold with warm ivory reading pages.", illustration: "Detailed miniature-inspired narrative painting with culturally grounded architecture and devotional iconography; use approved references.", layout: "Pair a carefully chosen painting with its related verse and explanation. Preserve room for longer commentary." },
    palette: { ink: "#3b3029", accent: "#923f2e", support: "#b38b45", paper: "#fbf5e8" }, personaId: "living-history-chronicle", fontTheme: "Storybook Serif", pageAesthetic: "Calm Editorial", bookBorder: "Golden Lines",
  },
  {
    id: "circle-of-fate", title: "The Circle of Fate", creators: "Radhashyam Raut · Raja Mohanty · Sirish Rao", publisher: "Tara Books", edition: "24 pages · ISBN 9788186211588",
    category: "Devotional stories", sourceUrl: "https://tarabooks.com/shop/the-circle-of-fate/", images: interiors(["Circle-of-Life-1", "circle-of-fate-2", "circle-of-fate-3"]),
    tags: ["Patachitra", "Ornament", "Parable"], description: "A Hindu parable illustrated through the Patachitra tradition. A reference for narrative painting and deliberate ornament.", evidence: "Publisher interior samples. A parable, rather than a scripture edition.", rights: publisherRights,
    direction: { typography: "Readable serif text with separate verse and explanatory blocks; keep ornament clear of letters.", palette: "Deep red, charcoal and warm paper, with gold as a selective accent.", illustration: "Intricate narrative painting, confident outlines and purposeful traditional detail; maintain consistent character attributes.", layout: "Use a framed opening and quieter reading pages. Reserve dense decoration for meaningful transitions." },
    palette: { ink: "#362c29", accent: "#9b322a", support: "#b79552", paper: "#fcf3e4" }, personaId: "theatre-of-feelings", fontTheme: "Storybook Serif", pageAesthetic: "Heritage Frame", bookBorder: "Folk Geometry",
  },
  {
    id: "waterlife", title: "Waterlife", creators: "Rambharos Jha · Design: Jonathan Yamakami", publisher: "Tara Books", edition: "28 pages · ISBN 9789380340135",
    category: "Traditional art", sourceUrl: "https://tarabooks.com/shop/waterlife/", images: interiors(["Waterlife_Spread-3", "Waterlife_Spread-2", "Waterlife_Spread-1"]),
    tags: ["Mithila art", "Breathing room", "Nature"], description: "Aquatic life rendered through Mithila art. An adjacent reference for balancing intricate images with spacious pages and brief text.", evidence: "Publisher interior samples. Art and nature reference; not a Vedic text.", rights: publisherRights,
    direction: { typography: "Short, spacious serif passages with comfortable leading; let a verse or reflection stand on its own.", palette: "Warm ivory, blue-green and a restrained ochre accent.", illustration: "Intricate hand-drawn natural forms and finely patterned surfaces, using imagery meaningful to the passage.", layout: "Give detailed artwork breathing room. Vary a full image with smaller vignettes and quiet reading pages." },
    palette: { ink: "#25464c", accent: "#397976", support: "#bd914a", paper: "#fcf8ec" }, personaId: "wisdom-and-ideas", fontTheme: "Storybook Serif", pageAesthetic: "Calm Editorial", bookBorder: "No Border",
  },
  {
    id: "night-life-trees", title: "The Night Life of Trees", creators: "Bhajju Shyam · Durga Bai · Ramsingh Urveti · Design: Rathna Ramanathan", publisher: "Tara Books", edition: "40 pages · ISBN 9788186211922 · Publisher samples across printings",
    category: "Traditional art", sourceUrl: "https://tarabooks.com/shop/the-night-life-of-trees/", images: interiors(["night-life-of-trees-6", "nightlife-of-trees-7", "nightlife-of-trees-4"]),
    tags: ["Gond art", "Dark grounds", "Contemplative"], description: "Gond tree lore and handmade bookmaking. A reference for luminous pattern, strong silhouettes and a contemplative visual rhythm.", evidence: "Publisher samples; this title has multiple printings. Art/lore reference, not scripture.", rights: publisherRights,
    direction: { typography: "Simple, comfortably spaced text; maintain high contrast and avoid placing small type over patterns.", palette: "Deep forest ink, ochre and restrained red; use light reading pages between dark illustration moments.", illustration: "Luminous patterned forms on dark grounds, with meaningful silhouettes and an original visual vocabulary.", layout: "Alternate dark illustrated moments with quiet light reading pages. Avoid repeating one tree-shaped composition throughout." },
    palette: { ink: "#253529", accent: "#af5835", support: "#ba9d4e", paper: "#f8f3e5" }, personaId: "wisdom-and-ideas", fontTheme: "Storybook Serif", pageAesthetic: "Calm Editorial", bookBorder: "No Border",
  },
  {
    id: "creation", title: "Creation", creators: "Bhajju Shyam · Gita Wolf · Design: Oliver Mayes", publisher: "Tara Books", edition: "24 pages · ISBN 9789383145034",
    category: "Traditional art", sourceUrl: "https://tarabooks.com/shop/creation/", images: interiors(["Creation_1", "Creation_2", "Creation_3"]), tags: ["Gond narratives", "Symbolic imagery", "Screenprint"],
    description: "Gond origin narratives expressed through a sequence of handmade images. An adjacent reference for giving each passage its own symbolic composition.", evidence: "Publisher interior samples. Gond origin narratives must not be labeled as Vedic scripture.", rights: publisherRights,
    direction: { typography: "Clear reading blocks and restrained headings; preserve the original text and its attribution.", palette: "Clay orange, charcoal and muted gold with warm paper.", illustration: "Pattern-rich original symbolic compositions rooted in the source; avoid invented sacred quotations or symbols.", layout: "One central idea per image, varying scale and placement through the sequence. Leave sufficient quiet space for reading." },
    palette: { ink: "#34342b", accent: "#b76337", support: "#b99b55", paper: "#faf1df" }, personaId: "makers-workshop", fontTheme: "Storybook Serif", pageAesthetic: "Calm Editorial", bookBorder: "No Border",
  },
  {
    id: "ganesha-sweet-tooth", title: "Ganesha’s Sweet Tooth", creators: "Sanjay Patel · Emily Haynes", publisher: "Chronicle Books", edition: "2021 board book · 32 pages · ISBN 9781797212524",
    category: "Devotional stories", sourceUrl: "https://www.chroniclebooks.com/products/ganeshas-sweet-tooth",
    images: [{ url: "https://www.chroniclebooks.com/cdn/shop/products/9781797212524.pt05_2048x2048.jpg?v=1631741687", label: "Publisher interior sample 1", kind: "Interior" }, { url: "https://www.chroniclebooks.com/cdn/shop/products/9781797212524.pt07_2048x2048.jpg?v=1631741690", label: "Publisher interior sample 2", kind: "Interior" }],
    tags: ["Children", "Bold color", "Character expression"], description: "A playful children’s retelling with expressive characters. Useful for family editions; its informal tone is a deliberate choice.", evidence: "Publisher previews for the 2021 board-book edition, not the earlier hardcover.", rights: publisherRights,
    direction: { typography: "Large, friendly, clearly separated text blocks; allow generous space around short passages.", palette: "Warm coral and saffron with deep teal anchors and light reading areas.", illustration: "Expressive original characters, clear silhouettes and confident color; maintain a respectful devotional tone chosen for the audience.", layout: "Alternate close character moments and expansive action. Keep each reading area simple and uncluttered." },
    palette: { ink: "#234e54", accent: "#cc633d", support: "#d3a437", paper: "#fff6e7" }, personaId: "folk-story-caravan", fontTheme: "Friendly Rounded", pageAesthetic: "Playful Panels", bookBorder: "No Border",
  },
  {
    id: "penn-bhagavadgita", title: "Bhagavadgītā", creators: "Sanskrit manuscript · University of Pennsylvania Libraries", publisher: "Kislak Center / OPenn", edition: "Ms. Coll. 390 Item 551 · 45 leaves",
    category: "Historical manuscripts", sourceUrl: "https://openn.library.upenn.edu/Data/0002/html/mscoll390_item551.html",
    images: [{ url: "https://openn.library.upenn.edu/Data/0002/mscoll390_item551/data/web/5791_0001_web.jpg", label: "Folios 1v–2r, photographed vertically", kind: "Manuscript" }, { url: "https://openn.library.upenn.edu/Data/0002/mscoll390_item551/data/web/5791_0004_web.jpg", label: "Folios 2v–3r of main text", kind: "Manuscript" }],
    tags: ["Devanagari", "Scripture", "Text-led"], description: "An original manuscript used for recitation and prayer. A historical reference for text-block proportion and margins, rather than modern illustration.", evidence: "Digitized manuscript leaves. These photographs are not modern facing-page layouts.", rights: "OPenn marks the images public domain; catalogue metadata is CC BY 4.0. Credit University of Pennsylvania Libraries, Ms. Coll. 390 Item 551.",
    direction: { typography: "Preserve Devanagari characters, verse boundaries and accent marks. Use generous margins and readable modern type rather than distressed lettering.", palette: "Warm ivory paper, near-black ink and selective vermilion emphasis.", illustration: "Use restrained, context-specific vignettes only where useful; let the original verses lead the design.", layout: "Keep verses intact, separate explanations from scripture, and use spacious text-led pages with quiet section openings." },
    palette: { ink: "#353126", accent: "#9d4433", support: "#b39966", paper: "#fbf5e6" }, personaId: "wisdom-and-ideas", fontTheme: "Storybook Serif", pageAesthetic: "Calm Editorial", bookBorder: "No Border",
  },
];

export function inspirationBook(id?: string) { return inspirationBooks.find(book => book.id === id); }

export function normalizeInspiration(value: unknown): BookInspiration {
  const result: BookInspiration = { version: 1, references: {}, notes: "" };
  if (!value || typeof value !== "object") return result;
  const input = value as { references?: Record<string, unknown>; notes?: unknown };
  for (const aspect of inspirationAspects) {
    const id = input.references?.[aspect];
    if (typeof id === "string" && inspirationBook(id)) result.references[aspect] = id;
  }
  if (typeof input.notes === "string") result.notes = input.notes.slice(0, 2000);
  return result;
}

export function inspirationBrief(value: unknown): string {
  const selection = normalizeInspiration(value);
  const lines = inspirationAspects.flatMap(aspect => {
    const book = inspirationBook(selection.references[aspect]);
    return book ? [`${aspect.toUpperCase()} — inspired by ${book.title} (${book.publisher})\n${book.direction[aspect]}\nReference: ${book.sourceUrl}`] : [];
  });
  if (!lines.length) return "";
  return `BOOK DESIGN REFERENCES\nThese are visual references, not textual authorities or assets to reproduce. Compose original pages for this manuscript. Preserve approved scripture exactly and typeset it separately from artwork.\n\n${lines.join("\n\n")}\n\nVARIATION\nKeep character attributes and typography consistent. Vary image scale, framing, text position and visual density to serve each passage; do not repeat a template mechanically.${selection.notes ? `\n\nPUBLISHER NOTES (design preferences only)\n${selection.notes}` : ""}`;
}

export function applyInspiration(current: BookPersona, value: unknown) {
  const selection = normalizeInspiration(value);
  const type = inspirationBook(selection.references.typography);
  const color = inspirationBook(selection.references.palette);
  const art = inspirationBook(selection.references.illustration);
  const layout = inspirationBook(selection.references.layout);
  const persona: BookPersona = { ...current,
    ...(type ? { fontTheme: type.fontTheme } : {}),
    ...(color ? { palette: { ...color.palette } } : {}),
    ...(art ? { illustrationStyle: art.direction.illustration } : {}),
    ...(layout ? { id: layout.personaId, pageAesthetic: layout.pageAesthetic, bookBorder: layout.bookBorder, pageWatermark: "No Watermark" } : {}),
    autoSelected: false,
    rationale: "Chosen from real book references by the publisher.",
  };
  return { ...bookPersonaPatch(persona), inspiration: selection };
}

export function inspirationPaletteStyle(persona: BookPersona) {
  const color = (value: string, fallback: string) => /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  return { "--persona-ink": color(persona.palette.ink, "#263631"), "--persona-accent": color(persona.palette.accent, "#b78d36"), "--persona-support": color(persona.palette.support, "#7b907b"), "--persona-paper": color(persona.palette.paper, "#f5f0df") };
}
