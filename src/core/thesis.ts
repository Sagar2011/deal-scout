export type RunThesis = {
  topic: string;
  statement: string;
  fitLabel: string;
};

export function createRunThesis(topic: string): RunThesis {
  const focus = topic.trim();
  return {
    topic: focus,
    statement: `Seed-stage startups addressing ${focus}, prioritizing a clearly evidenced workflow, direct topic fit, technical execution, credible public signals, and traceable market timing.`,
    fitLabel: `${toTitleCase(focus)} fit`,
  };
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
