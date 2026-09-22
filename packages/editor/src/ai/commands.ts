export type CommandType =
  | 'scene'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'lyrics'
  | 'action'
  | 'literal'
  | 'plain';

export interface CommandDefinition {
  type: CommandType;
  keywords: string[];
}

export const LOCALIZED_COMMANDS: Record<string, CommandDefinition[]> = {
  en: [
    { type: 'literal', keywords: ['literal', 'plain', 'bypass'] },
    { type: 'scene', keywords: ['new scene', 'scene heading', 'scene'] },
    { type: 'character', keywords: ['character name', 'character', 'char'] },
    { type: 'dialogue', keywords: ['dialogue', 'dialog', 'says'] },
    { type: 'parenthetical', keywords: ['parenthetical', 'bracket', 'brackets'] },
    { type: 'transition', keywords: ['transition', 'fade out', 'fade in', 'cut to'] },
    { type: 'lyrics', keywords: ['lyrics', 'sing lyrics', 'song'] },
    { type: 'action', keywords: ['action description', 'action'] },
  ],
  hi: [
    { type: 'literal', keywords: ['शब्दशः', 'वास्तविक', 'प्लेन'] },
    { type: 'scene', keywords: ['नया दृश्य', 'दृश्य'] },
    { type: 'character', keywords: ['पात्र नाम', 'पात्र', 'चरित्र'] },
    { type: 'dialogue', keywords: ['संवाद', 'बोलता है', 'बोलती है'] },
    { type: 'parenthetical', keywords: ['कोष्ठक', 'ब्रैकेट'] },
    { type: 'transition', keywords: ['बदलाव', 'कट टू'] },
    { type: 'lyrics', keywords: ['गीत', 'गाना'] },
    { type: 'action', keywords: ['विवरण', 'एक्शन'] },
  ],
  ta: [
    { type: 'literal', keywords: ['உண்மையான', 'வார்த்தை', 'நேரடி'] },
    { type: 'scene', keywords: ['புதிய காட்சி', 'காட்சி'] },
    { type: 'character', keywords: ['கதாபாத்திரம் பெயர்', 'கதாபாத்திரம்'] },
    { type: 'dialogue', keywords: ['வசனம்', 'பேசுகிறார்'] },
    { type: 'parenthetical', keywords: ['அடைப்புக்குறி', 'பிராக்கெட்'] },
    { type: 'transition', keywords: ['மாற்றம்', 'கட் டூ'] },
    { type: 'lyrics', keywords: ['பாடல்', 'பாட்டு'] },
    { type: 'action', keywords: ['செயல்', 'விளக்கம்'] },
  ],
  te: [
    { type: 'literal', keywords: ['యథార్థం', 'సాధారణ'] },
    { type: 'scene', keywords: ['కొత్త సన్నివేశం', 'సన్నివేశం'] },
    { type: 'character', keywords: ['పాత్ర పేరు', 'పాత్ర'] },
    { type: 'dialogue', keywords: ['సంభాషణ', 'మాట్లాడు'] },
    { type: 'parenthetical', keywords: ['బ్రాకెట్', 'వరణము'] },
    { type: 'transition', keywords: ['మార్పు', 'కట్ టు'] },
    { type: 'lyrics', keywords: ['పాట', 'గీతం'] },
    { type: 'action', keywords: ['చర్య', 'వివరణ'] },
  ],
  ml: [
    { type: 'literal', keywords: ['യഥാർത്ഥ', 'സാധാരണ'] },
    { type: 'scene', keywords: ['പുതിയ രംഗം', 'രംഗം'] },
    { type: 'character', keywords: ['കഥാപാത്രം പേര്', 'കഥാപാത്രം'] },
    { type: 'dialogue', keywords: ['സംഭാഷണം', 'പറയുന്നു'] },
    { type: 'parenthetical', keywords: ['ബ്രാക്കറ്റ്'] },
    { type: 'transition', keywords: ['മാറ്റം', 'കട്ട് ടു'] },
    { type: 'lyrics', keywords: ['പാട്ട്', 'ഗാനം'] },
    { type: 'action', keywords: ['പ്രവർത്തി', 'വിവരണം'] },
  ],
  kn: [
    { type: 'literal', keywords: ['ನಿಜವಾದ', 'ಸಾಮಾನ್ಯ'] },
    { type: 'scene', keywords: ['ಹೊಸ ದೃಶ್ಯ', 'ದೃಶ್ಯ'] },
    { type: 'character', keywords: ['ಪಾತ್ರ ಹೆಸರು', 'ಪಾತ್ರ'] },
    { type: 'dialogue', keywords: ['ಸಂಭಾಷಣೆ', 'ಹೇಳುತ್ತದೆ'] },
    { type: 'parenthetical', keywords: ['ವರಣಚಿಹ್ನೆ', 'ಬ್ರಾಕೆಟ್'] },
    { type: 'transition', keywords: ['ಬದಲಾವಣೆ', 'ಕಟ್ ಟು'] },
    { type: 'lyrics', keywords: ['ಹಾಡು', 'ಗೀತೆ'] },
    { type: 'action', keywords: ['ಕ್ರಿಯೆ', 'ವಿವರಣೆ'] },
  ],
  bn: [
    { type: 'literal', keywords: ['আক্ষরিক', 'সাধারণ'] },
    { type: 'scene', keywords: ['নতুন দৃশ্য', 'দৃশ্য'] },
    { type: 'character', keywords: ['চরিত্রের নাম', 'চরিত্র'] },
    { type: 'dialogue', keywords: ['সংলাপ', 'বলে'] },
    { type: 'parenthetical', keywords: ['বন্ধনী', 'ব্র্যাকেট'] },
    { type: 'transition', keywords: ['পরিবর্তন', 'কাট টু'] },
    { type: 'lyrics', keywords: ['গান', 'গীতি'] },
    { type: 'action', keywords: ['ক্রিয়া', 'বর্ণনা'] },
  ],
  gu: [
    { type: 'literal', keywords: ['શાબ્દિક', 'સામાન્ય'] },
    { type: 'scene', keywords: ['નવું દ્રશ્ય', 'દ્રશ્ય'] },
    { type: 'character', keywords: ['પાત્રનું નામ', 'પાત્ર'] },
    { type: 'dialogue', keywords: ['સંવાદ', 'બોલે છે'] },
    { type: 'parenthetical', keywords: ['કૌંસ', 'બ્રેકેટ'] },
    { type: 'transition', keywords: ['પરિવર્તન', 'કટ ટુ'] },
    { type: 'lyrics', keywords: ['ગીત', 'ગાણું'] },
    { type: 'action', keywords: ['ક્રિયા', 'વર્ણન'] },
  ],
  mr: [
    { type: 'literal', keywords: ['शाब्दिक', 'साधे'] },
    { type: 'scene', keywords: ['नवीन दृश्य', 'दृश्य'] },
    { type: 'character', keywords: ['पात्राचे नाव', 'पात्र'] },
    { type: 'dialogue', keywords: ['संवाद', 'बोलतो', 'बोलते'] },
    { type: 'parenthetical', keywords: ['कंसात', 'ब्रॅकेट'] },
    { type: 'transition', keywords: ['बदल', 'कट टू'] },
    { type: 'lyrics', keywords: ['गाणे', 'गीत'] },
    { type: 'action', keywords: ['कृती', 'वर्णन'] },
  ],
};

