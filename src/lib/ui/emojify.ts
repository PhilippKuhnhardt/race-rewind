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
    case countryName.includes('Korean'):
      return '🇰🇷';
    case countryName.includes('European'):
      return '🇪🇺';
    default:
      return null;
  }
}

export function emojify(countryName: string): string {
  const calculatedFlag = customRaceName(countryName) ?? flag(countryName);
  return calculatedFlag ? `${calculatedFlag} ${countryName}` : countryName;
}
