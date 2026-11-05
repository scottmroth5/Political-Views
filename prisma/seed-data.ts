/**
 * Seed taxonomy (PRD §5): 12 categories, 2 foundational questions each.
 *
 * STARTING SET ONLY: seeding inserts these as DRAFT questions when their slug is
 * missing, and never changes them afterwards. Questions are then managed (added,
 * reviewed, copied, archived) in the admin pages; see docs/editorial-review.md.
 *
 * EDITORIAL STATUS: every question starts as DRAFT. Wording was drafted to be neutral,
 * non-leading and to span a range of reasonable positions, but it MUST be
 * reviewed by a human editor (ideally a politically diverse panel) before beta.
 * Mark reviewed questions in /admin; production shows only REVIEWED questions.
 *
 * "Not sure" and "skip" are always offered by the UI, so they are not choices.
 * Choice order is not intended to imply a ranking; review this during editorial pass.
 */
export interface SeedChoice {
  value: string;
  label: string;
  /** Multi-select only: cannot be combined with other choices. */
  exclusive?: true;
}

export interface SeedQuestion {
  slug: string;
  topic: { slug: string; label: string };
  prompt: string;
  explanationPrompt?: string;
  /**
   * true → MULTI_CHOICE ("select all that apply"). Use it for "which approaches"
   * questions where combinations are coherent; keep single choice when the
   * choices are points on one scale (e.g. increase / keep / decrease).
   */
  multiple?: true;
  choices: SeedChoice[];
}

export interface SeedCategory {
  slug: string;
  label: string;
  description: string;
  questions: SeedQuestion[];
}

const WHY = "Optional: in your own words, why do you feel this way?";

