export interface Rechenweg {
  strategyKey: string;  // i18n key for the strategy name label
  steps: string[];      // computed step strings (numbers + operators — language-neutral)
  hint: string;         // ultra-short one-liner for sprint feedback
}

export function getRechenweg(a: number, b: number): Rechenweg {
  // Tier-1: curated 2-digit factors — check before the small/big swap
  const two = [11, 12, 15, 20, 25].includes(a) ? a
            : [11, 12, 15, 20, 25].includes(b) ? b
            : 0;
  const n = two > 0 ? (a === two ? b : a) : 0;
  if (two === 11 && n >= 2 && n <= 9) return {
    strategyKey: 'rechenweg.eleven',
    steps: [`${n} × 10 = ${n * 10}`, `${n * 10} + ${n} = ${n * 11}`],
    hint: `${n}×10 + ${n}`,
  };
  if (two === 12 && n >= 2 && n <= 9) return {
    strategyKey: 'rechenweg.twelve',
    steps: [`${n} × 10 = ${n * 10}`, `${n} × 2 = ${n * 2}`, `${n * 10} + ${n * 2} = ${n * 12}`],
    hint: `${n}×10 + ${n}×2`,
  };
  if (two === 15 && n >= 2 && n <= 9) return {
    strategyKey: 'rechenweg.fifteen',
    steps: [`${n} × 10 = ${n * 10}`, `${n} × 5 = ${n * 5}`, `${n * 10} + ${n * 5} = ${n * 15}`],
    hint: `${n}×10 + ${n}×5`,
  };
  if (two === 20 && n >= 2 && n <= 9) return {
    strategyKey: 'rechenweg.twenty',
    steps: [`${n} × 2 = ${n * 2}`, `${n * 2} × 10 = ${n * 20}`],
    hint: `${n}×2, ×10`,
  };
  if (two === 25 && n >= 2 && n <= 9) return {
    strategyKey: 'rechenweg.twentyfive',
    steps: [`${n} × 20 = ${n * 20}`, `${n} × 5 = ${n * 5}`, `${n * 20} + ${n * 5} = ${n * 25}`],
    hint: `${n}×20 + ${n}×5`,
  };

  const [small, big] = a <= b ? [a, b] : [b, a];

  switch (small) {
    case 0:
      return {
        strategyKey: 'rechenweg.zero',
        steps: [`${big} × 0 = 0`],
        hint: `× 0 = 0`,
      };
    case 1:
      return {
        strategyKey: 'rechenweg.one',
        steps: [`${big} × 1 = ${big}`],
        hint: `× 1 = ${big}`,
      };
    case 2:
      return {
        strategyKey: 'rechenweg.double',
        steps: [`${big} + ${big} = ${big * 2}`],
        hint: `${big} + ${big}`,
      };
    case 3:
      return {
        strategyKey: 'rechenweg.doubleAndOne',
        steps: [
          `${big} × 2 = ${big * 2}`,
          `${big * 2} + ${big} = ${big * 3}`,
        ],
        hint: `${big}×2 + ${big}`,
      };
    case 4:
      return {
        strategyKey: 'rechenweg.doubleDouble',
        steps: [
          `${big} × 2 = ${big * 2}`,
          `${big * 2} × 2 = ${big * 4}`,
        ],
        hint: `(${big}×2)×2`,
      };
    case 5:
      return {
        strategyKey: 'rechenweg.timesTenHalf',
        steps: [
          `${big} × 10 = ${big * 10}`,
          `${big * 10} ÷ 2 = ${big * 5}`,
        ],
        hint: `${big}×10 ÷ 2`,
      };
    case 6:
      return {
        strategyKey: 'rechenweg.timesFivePlusOne',
        steps: [
          `${big} × 5 = ${big * 5}`,
          `${big * 5} + ${big} = ${big * 6}`,
        ],
        hint: `${big}×5 + ${big}`,
      };
    case 7:
      return {
        strategyKey: 'rechenweg.timesFivePlusTwo',
        steps: [
          `${big} × 5 = ${big * 5}`,
          `${big} × 2 = ${big * 2}`,
          `${big * 5} + ${big * 2} = ${big * 7}`,
        ],
        hint: `${big}×5 + ${big}×2`,
      };
    case 8:
      return {
        strategyKey: 'rechenweg.tripleDouble',
        steps: [
          `${big} × 2 = ${big * 2}`,
          `${big * 2} × 2 = ${big * 4}`,
          `${big * 4} × 2 = ${big * 8}`,
        ],
        hint: `${big} → ${big * 2} → ${big * 4} → ${big * 8}`,
      };
    case 9:
      return {
        strategyKey: 'rechenweg.timesTenMinusOne',
        steps: [
          `${big} × 10 = ${big * 10}`,
          `${big * 10} − ${big} = ${big * 9}`,
        ],
        hint: `${big}×10 − ${big}`,
      };
    case 10:
      return {
        strategyKey: 'rechenweg.ten',
        steps: [`${big} × 10 = ${big * 10}`],
        hint: `${big * 10}`,
      };
    default:
      return {
        strategyKey: 'rechenweg.direct',
        steps: [`${a} × ${b} = ${a * b}`],
        hint: `= ${a * b}`,
      };
  }
}
