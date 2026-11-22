export const grade = (score: number): string => {
  if (score > 90) return "a";
  if (score > 80) return "b";
  if (score > 70) return "c";
  if (score > 60) return "d";
  if (score > 50) return "e";
  return "f";
};