export const seedCategories: SeedCategory[] = [
  {
    slug: "healthcare",
    label: "Healthcare",
    description: "Health insurance, costs and access to care.",
    questions: [
      {
        slug: "healthcare-coverage-role",
        multiple: true,
        topic: { slug: "health-coverage", label: "Health coverage" },
        prompt: "What role should government play in providing health insurance coverage?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "single-payer",
            label: "Provide coverage for everyone through a single public plan",
          },
          {
            value: "public-option",
            label: "Offer a public plan that competes alongside private insurance",
          },
          {
            value: "targeted-help",
            label: "Help those who can't afford coverage, mainly through private plans",
          },
          {
            value: "private-market",
            label: "Leave coverage mainly to individuals, employers and the private market",
          },
        ],
      },
      {
        slug: "healthcare-drug-prices",
        multiple: true,
        topic: { slug: "drug-prices", label: "Prescription drug prices" },
        prompt: "How should prescription drug prices be handled?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "set-prices",
            label: "Government should negotiate or set prices for most drugs",
          },
          {
            value: "negotiate-some",
            label: "Government should negotiate prices for some drugs in public programs",
          },
          {
            value: "more-competition",
            label:
              "Lower prices mainly by increasing competition, such as faster generic approvals",
          },
          { value: "market-pricing", label: "Leave pricing to manufacturers and the market" },
        ],
      },
      {
        slug: "healthcare-school-vaccine-requirements",
        topic: { slug: "school-vaccines", label: "School vaccine requirements" },
        prompt: "Should children be required to receive recommended vaccines to attend school?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "required-medical-only",
            label: "Yes, with exemptions only for medical reasons",
          },
          {
            value: "required-broad-exemptions",
            label: "Yes, with medical, religious and personal-belief exemptions",
          },
          {
            value: "recommend-only",
            label: "No; recommend vaccines but leave the decision to families",
          },
          {
            value: "no-government-role",
            label: "No; government should neither require nor promote specific vaccines",
          },
        ],
      },
      {
        slug: "healthcare-emergency-vaccine-requirements",
        topic: { slug: "emergency-vaccines", label: "Vaccine requirements in emergencies" },
        prompt:
          "During a serious public health emergency, such as a pandemic, where would you support vaccine requirements?",
        explanationPrompt: WHY,
        multiple: true,
        choices: [
          { value: "health-workers", label: "Health care and long-term care workers" },
          { value: "government-workers", label: "Government employees and the military" },
          { value: "schools", label: "Students and staff in schools" },
          { value: "large-employers", label: "Employees of large private employers" },
          { value: "travel", label: "Air travel and other public transportation" },
          {
            value: "none",
            label: "Nowhere; vaccination should always be an individual choice",
            exclusive: true,
          },
        ],
      },
      {
        slug: "healthcare-abortion-legality",
        topic: { slug: "abortion-legality", label: "Abortion" },
        prompt: "Under what circumstances should abortion be legal?",
        explanationPrompt: WHY,
        choices: [
          { value: "legal-all", label: "Legal in all or nearly all cases" },
          { value: "legal-most", label: "Legal in most cases, with limits later in pregnancy" },
          {
            value: "illegal-most",
            label:
              "Illegal in most cases, with exceptions such as rape, incest or to save the woman's life",
          },
          { value: "illegal-all", label: "Illegal in all or nearly all cases" },
        ],
      },
      {
        slug: "healthcare-abortion-jurisdiction",
        topic: { slug: "abortion-jurisdiction", label: "Who sets abortion law" },
        prompt: "Who should set abortion laws?",
        explanationPrompt: WHY,
        choices: [
          { value: "federal-protect", label: "Federal law should protect access nationwide" },
          { value: "states", label: "Each state should decide" },
          { value: "federal-restrict", label: "Federal law should restrict abortion nationwide" },
        ],
      },
      {
        slug: "healthcare-abortion-public-funding",
        topic: { slug: "abortion-funding", label: "Public funding for abortion" },
        prompt: "Should public health programs, such as Medicaid, pay for abortions?",
        explanationPrompt: WHY,
        choices: [
          { value: "yes", label: "Yes, like other health services" },
          {
            value: "limited",
            label: "Only in cases of rape, incest or a threat to the woman's life",
          },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    slug: "economy-taxation",
    label: "Economy, Taxes & Budget",
    description: "Taxes, wages, federal spending and the national debt.",
    questions: [
      {
        slug: "economy-tax-distribution",
        topic: { slug: "tax-distribution", label: "Tax distribution" },
        prompt: "How should the overall tax burden be distributed?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "more-progressive",
            label: "Higher earners should pay a larger share than they do now",
          },
          { value: "about-right", label: "The current distribution is about right" },
          { value: "flatter", label: "Rates should be more similar across income levels" },
          {
            value: "lower-overall",
            label: "Taxes should be lower for everyone, with less government spending",
          },
        ],
      },
      {
        slug: "economy-minimum-wage",
        topic: { slug: "minimum-wage", label: "Minimum wage" },
        prompt: "What should happen to the federal minimum wage?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "raise-substantially",
            label: "Raise it substantially and adjust it automatically for inflation",
          },
          { value: "raise-modestly", label: "Raise it modestly" },
          {
            value: "keep-local",
            label: "Keep it as is and let states and cities set their own higher levels",
          },
          {
            value: "reduce-role",
            label: "Reduce or remove the federal minimum and let markets set wages",
          },
        ],
      },
      {
        slug: "economy-deficit-priority",
        topic: { slug: "deficit-debt", label: "Deficit and national debt" },
        prompt: "How much of a priority should reducing the federal deficit and national debt be?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "top-priority",
            label: "A top priority, even if it requires major spending cuts or tax increases",
          },
          { value: "important", label: "An important priority, balanced against other goals" },
          { value: "lower", label: "A lower priority than investing in other needs" },
          { value: "not-concern", label: "Not a significant concern right now" },
        ],
      },
      {
        slug: "economy-balanced-budget-requirement",
        topic: { slug: "balanced-budget", label: "Balanced budget requirement" },
        prompt:
          "Should the Constitution require the federal government to balance its budget each year?",
        explanationPrompt: WHY,
        choices: [
          { value: "yes", label: "Yes" },
          {
            value: "yes-with-exceptions",
            label: "Yes, with exceptions for emergencies such as wars or recessions",
          },
          { value: "no", label: "No" },
        ],
      },
      {
        slug: "economy-deficit-approaches",
        topic: { slug: "deficit-approaches", label: "Deficit reduction approaches" },
        prompt: "If the federal deficit were reduced, which approaches would you support?",
        explanationPrompt: WHY,
        multiple: true,
        choices: [
          { value: "cut-defense", label: "Cut defense spending" },
          { value: "cut-domestic", label: "Cut spending on domestic and social programs" },
          {
            value: "slow-entitlements",
            label: "Slow the growth of Social Security and Medicare benefits",
          },
          {
            value: "tax-high-earners",
            label: "Raise taxes on high earners and corporations",
          },
          { value: "tax-broadly", label: "Raise taxes more broadly" },
          {
            value: "rely-on-growth",
            label: "Rely mainly on economic growth rather than cuts or tax increases",
          },
        ],
      },
    ],
  },
  {
    slug: "education",
    label: "Education",
    description: "K-12 schooling and the cost of higher education.",
    questions: [
      {
        slug: "education-school-choice",
        topic: { slug: "school-choice", label: "School choice" },
        prompt: "Should public education funding follow students to schools their families choose?",
        explanationPrompt: WHY,
        choices: [
          { value: "all-schools", label: "Yes, including private and religious schools" },
          { value: "public-charter", label: "Yes, but only among public and charter schools" },
          { value: "limited", label: "Only in limited cases; focus on traditional public schools" },
          { value: "public-only", label: "No, public funds should go only to public schools" },
        ],
      },
      {
        slug: "education-college-costs",
        multiple: true,
        topic: { slug: "college-costs", label: "College costs" },
        prompt: "What should government do about the cost of college?",
        explanationPrompt: WHY,
        choices: [
          { value: "tuition-free", label: "Make public college tuition-free" },
          { value: "expand-aid", label: "Expand grants and income-based loan repayment" },
          {
            value: "cut-costs-alternatives",
            label: "Push colleges to cut costs and expand trade and vocational options",
          },
          {
            value: "reduce-federal-role",
            label: "Reduce the federal government's role in student lending",
          },
        ],
      },
    ],
  },
  {
    slug: "civil-rights-liberties",
    label: "Civil Rights & Liberties",
    description: "Speech, privacy, equal treatment and protection from discrimination.",
    questions: [
      {
        slug: "civil-liberties-content-moderation",
        multiple: true,
        topic: { slug: "online-speech", label: "Online speech" },
        prompt: "How should large online platforms handle content moderation?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "require-removal",
            label: "Be required to remove more harmful or false content",
          },
          {
            value: "own-rules-transparency",
            label: "Set their own rules, with legal transparency requirements",
          },
          { value: "limit-removal", label: "Be restricted from removing lawful speech" },
          {
            value: "no-government-role",
            label: "Government should stay out of platform moderation entirely",
          },
        ],
      },
      {
        slug: "civil-liberties-surveillance",
        topic: { slug: "surveillance-privacy", label: "Surveillance and privacy" },
        prompt: "How should government balance surveillance for security against personal privacy?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "strict-limits",
            label:
              "Strictly limit surveillance and require warrants for nearly all data collection",
          },
          { value: "court-oversight", label: "Allow surveillance with strong court oversight" },
          { value: "current-balance", label: "The current balance is about right" },
          {
            value: "broad-authority",
            label: "Give agencies broad authority when security threats are serious",
          },
        ],
      },
      {
        slug: "civil-rights-lgbtq-discrimination",
        topic: { slug: "lgbtq-protections", label: "LGBTQ discrimination protections" },
        prompt:
          "How should the law address discrimination based on sexual orientation or gender identity?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "broad-federal",
            label:
              "Broad federal protections in employment, housing, public services and businesses",
          },
          {
            value: "with-religious-exemptions",
            label: "Federal protections, with exemptions for religious organizations and objectors",
          },
          { value: "state-local", label: "Leave it mainly to states and local governments" },
          {
            value: "no-new-protections",
            label: "Existing laws are sufficient; no new protections",
          },
        ],
      },
      {
        slug: "civil-rights-same-sex-marriage",
        topic: { slug: "same-sex-marriage", label: "Same-sex marriage" },
        prompt: "How should same-sex marriage be treated under the law?",
        explanationPrompt: WHY,
        choices: [
          { value: "protected-nationally", label: "Legally recognized and protected nationwide" },
          { value: "states-decide", label: "Each state should decide" },
          { value: "not-recognized", label: "Not legally recognized as marriage" },
        ],
      },
      {
        slug: "civil-rights-equality-goal",
        topic: { slug: "equality-equity", label: "Equal treatment and equal outcomes" },
        prompt: "Which goal should guide civil rights policy?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "equal-treatment",
            label:
              "Treating everyone the same under the law, regardless of group differences in outcomes",
          },
          {
            value: "both",
            label: "Equal treatment, plus some targeted efforts to narrow gaps between groups",
          },
          {
            value: "close-gaps",
            label:
              "Actively closing gaps in outcomes between groups, such as in income, health and wealth",
          },
        ],
      },
      {
        slug: "civil-rights-racial-disparities",
        topic: { slug: "racial-disparities", label: "Racial disparities" },
        prompt:
          "What should government do about racial disparities in areas such as income, housing and health?",
        explanationPrompt: WHY,
        multiple: true,
        choices: [
          {
            value: "targeted-investment",
            label: "Fund targeted programs for communities affected by past discrimination",
          },
          {
            value: "enforce-anti-discrimination",
            label: "Strengthen enforcement of anti-discrimination laws",
          },
          {
            value: "race-neutral-need",
            label: "Use race-neutral programs based on income or need",
          },
          {
            value: "no-special-action",
            label: "Government should not take special action on racial disparities",
            exclusive: true,
          },
        ],
      },
      {
        slug: "civil-rights-race-in-decisions",
        topic: { slug: "race-conscious-policies", label: "Race in admissions and hiring" },
        prompt: "Should race be considered in college admissions or hiring decisions?",
        explanationPrompt: WHY,
        choices: [
          { value: "one-factor", label: "Yes, as one factor among many" },
          {
            value: "remedy-only",
            label: "Only to remedy specific, documented discrimination",
          },
          { value: "race-neutral", label: "No, these decisions should be race-neutral" },
        ],
      },
    ],
  },
  {
    slug: "immigration",
    label: "Immigration",
    description: "Legal immigration levels and enforcement.",
    questions: [
      {
        slug: "immigration-legal-levels",
        topic: { slug: "legal-immigration", label: "Legal immigration levels" },
        prompt: "How should overall levels of legal immigration change?",
        explanationPrompt: WHY,
        choices: [
          { value: "increase-significantly", label: "Increase significantly" },
          { value: "increase-somewhat", label: "Increase somewhat" },
          { value: "keep-same", label: "Stay about the same" },
          { value: "decrease", label: "Decrease" },
        ],
      },
      {
        slug: "immigration-long-term-undocumented",
        multiple: true,
        topic: { slug: "undocumented-residents", label: "Undocumented residents" },
        prompt:
          "What should happen to undocumented immigrants who have lived in the country for many years?",
        explanationPrompt: WHY,
        choices: [
          { value: "citizenship-path", label: "Offer a path to citizenship" },
          { value: "legal-status", label: "Offer legal status without citizenship" },
          { value: "case-by-case", label: "Decide case by case under existing processes" },
          { value: "enforcement", label: "Prioritize enforcement and removal" },
        ],
      },
    ],
  },
  {
    slug: "government-democracy",
    label: "Government & Democracy",
    description: "Elections, voting rules and the balance of power.",
    questions: [
      {
        slug: "democracy-voting-rules",
        topic: { slug: "voting-rules", label: "Voting rules" },
        prompt: "What should be the main priority when setting voting rules?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "maximize-access",
            label:
              "Make voting as easy as possible, e.g. automatic registration and broad mail voting",
          },
          {
            value: "access-with-verification",
            label: "Expand access while adding some verification steps",
          },
          {
            value: "verification-current-access",
            label: "Strengthen verification, such as photo ID, while keeping current access",
          },
          {
            value: "security-first",
            label: "Prioritize election security, even if voting becomes less convenient",
          },
        ],
      },
      {
        slug: "democracy-federal-vs-state",
        topic: { slug: "federal-state-balance", label: "Federal and state power" },
        prompt: "Where should most policy decisions be made?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "federal",
            label: "Mostly at the federal level, for consistent national standards",
          },
          { value: "depends", label: "It depends on the issue" },
          {
            value: "state-local",
            label: "Mostly at the state and local level, with a limited federal role",
          },
        ],
      },
      {
        slug: "democracy-presidential-election-method",
        topic: { slug: "electoral-college", label: "Electoral College" },
        prompt: "How should the president be elected?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "national-popular-vote",
            label: "Replace the Electoral College with a national popular vote",
          },
          {
            value: "reform-allocation",
            label:
              "Keep the Electoral College, but change how states award electors, such as in proportion to each state's vote",
          },
          { value: "keep-as-is", label: "Keep the Electoral College as it is" },
        ],
      },
    ],
  },
  {
    slug: "corporate-power",
    label: "Corporate Power",
    description: "Competition, large companies and money in politics.",
    questions: [
      {
        slug: "corporate-antitrust",
        topic: { slug: "competition-antitrust", label: "Competition and antitrust" },
        prompt: "How should government approach very large, dominant companies?",
        explanationPrompt: WHY,
        choices: [
          { value: "break-up", label: "Break up dominant companies more aggressively" },
          {
            value: "stronger-enforcement",
            label: "Enforce existing competition laws more strongly",
          },
          { value: "current-approach", label: "The current approach is about right" },
          {
            value: "less-regulation",
            label: "Regulate less; large companies often benefit consumers",
          },
        ],
      },
      {
        slug: "corporate-political-spending",
        multiple: true,
        topic: { slug: "political-spending", label: "Political spending" },
        prompt: "Should political spending by corporations and outside groups be limited?",
        explanationPrompt: WHY,
        choices: [
          { value: "strict-limits", label: "Yes, with strict limits" },
          {
            value: "disclosure",
            label: "Require full donor disclosure, with fewer spending limits",
          },
          { value: "current-rules", label: "Keep the current rules", exclusive: true },
          {
            value: "fewer-limits",
            label: "Remove most limits; political spending is a form of speech",
          },
        ],
      },
    ],
  },
  {
    slug: "environment-energy",
    label: "Environment & Energy",
    description: "Climate, pollution and energy production.",
    questions: [
      {
        slug: "environment-climate-approach",
        multiple: true,
        topic: { slug: "climate-policy", label: "Climate policy" },
        prompt: "How should government approach climate change?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "mandates-investment",
            label: "Use mandates and public investment to cut emissions quickly",
          },
          { value: "market-pricing", label: "Use market-based tools such as carbon pricing" },
          {
            value: "innovation-incentives",
            label: "Encourage innovation through incentives, without new mandates or taxes",
          },
          {
            value: "not-priority",
            label: "Climate policy should not be a major government priority",
            exclusive: true,
          },
        ],
      },
      {
        slug: "environment-energy-mix",
        multiple: true,
        topic: { slug: "energy-sources", label: "Energy sources" },
        prompt: "Which energy sources should government policy favor?",
        explanationPrompt: WHY,
        choices: [
          { value: "renewables", label: "Mainly renewables such as wind and solar" },
          { value: "broad-mix-nuclear", label: "A broad mix including renewables and nuclear" },
          { value: "no-favorites", label: "No favorites; let markets choose among all sources" },
          { value: "domestic-fossil", label: "Expand domestic oil, gas and coal production" },
        ],
      },
    ],
  },
  {
    slug: "public-safety-justice",
    label: "Public Safety & Justice",
    description: "Policing, firearms and the justice system.",
    questions: [
      {
        slug: "justice-policing-approach",
        multiple: true,
        topic: { slug: "policing", label: "Policing" },
        prompt: "Which approach to policing comes closest to your view?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "shift-funding",
            label: "Shift some police funding to social services and alternative responders",
          },
          {
            value: "reform",
            label: "Keep funding levels and add accountability and training reforms",
          },
          { value: "current", label: "The current approach generally works", exclusive: true },
          { value: "increase-funding", label: "Increase police funding and staffing" },
        ],
      },
      {
        slug: "justice-gun-policy",
        multiple: true,
        topic: { slug: "firearms", label: "Firearms" },
        prompt: "What should firearm laws look like?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "much-stricter",
            label: "Much stricter, including bans on some types of firearms",
          },
          {
            value: "some-measures",
            label: "Add some measures, such as universal background checks",
          },
          { value: "enforce-current", label: "Keep current laws and enforce them better" },
          { value: "loosen", label: "Loosen restrictions on ownership and carrying" },
        ],
      },
    ],
  },
  {
    slug: "foreign-policy-defense",
    label: "Foreign Policy & Defense",
    description: "Military spending and international engagement.",
    questions: [
      {
        slug: "foreign-defense-spending",
        topic: { slug: "defense-spending", label: "Defense spending" },
        prompt: "How should national defense spending change?",
        explanationPrompt: WHY,
        choices: [
          { value: "increase", label: "Increase" },
          { value: "keep", label: "Keep about the same" },
          { value: "decrease", label: "Decrease" },
        ],
      },
      {
        slug: "foreign-international-engagement",
        topic: { slug: "international-engagement", label: "International engagement" },
        prompt: "How involved should the country be in international alliances and conflicts?",
        explanationPrompt: WHY,
        choices: [
          {
            value: "lead-actively",
            label: "Lead actively through alliances and international institutions",
          },
          {
            value: "selective",
            label: "Engage selectively, when core national interests are at stake",
          },
          { value: "reduce-commitments", label: "Focus at home and reduce foreign commitments" },
        ],
      },
    ],
  },
  {
    slug: "housing-affordability",
    label: "Housing & Affordability",
    description: "Housing costs, supply and homelessness.",
    questions: [
      {
        slug: "housing-affordability-approach",
        multiple: true,
        topic: { slug: "housing-costs", label: "Housing costs" },
        prompt: "What is the most effective way to make housing more affordable?",
        explanationPrompt: WHY,
        choices: [
          { value: "public-housing", label: "Build more public and subsidized housing" },
          {
            value: "zoning-reform",
            label: "Loosen zoning and permitting so more housing can be built",
          },
          { value: "renter-protections", label: "Expand rental assistance and tenant protections" },
          {
            value: "less-government",
            label: "Reduce government involvement and let markets adjust",
          },
        ],
      },
      {
        slug: "housing-homelessness",
        multiple: true,
        topic: { slug: "homelessness", label: "Homelessness" },
        prompt: "How should communities respond to homelessness?",
        explanationPrompt: WHY,
        choices: [
          { value: "housing-first", label: "Provide housing first, without preconditions" },
          {
            value: "housing-with-treatment",
            label: "Provide housing combined with required treatment or services",
          },
          {
            value: "shelter-enforcement",
            label: "Expand shelters and enforce rules on public camping",
          },
          {
            value: "community-led",
            label: "Rely mainly on charities and community groups rather than government",
          },
        ],
      },
    ],
  },
  {
    slug: "social-support-programs",
    label: "Social Support Programs",
    description: "Safety-net programs and eligibility rules.",
    questions: [
      {
        slug: "social-safety-net-size",
        topic: { slug: "safety-net-scope", label: "Safety net scope" },
        prompt: "How should the overall size of social safety-net programs change?",
        explanationPrompt: WHY,
        choices: [
          { value: "expand", label: "Expand them" },
          { value: "keep", label: "Keep them about the same" },
          { value: "reform-target", label: "Keep the overall size but target help more narrowly" },
          { value: "reduce", label: "Reduce them" },
        ],
      },
      {
        slug: "social-work-requirements",
        topic: { slug: "work-requirements", label: "Work requirements" },
        prompt:
          "Should assistance such as food or health benefits require work or job training for adults able to work?",
        explanationPrompt: WHY,
        choices: [
          { value: "no", label: "No, benefits should not depend on work" },
          { value: "with-exemptions", label: "Yes, with broad exemptions such as for caregivers" },
          { value: "yes", label: "Yes, for most adults able to work" },
        ],
      },
    ],
  },
];
