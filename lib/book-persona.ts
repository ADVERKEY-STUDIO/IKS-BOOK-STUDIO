export type BookPersonaId =
  | "court-of-decisions"
  | "theatre-of-feelings"
  | "discovery-fieldbook"
  | "living-history-chronicle"
  | "wisdom-and-ideas"
  | "folk-story-caravan"
  | "makers-workshop";

export type BookPersona = {
  id: BookPersonaId;
  name: string;
  family: string;
  tagline: string;
  description: string;
  rationale: string;
  palette: { ink: string; accent: string; support: string; paper: string };
  aesthetic: string;
  pageAesthetic: string;
  bookBorder: string;
  pageWatermark: string;
  fontTheme: string;
  illustrationStyle: string;
  coverStyle: string;
  motif: string;
  mood: string;
  sectionLabels: [string, string, string];
  activityLabel: string;
  activityPrompt: string;
  signature: string;
  autoSelected: boolean;
  version: number;
};

export const BOOK_PERSONA_VERSION = 1;

type PersonaDefinition = Omit<BookPersona, "rationale" | "autoSelected" | "version"> & { keywords: string[] };

export const bookPersonaDefinitions: PersonaDefinition[] = [
  { id: "court-of-decisions", name: "Court of Decisions", family: "Civic strategy", tagline: "Enter the council. Weigh the evidence. Choose wisely.", description: "An immersive civic world for governance, economics, diplomacy and leadership.", palette: { ink: "#172c46", accent: "#bd5c3a", support: "#c99a3d", paper: "#f7edda" }, aesthetic: "Young Scholar", pageAesthetic: "Calm Editorial", bookBorder: "Golden Lines", pageWatermark: "Sun Mandala", fontTheme: "Storybook Serif", illustrationStyle: "Historically grounded council-scene gouache with tactile civic objects", coverStyle: "Asymmetric council dossier", motif: "seal and decision lines", mood: "measured, strategic, responsible", sectionLabels: ["Enter the council", "Weigh the evidence", "Make the decision"], activityLabel: "THINK LIKE AN ADVISER", activityPrompt: "Compare the choices, cite one fact, and explain the wisest next step.", signature: "indigo-council-dossier", keywords: ["governance", "statecraft", "king", "minister", "council", "administration", "economy", "trade", "diplomacy", "strategy", "leadership", "policy", "welfare", "arthaśāstra", "arthashastra"] },
  { id: "theatre-of-feelings", name: "Theatre of Feelings", family: "Performance and aesthetics", tagline: "See the gesture. Feel the moment. Discover the rasa.", description: "A jewel-toned performance world for rasa, drama, poetry, dance and aesthetics.", palette: { ink: "#542345", accent: "#d27a32", support: "#b74e5b", paper: "#fff3df" }, aesthetic: "Storybook India", pageAesthetic: "Heritage Frame", bookBorder: "Lotus Arch", pageWatermark: "Lotus Seal", fontTheme: "Storybook Serif", illustrationStyle: "Expressive Indian performance watercolour with gesture, rhythm and emotional light", coverStyle: "Layered theatrical proscenium", motif: "curtain arcs and expressive petals", mood: "expressive, lyrical, attentive", sectionLabels: ["Feel the scene", "Notice the expression", "Share the rasa"], activityLabel: "STAGE THE FEELING", activityPrompt: "Use gesture, voice or a short scene to show how the chapter’s central feeling becomes visible.", signature: "plum-theatre-proscenium", keywords: ["rasa", "bhava", "aesthetic", "drama", "theatre", "dance", "performance", "poetry", "poetic", "emotion", "natyashastra", "nāṭya"] },
  { id: "discovery-fieldbook", name: "Discovery Fieldbook", family: "Science and nature", tagline: "Observe closely. Test the idea. Record what changes.", description: "A bright field-journal system for science, nature, medicine, mathematics and discovery.", palette: { ink: "#123f5b", accent: "#ef7c3d", support: "#2e9b89", paper: "#f3f7e9" }, aesthetic: "Bright Explorer", pageAesthetic: "Playful Panels", bookBorder: "No Border", pageWatermark: "Knowledge Tree", fontTheme: "Clear Reader", illustrationStyle: "Observational field-journal gouache with real tools, specimens and visible evidence", coverStyle: "Layered field notes and specimen windows", motif: "observation marks and specimen tabs", mood: "curious, precise, energetic", sectionLabels: ["Observe", "Test the idea", "What changed?"], activityLabel: "TRY THE INVESTIGATION", activityPrompt: "Make an observation, test one prediction, and record what the evidence shows.", signature: "cobalt-field-journal", keywords: ["science", "nature", "plant", "animal", "medicine", "body", "space", "planet", "mathematics", "astronomy", "energy", "river", "environment", "ecology"] },
  { id: "living-history-chronicle", name: "Living History Chronicle", family: "History and heritage", tagline: "Step into the time. Meet the people. Follow the change.", description: "A museum-like chronicle for history, civilisation, biography and cultural heritage.", palette: { ink: "#3b2e2b", accent: "#a94d2d", support: "#496a78", paper: "#f4e6ce" }, aesthetic: "Young Scholar", pageAesthetic: "Heritage Frame", bookBorder: "Golden Lines", pageWatermark: "Sun Mandala", fontTheme: "Storybook Serif", illustrationStyle: "Historically researched narrative reportage in layered watercolour and ink", coverStyle: "Museum chronicle with archival label", motif: "archive stamps and passage bands", mood: "grounded, humane, transportive", sectionLabels: ["Step into the time", "Meet the people", "Follow the change"], activityLabel: "READ THE PAST", activityPrompt: "Use two details from the chapter to explain how life, choices or ideas changed over time.", signature: "sepia-museum-chronicle", keywords: ["history", "historical", "ancient", "civilisation", "civilization", "empire", "heritage", "dynasty", "period", "century", "archaeology", "biography", "tradition"] },
  { id: "wisdom-and-ideas", name: "Wisdom & Ideas Atelier", family: "Philosophy and ethics", tagline: "Begin with a question. Connect the idea. Think it through.", description: "A quiet, spacious atelier for philosophy, ethics, spirituality and systems of knowledge.", palette: { ink: "#263631", accent: "#b78d36", support: "#7b907b", paper: "#f5f0df" }, aesthetic: "Young Scholar", pageAesthetic: "Calm Editorial", bookBorder: "No Border", pageWatermark: "Lotus Seal", fontTheme: "Clear Reader", illustrationStyle: "Contemplative editorial scenes with quiet symbolism, natural materials and human scale", coverStyle: "Minimal contemplative field", motif: "question mark, thread and open circle", mood: "reflective, clear, spacious", sectionLabels: ["Begin with a question", "Connect the idea", "Think it through"], activityLabel: "PAUSE AND REFLECT", activityPrompt: "Choose one idea, connect it to a real situation, and explain what question remains.", signature: "sage-contemplative-atelier", keywords: ["philosophy", "ethics", "dharma", "wisdom", "knowledge", "spiritual", "consciousness", "self", "truth", "meaning", "idea", "theory", "metaphysics"] },
  { id: "folk-story-caravan", name: "Folk Story Caravan", family: "Stories and folklore", tagline: "Meet the characters. Follow the turning point. Carry the story.", description: "A bold travelling-story world for folklore, mythology, legends and narrative adaptations.", palette: { ink: "#173d42", accent: "#c94732", support: "#e0a52f", paper: "#fff0cd" }, aesthetic: "Storybook India", pageAesthetic: "Playful Panels", bookBorder: "Folk Geometry", pageWatermark: "Lotus Seal", fontTheme: "Friendly Rounded", illustrationStyle: "Bold folk-inspired narrative painting with patterned edges and expressive characters", coverStyle: "Colour-blocked travelling theatre", motif: "folk geometry and story banners", mood: "warm, dramatic, communal", sectionLabels: ["Once in this place", "What changed?", "Carry the story"], activityLabel: "TELL IT YOUR WAY", activityPrompt: "Retell the turning point using a different voice, object or point of view while keeping the meaning.", signature: "crimson-folk-caravan", keywords: ["story", "stories", "tale", "folklore", "folk", "myth", "mythology", "legend", "epic", "character", "narrative", "fable"] },
  { id: "makers-workshop", name: "Maker’s Workshop", family: "Art, craft and design", tagline: "Meet the maker. Watch the process. Try the technique.", description: "A tactile studio for art, craft, architecture, music, making and design processes.", palette: { ink: "#294151", accent: "#c46834", support: "#d5a735", paper: "#f7ead5" }, aesthetic: "Bright Explorer", pageAesthetic: "Heritage Frame", bookBorder: "Folk Geometry", pageWatermark: "Knowledge Tree", fontTheme: "Friendly Rounded", illustrationStyle: "Tactile workshop illustration with materials, tools, hands and process-rich action", coverStyle: "Workshop bench with modular bands", motif: "tools, joints and material swatches", mood: "hands-on, inventive, generous", sectionLabels: ["Meet the maker", "Watch the process", "Try the technique"], activityLabel: "MAKE AND NOTICE", activityPrompt: "Try one small part of the process, then explain how the material or technique changed the result.", signature: "ochre-makers-workshop", keywords: ["art", "craft", "architecture", "music", "design", "maker", "material", "technique", "sculpture", "painting", "weaving", "building", "workshop"] },
];