export interface ParsedVoiceResult {
  type: CommandType | 'action';
  text: string;
  isLiteral: boolean;
}

export function parseVoiceCommand(transcript: string, langCode: string): ParsedVoiceResult {
  const normText = transcript.trim();
  // Get language mapping, default to English if not found
  const baseLang = langCode.split('-')[0] || 'en';
  const defs = LOCALIZED_COMMANDS[baseLang] || LOCALIZED_COMMANDS.en!;

  // 1. Check for literal bypass sequence
  const literalDef = defs.find(d => d.type === 'literal');
  if (literalDef) {
    for (const kw of literalDef.keywords) {
      if (normText.toLowerCase().startsWith(kw + ' ')) {
        return {
          type: 'action',
          text: normText.substring(kw.length + 1).trim(),
          isLiteral: true,
        };
      }
    }
  }

  // 2. Scan other formatting keywords
  for (const def of defs) {
    if (def.type === 'literal') continue;
    for (const kw of def.keywords) {
      // Check if text starts with the keyword followed by space or is exactly the keyword
      const prefix = kw + ' ';
      if (normText.toLowerCase().startsWith(prefix)) {
        return {
          type: def.type,
          text: normText.substring(kw.length + 1).trim(),
          isLiteral: false,
        };
      } else if (normText.toLowerCase() === kw) {
        return {
          type: def.type,
          text: '',
          isLiteral: false,
        };
      }
    }
  }

  // 3. Fallback to default action text
  return {
    type: 'action',
    text: normText,
    isLiteral: false,
  };
}
