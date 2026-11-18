/** Kalkulator FR-09 — spójny z @nsm/shared estimateTattooPrice */

export type EstimateInput = {
  size: string;
  style: string;
  colorMode: 'BLACK_GREY' | 'COLOR';
  bodyPart: string;
};

export type PriceEstimate = {
  minPln: number;
  maxPln: number;
  suggestedSessions: number;
  breakdown: string[];
};

export function estimateTattooPrice(input: EstimateInput): PriceEstimate {
  const size = input.size.toLowerCase();
  const style = input.style.toLowerCase();
  const part = input.bodyPart.toLowerCase();
  const breakdown: string[] = [];

  let base = 350;
  if (size.includes('mały') || size.includes('do 5')) {
    base = 250;
    breakdown.push('Rozmiar mały: baza 250 zł');
  } else if (size.includes('średni') || size.includes('5–15') || size.includes('5-15')) {
    base = 450;
    breakdown.push('Rozmiar średni: baza 450 zł');
  } else if (size.includes('rękaw') || size.includes('większa')) {
    base = 1200;
    breakdown.push('Duża powierzchnia / rękaw: baza 1200 zł');
  } else if (size.includes('duży') || size.includes('powyżej')) {
    base = 800;
    breakdown.push('Rozmiar duży: baza 800 zł');
  } else {
    breakdown.push('Rozmiar niestandardowy: baza 350 zł');
  }

  let styleMult = 1;
  if (style.includes('realizm')) {
    styleMult = 1.45;
    breakdown.push('Styl realizm: +45%');
  } else if (style.includes('blackwork')) {
    styleMult = 1.25;
    breakdown.push('Styl blackwork: +25%');
  } else if (style.includes('neo') || style.includes('tradyc')) {
    styleMult = 1.2;
    breakdown.push('Styl tradycyjny/neo: +20%');
  } else if (style.includes('fineline') || style.includes('minimal')) {
    styleMult = 1.05;
    breakdown.push('Styl fineline/minimal: +5%');
  } else if (style.includes('botanic') || style.includes('geometr')) {
    styleMult = 1.15;
    breakdown.push('Styl botaniczny/geometryczny: +15%');
  }

  const colorMult = input.colorMode === 'COLOR' ? 1.2 : 1;
  if (input.colorMode === 'COLOR') breakdown.push('Kolor: +20%');
  else breakdown.push('Czerń/szarość: bez dopłaty');

  let partMult = 1;
  if (
    part.includes('żeb') ||
    part.includes('szyj') ||
    part.includes('uch') ||
    part.includes('dłoń') ||
    part.includes('kostk')
  ) {
    partMult = 1.15;
    breakdown.push('Miejsce trudniejsze technicznie: +15%');
  } else if (part.includes('plec') || part.includes('klatk') || part.includes('udo')) {
    partMult = 1.1;
    breakdown.push('Większa okolica: +10%');
  }

  const mid = Math.round(base * styleMult * colorMult * partMult);
  const minPln = Math.round((mid * 0.85) / 10) * 10;
  const maxPln = Math.round((mid * 1.25) / 10) * 10;
  const suggestedSessions = maxPln >= 1500 ? 3 : maxPln >= 900 ? 2 : 1;

  return { minPln, maxPln, suggestedSessions, breakdown };
}
