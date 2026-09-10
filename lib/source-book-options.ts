export const sourceImageModes = [
  { value: "source-first", label: "Prefer source-book images; generate only when missing" },
  { value: "generate", label: "Generate new illustrations" },
  { value: "reuse", label: "Reuse source-book images" },
  { value: "hybrid", label: "Mix source images and new illustrations" },
] as const;
export const imageEnhancements = [
  { value: "original", label: "Keep originals unchanged" },
  { value: "clean", label: "Clean and upscale" },
  { value: "restyle", label: "Clean and adapt source images to the book’s style" },
] as const;
export const sourceImageStyles = [
  { value: "book", label: "Use the book’s visual style" },
  { value: "watercolour", label: "Watercolour" },
  { value: "ink", label: "Ink drawing" },
  { value: "miniature", label: "Miniature-inspired art" },
  { value: "realistic", label: "Realistic painting" },
  { value: "collage", label: "Collage" },
  { value: "custom", label: "Custom style" },
] as const;
export type SourceImageStyle = typeof sourceImageStyles[number]["value"];
export type SourceBookOptions = {
  imageMode: typeof sourceImageModes[number]["value"];
  enhancement: typeof imageEnhancements[number]["value"];
  imageStyle: SourceImageStyle;
  customStyle: string;
  preserveSlokas: boolean;
  transliteration: boolean;
  translation: boolean;
  explanation: boolean;
  chapterStyles: Record<string, Exclude<SourceImageStyle, "book">>;
};

/** Old books retain their current generation behaviour until the publisher opts in. */
export function normalizeSourceBookOptions(value?: Partial<SourceBookOptions> | null): SourceBookOptions {
  const member = <T extends string>(input: unknown, choices: readonly {value:T}[], fallback:T):T => choices.some(c=>c.value===input) ? input as T : fallback;
  const chapterStyles: SourceBookOptions["chapterStyles"] = {};
  for (const [id, style] of Object.entries(value?.chapterStyles ?? {})) {
    const safe = member(style, sourceImageStyles, "book");
    if (/^\d+$/.test(id) && safe !== "book") chapterStyles[id] = safe;
  }
  return {
    imageMode: member(value?.imageMode, sourceImageModes, "generate"),
    enhancement: member(value?.enhancement, imageEnhancements, "original"),
    imageStyle: member(value?.imageStyle, sourceImageStyles, "book"),
    customStyle: typeof value?.customStyle === "string" ? value.customStyle.slice(0,600) : "",
    preserveSlokas: value?.preserveSlokas === true,
    transliteration: value?.transliteration === true,
    translation: value?.translation !== false,
    explanation: value?.explanation !== false,
    chapterStyles,
  };
}
