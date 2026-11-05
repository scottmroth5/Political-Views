import { describe, expect, it } from "vitest";
import {
  applyBeliefPatch,
  beliefPatchSchema,
  type BeliefValues,
} from "@/domain/beliefs/belief-schema";
import type { BeliefDto } from "@/domain/beliefs/belief-service";
import {
  isSourceChanged,
  planGuidedBeliefs,
  type DerivedBeliefState,
} from "@/domain/beliefs/guided-derivation";
import { DomainError } from "@/domain/errors";
import { buildProfile } from "@/domain/profiles/profile-builder";

const choices = [
  { value: "a", label: "Choice A" },
  { value: "b", label: "Choice B" },
  { value: "c", label: "Choice C" },
];
const answered = (choiceValues: string[], importance: number | null = null) => ({
  outcome: "ANSWERED" as const,
  choiceValues,
  importance,
});
const belief = (over: Partial<DerivedBeliefState>): DerivedBeliefState => ({
  id: over.choiceValue ?? "x",
  status: "SUGGESTED",
  choiceValue: "a",
  position: "Choice A",
  importance: null,
  ...over,
});

describe("planGuidedBeliefs", () => {
  it("suggests one belief per selected choice, worded exactly as the choice", () => {
    expect(planGuidedBeliefs(answered(["a", "c"], 4), choices, [])).toEqual({
      create: [
        { choiceValue: "a", position: "Choice A", importance: 4 },
        { choiceValue: "c", position: "Choice C", importance: 4 },
      ],
      update: [],
      remove: [],
    });
  });

  it("suggests nothing for skips and 'not sure'", () => {
    for (const outcome of ["SKIPPED", "UNSURE"] as const) {
      expect(planGuidedBeliefs({ outcome, choiceValues: [], importance: 3 }, choices, [])).toEqual({
        create: [],
        update: [],
        remove: [],
      });
    }
  });

  it("removes suggestions for choices no longer selected and adds new ones", () => {
    const plan = planGuidedBeliefs(answered(["b"]), choices, [belief({ choiceValue: "a" })]);
    expect(plan.remove).toEqual(["a"]);
    expect(plan.create.map((c) => c.choiceValue)).toEqual(["b"]);
  });

  it("re-rates and rewords suggestions to follow the answer and the question's wording", () => {
    const plan = planGuidedBeliefs(
      answered(["a"], 5),
      [{ value: "a", label: "Reworded A" }],
      [belief({ choiceValue: "a", importance: 2 })],
    );
    expect(plan.update).toEqual([{ id: "a", position: "Reworded A", importance: 5 }]);
    expect(plan.create).toEqual([]);
  });

  it("never changes, removes or duplicates confirmed or rejected beliefs", () => {
    const existing = [
      belief({ id: "conf", choiceValue: "a", status: "CONFIRMED", position: "My own words" }),
      belief({ id: "rej", choiceValue: "b", status: "REJECTED", importance: 1 }),
    ];
    // Answer changed away from both, then back to both: no plan touches them either way.
    expect(planGuidedBeliefs(answered(["c"], 3), choices, existing)).toEqual({
      create: [{ choiceValue: "c", position: "Choice C", importance: 3 }],
      update: [],
      remove: [],
    });
    expect(planGuidedBeliefs(answered(["a", "b"], 3), choices, existing)).toEqual({
      create: [],
      update: [],
      remove: [],
    });
  });

  it("ignores selected values that are not choices of the question", () => {
    expect(planGuidedBeliefs(answered(["zzz"]), choices, []).create).toEqual([]);
  });
});

describe("isSourceChanged", () => {
  const confirmed = { status: "CONFIRMED" as const, choiceValue: "a" };
  it("flags a confirmed belief whose choice left the answer", () => {
    expect(isSourceChanged(confirmed, answered(["a"]))).toBe(false);
    expect(isSourceChanged(confirmed, answered(["b"]))).toBe(true);
    expect(isSourceChanged(confirmed, { outcome: "UNSURE", choiceValues: [] })).toBe(true);
  });
  it("does not flag suggestions or beliefs without a guided choice", () => {
    expect(isSourceChanged({ status: "SUGGESTED", choiceValue: "a" }, answered(["b"]))).toBe(false);
    expect(isSourceChanged({ status: "CONFIRMED", choiceValue: null }, null)).toBe(false);
  });
});

