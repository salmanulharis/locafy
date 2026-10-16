import { describe, expect, it } from "vitest";
import { buildTsQuery, normaliseQuery, tokenize, type SynonymMap } from "@/modules/search/query";

/** Characters to_tsquery would interpret; only our own operators may appear. */
const SAFE_TSQUERY = /^[a-z0-9:*&|()<\-> ]+$/;

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumerics", () => {
    expect(tokenize("Samsung Galaxy-A55 5G!")).toEqual(["samsung", "galaxy", "a55", "5g"]);
  });

  it("strips accents", () => {
    expect(tokenize("Café Crème")).toEqual(["cafe", "creme"]);
  });

  it("strips tsquery operators and quotes", () => {
    expect(tokenize("a'&|!:()b")).toEqual(["a", "b"]);
    expect(tokenize(`"drop table";--`)).toEqual(["drop", "table"]);
    expect(tokenize("<-> \\ * ~")).toEqual([]);
  });

  it("caps the number of tokens", () => {
    expect(tokenize("a b c d e f g h i j k")).toHaveLength(8);
  });

  it("empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("buildTsQuery", () => {
  const synonyms: SynonymMap = new Map([
    ["earphones", ["headphones", "earbuds", "headset"]],
    ["ac", ["air conditioner"]],
    ["slippers", ["flip-flops", "chappals"]],
  ]);

  it("ANDs tokens and makes the last one a prefix", () => {
    expect(buildTsQuery("samsung galaxy")).toBe("samsung & galaxy:*");
    expect(buildTsQuery("samsu")).toBe("samsu:*");
  });

  it("does not prefix a single-character final token", () => {
    expect(buildTsQuery("redmi 9 x")).toBe("redmi & 9 & x");
  });

  it("drops stopwords and returns null when nothing is left", () => {
    expect(buildTsQuery("buy the phone near me")).toBe("phone:*");
    expect(buildTsQuery("the for me")).toBeNull();
    expect(buildTsQuery("")).toBeNull();
    expect(buildTsQuery("!!! ???")).toBeNull();
  });

  it("expands single-word synonyms with OR", () => {
    expect(buildTsQuery("earphones", synonyms)).toBe("(earphones:* | headphones | earbuds | headset)");
    expect(buildTsQuery("boat earphones", synonyms)).toBe("boat & (earphones:* | headphones | earbuds | headset)");
  });

  it("expands phrase synonyms as adjacency", () => {
    expect(buildTsQuery("ac", synonyms)).toBe("(ac:* | (air <-> conditioner))");
    expect(buildTsQuery("slippers men", synonyms)).toBe("(slippers | (flip <-> flops) | chappals) & men:*");
  });

  it("supports an OR joiner for relaxed matching", () => {
    expect(buildTsQuery("red phone", new Map(), "or")).toBe("red | phone:*");
  });

  it("neutralises injection characters", () => {
    const q = buildTsQuery("samsung' & !foo:( | bar)", synonyms);
    expect(q).toBe("samsung & foo & bar:*");
    for (const input of ["'&|!:()", "a:*b", "x)|(y", "' OR 1=1 --", "\\'; select pg_sleep(1);"]) {
      const out = buildTsQuery(input, synonyms);
      if (out !== null) expect(out).toMatch(SAFE_TSQUERY);
    }
  });

  it("synonym text is sanitised too", () => {
    const evil: SynonymMap = new Map([["tv", ["tele'vision", "a&b"]]]);
    const out = buildTsQuery("tv", evil)!;
    expect(out).toMatch(SAFE_TSQUERY);
    expect(out).toBe("(tv:* | (tele <-> vision) | (a <-> b))");
  });
});

describe("normaliseQuery", () => {
  it("collapses whitespace, trims and caps length", () => {
    expect(normaliseQuery("  samsung   galaxy \n a55 ")).toBe("samsung galaxy a55");
    expect(normaliseQuery(null)).toBe("");
    expect(normaliseQuery(undefined)).toBe("");
    expect(normaliseQuery("x".repeat(500))).toHaveLength(120);
  });
});
