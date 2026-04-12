const ADJECTIVES = [
  'Turbo', 'Mega', 'Epic', 'Hyper', 'Cosmic', 'Super', 'Ultra', 'Pro',
  'Giga', 'Alpha', 'Nova', 'Neon', 'Aqua'
];

const NOUNS = [
  'Dino', 'Panda', 'Ninja', 'Fox', 'Shark', 'Bear', 'Wolf', 'Tiger',
  'Lion', 'Dragon', 'Rex', 'Falcon', 'Bot'
];

export function generateGamertag(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  
  // Random number between 10 and 99
  const num = Math.floor(Math.random() * 90) + 10;

  return `${adj}${noun}${num}`;
}