describe("belief changes by the user", () => {
  const suggested: BeliefValues = {
    status: "SUGGESTED",
    position: "Choice A",
    nuance: null,
    importance: 3,
    conviction: null,
  };
  const parse = (body: unknown) => beliefPatchSchema.parse(body);

  it("confirms and rejects", () => {
    expect(applyBeliefPatch(suggested, parse({ version: 1, status: "CONFIRMED" }))?.status).toBe(
      "CONFIRMED",
    );
    expect(applyBeliefPatch(suggested, parse({ version: 1, status: "REJECTED" }))?.status).toBe(
      "REJECTED",
    );
  });

  it("rewording confirms the belief and blank nuance clears it", () => {
    const next = applyBeliefPatch(
      { ...suggested, nuance: "old" },
      parse({ version: 1, position: "  In my words  ", nuance: "   " }),
    );
    expect(next).toEqual({
      ...suggested,
      status: "CONFIRMED",
      position: "In my words",
      nuance: null,
    });
  });

  it("requires a confirmed belief for importance and conviction ratings", () => {
    expect(() => applyBeliefPatch(suggested, parse({ version: 1, conviction: 4 }))).toThrow(
      DomainError,
    );
    const confirmed = { ...suggested, status: "CONFIRMED" as const };
    expect(applyBeliefPatch(confirmed, parse({ version: 1, conviction: 4 }))?.conviction).toBe(4);
    expect(applyBeliefPatch(confirmed, parse({ version: 1, importance: null }))?.importance).toBe(
      null,
    );
    // Confirming and rating in one request is fine.
    expect(
      applyBeliefPatch(suggested, parse({ version: 1, status: "CONFIRMED", importance: 5 })),
    ).toMatchObject({ status: "CONFIRMED", importance: 5 });
  });

  it("returns null when nothing would change", () => {
    expect(applyBeliefPatch(suggested, parse({ version: 1, position: "Choice A" }))).toEqual({
      ...suggested,
      status: "CONFIRMED",
    });
    const confirmed = { ...suggested, status: "CONFIRMED" as const };
    expect(applyBeliefPatch(confirmed, parse({ version: 1, status: "CONFIRMED" }))).toBeNull();
  });

  it("validates the request body", () => {
    expect(beliefPatchSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(beliefPatchSchema.safeParse({ version: 1, status: "SUGGESTED" }).success).toBe(false);
    expect(beliefPatchSchema.safeParse({ version: 1, importance: 6 }).success).toBe(false);
    expect(beliefPatchSchema.safeParse({ version: 1, position: "   " }).success).toBe(false);
    expect(beliefPatchSchema.safeParse({ version: 1, position: "x".repeat(301) }).success).toBe(
      false,
    );
    expect(
      beliefPatchSchema.safeParse({ version: 1, extra: true, status: "REJECTED" }).success,
    ).toBe(false);
  });
});

describe("buildProfile", () => {
  const dto = (over: Partial<BeliefDto> & { categoryId: string | null }) => ({
    id: "b",
    version: 1,
    status: "SUGGESTED" as const,
    position: "p",
    nuance: null,
    importance: null,
    conviction: null,
    topic: null,
    source: null,
    sourceChanged: false,
    ...over,
  });
  const categories = [
    { id: "c2", slug: "two", label: "Two", order: 2, questionsTotal: 3, questionsAnswered: 0 },
    { id: "c1", slug: "one", label: "One", order: 1, questionsTotal: 3, questionsAnswered: 2 },
  ];

  it("keeps confirmed, suggested and rejected beliefs apart and lists coverage gaps", () => {
    const profile = buildProfile(categories, [
      dto({ id: "s", categoryId: "c1" }),
      dto({ id: "k", status: "CONFIRMED", categoryId: "c1", sourceChanged: true }),
      dto({ id: "r", status: "REJECTED", categoryId: "c1" }),
      dto({ id: "o", categoryId: null }),
    ]);
    expect(profile.categories.map((c) => c.slug)).toEqual(["one", "two", "other"]);
    expect(profile.categories[0]!.confirmed.map((b) => b.id)).toEqual(["k"]);
    expect(profile.categories[0]!.suggested.map((b) => b.id)).toEqual(["s"]);
    expect(profile.rejected.map((b) => b.id)).toEqual(["r"]);
    expect(profile.counts).toEqual({ confirmed: 1, suggested: 2, rejected: 1, needsReview: 1 });
    expect(profile.gaps).toEqual([{ slug: "two", label: "Two" }]);
    expect(profile.preliminary).toBe(true);
    expect(profile.categories[0]!.confirmed[0]).not.toHaveProperty("categoryId");
  });

  it("is ready for preview only after enough answered questions", () => {
    expect(buildProfile(categories, []).ready).toBe(false); // 2 answered
    const more = [
      ...categories,
      { ...categories[0]!, id: "c3", slug: "three", questionsAnswered: 1 },
    ];
    expect(buildProfile(more, []).ready).toBe(true); // 3 answered
    // A confirmed belief keeps the profile visible even if answers later drop below the threshold.
    expect(buildProfile(categories, [dto({ status: "CONFIRMED", categoryId: "c1" })]).ready).toBe(
      true,
    );
  });
});
