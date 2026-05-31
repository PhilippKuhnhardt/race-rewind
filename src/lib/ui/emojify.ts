import { flag } from 'country-emoji';

function customRaceName(countryName: string): string | null {
  switch (true) {
    case countryName.includes('Indianapolis 500'):
      return '🇺🇸';
    case countryName.includes('Detroit'):
      return '🇺🇸';
    case countryName.includes('Miami'):
      return '🇺🇸';
    case countryName.includes('Las Vegas'):
      return '🇺🇸';
    case countryName.includes('Caesars Palace'):
      return '🇺🇸';
    case countryName.includes('Dallas'):
      return '🇺🇸';
    case countryName.includes('Styrian'):
      return '🇦🇹';
    case countryName.includes('Tuscan'):
      return '🇮🇹';
    case countryName.includes('Pescara'):
      return '🇮🇹';
    case countryName.includes('Emilia Romagna'):
      return '🇮🇹';
    case countryName.includes('Sakhir'):
      return '🇧🇭';
    case countryName.includes('Abu Dhabi'):
      return '🇦🇪';
    case countryName.includes('Eifel'):
      return '🇩🇪';
    case countryName.includes('70th Anniversary'):
      return '🇬🇧';
    case countryName.includes('São Paulo'):
      return '🇧🇷';
    case countryName.includes('Pacific'):
      return '🇯🇵';
    case countryName.includes('Korea'):
      return '🇰🇷';
    case countryName.includes('European'):
      return '🇪🇺';
    case countryName.includes('Barcelona'):
      return '🇪🇸';
    default:
      return null;
  }
}

export function raceFlag(name: string): string | null {
  const base = name.replace(/ (Grand Prix|GP)$/i, '').trim();
  return customRaceName(base) ?? flag(base) ?? flag(base.slice(0, -1)) ?? null;
}

export function emojify(name: string): string {
  const calculatedFlag = raceFlag(name);
  return calculatedFlag ? `${calculatedFlag} ${name}` : name;
}
