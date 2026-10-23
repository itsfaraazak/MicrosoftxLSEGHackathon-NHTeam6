// Demo presets. These are user inputs typed on someone's behalf, not data: every number on screen still comes from the API.
export type PersonaId = "priya" | "tom" | "fiona" | "custom";

export type Persona = {
  id: PersonaId;
  name: string;
  chip: string;
  job: string;
  text: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "priya",
    name: "Priya",
    chip: "Priya, VP of engineering",
    job: "VP of Engineering at a London fintech",
    text:
      "I’m Priya, 36. I’m VP of Engineering at a London fintech, so I’m well paid, I get share options, and I have $100,000 of savings ready to invest. " +
      "I already have about $15,000 in a tech fund through an app. " +
      "I want a house deposit of $30,000 in about five years and to grow the rest for the long term. " +
      "I’d call myself high risk, though I sold everything when markets dropped in March 2020.",
  },
  {
    id: "tom",
    name: "Tom",
    chip: "Tom, NHS consultant",
    job: "Hospital consultant at an NHS trust",
    text:
      "I’m Tom, 44. I’m a consultant doctor at an NHS hospital. My job is very stable, I’ve never invested before, and I have $100,000 of savings ready to invest. " +
      "I’d like to build up money for retirement in about 25 years. I’d say I’m comfortable with medium risk.",
  },
  {
    id: "fiona",
    name: "Fiona",
    chip: "Fiona, operations director",
    job: "Operations director at an Aberdeen oil and gas company",
    text:
      "I’m Fiona, 38. I’m an operations director at an offshore oil and gas company in Aberdeen, and I hold some shares in my employer. " +
      "I have $100,000 of savings ready to invest and I want to save for my children’s education in about ten years. " +
      "I’d say I’m comfortable with medium risk.",
  },
];

// "Write your own": the text box starts empty and the user describes themselves. Not part of PERSONAS, so Compare never uses it.
export const CUSTOM_PERSONA: Persona = {
  id: "custom",
  name: "You",
  chip: "Write your own",
  job: "Your own profile",
  text: "",
};

export const DEFAULT_PERSONA: PersonaId = "priya";

export function isPersonaId(v: string | null): v is PersonaId {
  return v === "custom" || PERSONAS.some((p) => p.id === v);
}

export function personaById(id: PersonaId): Persona {
  if (id === "custom") return CUSTOM_PERSONA;
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

export function nextPersona(id: PersonaId): PersonaId {
  const i = PERSONAS.findIndex((p) => p.id === id);
  return PERSONAS[(i + 1) % PERSONAS.length].id;
}
