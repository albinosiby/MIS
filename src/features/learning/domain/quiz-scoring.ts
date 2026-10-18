export function exactQuizScore(
  answer: string,
  response: string,
  maximum: number,
) {
  const normalize = (v: string) =>
    v.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
  return normalize(answer) === normalize(response) ? maximum : 0;
}
