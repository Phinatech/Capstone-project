/** Example text shown inside empty fields, so people know what to type. */
export const en = {
  'ph.email': 'e.g. amina@example.com',
  'ph.password': 'Enter your password',
  'ph.newPassword': 'At least 8 characters',
  'ph.confirmPassword': 'Type the password again',
  'ph.currentPassword': 'Your current password',
  'ph.fullName': 'e.g. Amina Bello',
  'ph.phone': 'e.g. 0803 123 4567',
  'ph.village': 'e.g. Gidan Kanawa',
  'ph.farmSize': 'e.g. 2.5',
  'ph.jobTitle': 'e.g. Field agent, Wamakko',
  'ph.bio': 'A sentence or two about you and your farm',
  'ph.reference': 'e.g. SKT-4821',
  'ph.deleteConfirm': 'Type DELETE',
  'ph.codeDigit': '•'
} as const;

type Strings = Record<keyof typeof en, string>;

export const ha: Strings = {
  'ph.email': 'misali amina@example.com',
  'ph.password': 'Shigar da kalmar sirrinku',
  'ph.newPassword': 'Aƙalla haruffa 8',
  'ph.confirmPassword': 'Sake rubuta kalmar sirrin',
  'ph.currentPassword': 'Kalmar sirrinku ta yanzu',
  'ph.fullName': 'misali Amina Bello',
  'ph.phone': 'misali 0803 123 4567',
  'ph.village': 'misali Gidan Kanawa',
  'ph.farmSize': 'misali 2.5',
  'ph.jobTitle': 'misali Wakilin filin aiki, Wamakko',
  'ph.bio': 'Jimla ɗaya ko biyu game da ku da gonarku',
  'ph.reference': 'misali SKT-4821',
  'ph.deleteConfirm': 'Rubuta DELETE',
  'ph.codeDigit': '•'
};

export const fr: Strings = {
  'ph.email': 'ex. amina@example.com',
  'ph.password': 'Saisissez votre mot de passe',
  'ph.newPassword': 'Au moins 8 caractères',
  'ph.confirmPassword': 'Retapez le mot de passe',
  'ph.currentPassword': 'Votre mot de passe actuel',
  'ph.fullName': 'ex. Amina Bello',
  'ph.phone': 'ex. 0803 123 4567',
  'ph.village': 'ex. Gidan Kanawa',
  'ph.farmSize': 'ex. 2,5',
  'ph.jobTitle': 'ex. Agent de terrain, Wamakko',
  'ph.bio': 'Une ou deux phrases sur vous et votre exploitation',
  'ph.reference': 'ex. SKT-4821',
  'ph.deleteConfirm': 'Tapez DELETE',
  'ph.codeDigit': '•'
};
