export interface Rechenweg {
  strategyKey: string;  // i18n key for the strategy name label
  steps: string[];      // computed step strings (numbers + operators — language-neutral)
  hint: string;         // ultra-short one-liner for sprint feedback
}

export function getRechenweg(a: number, b: number): Rechenweg {
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
        strategyKey: 'rechenweg.timesTenMinusTwo',
        steps: [
          `${big} × 10 = ${big * 10}`,
          `${big} × 2 = ${big * 2}`,
          `${big * 10} − ${big * 2} = ${big * 8}`,
        ],
        hint: `${big}×10 − ${big}×2`,
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
        strategyKey: 'rechenweg.doubleAndOne',
        steps: [`${a} × ${b} = ${a * b}`],
        hint: `= ${a * b}`,
      };
  }
}