export function personaById(id?: string) {
  return bookPersonaDefinitions.find((persona) => persona.id === id) ?? bookPersonaDefinitions[4];
}

export function materializePersona(definition: PersonaDefinition, rationale: string, autoSelected = true): BookPersona {
  const { keywords: _keywords, ...persona } = definition;
  void _keywords;
  return { ...persona, rationale, autoSelected, version: BOOK_PERSONA_VERSION };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return Math.abs(hash >>> 0);
}

export function inferBookPersona(input: { title?: string; sourcePreview?: string; sourceTerms?: string[]; sourceHeadings?: string[]; bookType?: string }, avoidSignatures: string[] = []) {
  const terms = (input.sourceTerms ?? []).join(" ").toLowerCase();
  const headings = (input.sourceHeadings ?? []).join(" ").toLowerCase();
  const general = `${input.title ?? ""} ${input.sourcePreview ?? ""} ${input.bookType ?? ""}`.toLowerCase();
  const scored = bookPersonaDefinitions.map((definition) => {
    const matched = definition.keywords.filter((keyword) => terms.includes(keyword) || headings.includes(keyword) || general.includes(keyword));
    const score = definition.keywords.reduce((sum, keyword) => sum + (terms.includes(keyword) ? 5 : 0) + (headings.includes(keyword) ? 3 : 0) + (general.includes(keyword) ? 1 : 0), 0);
    return { definition, score, matched };
  }).sort((a, b) => b.score - a.score);
  let selected = scored[0];
  if (!selected.score) selected = scored[stableHash(`${input.title}|${input.sourcePreview}`) % scored.length];
  if (avoidSignatures.includes(selected.definition.signature)) {
    const alternative = scored.find((candidate) => candidate.definition.signature !== selected.definition.signature && candidate.score >= Math.max(1, selected.score * .55));
    if (alternative) selected = alternative;
  }
  const rationale = selected.matched.length
    ? `Chosen from this source’s emphasis on ${selected.matched.slice(0, 4).join(", ")}.`
    : "Chosen as a distinct visual direction from the source title and subject fingerprint.";
  return materializePersona(selected.definition, rationale, true);
}

export function bookPersonaPatch(persona: BookPersona) {
  return { bookPersona: persona, aesthetic: persona.aesthetic, pageAesthetic: persona.pageAesthetic, bookBorder: persona.bookBorder, pageWatermark: persona.pageWatermark, fontTheme: persona.fontTheme, illustrationStyle: persona.illustrationStyle };
}

export function bookPersonaClass(persona?: Pick<BookPersona, "id">) {
  return `book-persona-${persona?.id ?? "wisdom-and-ideas"}`;
}

export function bookPersonaPrompt(persona?: BookPersona) {
  if (!persona) return "";
  return `BOOK IDENTITY: ${persona.name} (${persona.family}). Mood: ${persona.mood}. Section language should feel compatible with “${persona.sectionLabels.join("”, “")}”. Use the purposeful activity title “${persona.activityLabel}” and shape it around this intent: ${persona.activityPrompt}. Preserve factual and pedagogical requirements; identity changes presentation and voice, never truth.`;
}
