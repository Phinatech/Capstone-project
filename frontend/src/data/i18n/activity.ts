/**
 * Notifications built from shared policy data (see contexts/policyActivity.ts),
 * worded for whoever reads them: the farmer, the agent who sold the policy,
 * or the administrator.
 */
export const en = {
  'notif.view': 'View',
  'activity.someFarmer': 'A farmer',
  'activity.farmer.purchased.title': 'Policy #{id} is active',
  'activity.farmer.purchased.body': '{crop} cover in {lga}. Pays {payout} if rainfall stays below {threshold}.',
  'activity.farmer.paid.title': 'Payout sent: {payout}',
  'activity.farmer.paid.body': 'Rainfall of {rain} fell below your {threshold} trigger. The money is in your wallet.',
  'activity.farmer.paidViaAgent.body': 'Rainfall of {rain} fell below your {threshold} trigger. Your agent has received the payout and will pay you the naira on your receipt.',
  'activity.farmer.settled.title': 'Policy #{id} settled',
  'activity.farmer.settled.body': 'Rainfall of {rain} met your {threshold} trigger, so no payout was due.',
  'activity.agent.purchased.title': 'Sale recorded: policy #{id}',
  'activity.agent.purchased.body': '{farmer} · {crop} in {lga} · pays {payout} below {threshold}.',
  'activity.agent.paid.title': 'Payout for {farmer}: {payout}',
  'activity.agent.paid.body': 'Policy #{id}: rainfall of {rain} fell below {threshold}. The payout is in your agent wallet; pay {farmer} the naira on their receipt.',
  'activity.agent.settled.title': 'Policy #{id} for {farmer} settled',
  'activity.agent.settled.body': 'Rainfall of {rain} met the {threshold} trigger, so no payout was due.',
  'activity.admin.purchased.title': 'New policy #{id}',
  'activity.admin.purchased.body': '{farmer} · {crop} in {lga} · premium {premium}, pays {payout} below {threshold}.',
  'activity.admin.paid.title': 'Payout sent on policy #{id}',
  'activity.admin.paid.body': '{payout} to {farmer}: rainfall of {rain} fell below {threshold}.',
  'activity.admin.settled.title': 'Policy #{id} settled, no payout',
  'activity.admin.settled.body': '{farmer}: rainfall of {rain} met the {threshold} trigger.',
  'crop.Millet': 'Millet',
  'crop.Sorghum': 'Sorghum'
} as const;

type Strings = Record<keyof typeof en, string>;

export const ha: Strings = {
  'notif.view': 'Duba',
  'activity.someFarmer': 'Wani manomi',
  'activity.farmer.purchased.title': 'Inshora #{id} ta fara aiki',
  'activity.farmer.purchased.body': 'Inshorar {crop} a {lga}. Za ta biya {payout} idan ruwan sama bai kai {threshold} ba.',
  'activity.farmer.paid.title': 'An aika biyan kuɗi: {payout}',
  'activity.farmer.paid.body': 'Ruwan sama {rain} ne kawai, ƙasa da iyakar {threshold}. Kuɗin sun shiga walat ɗinku.',
  'activity.farmer.paidViaAgent.body': 'Ruwan sama {rain} ne kawai, ƙasa da iyakar {threshold}. Wakilinku ya karɓi kuɗin kuma zai biya ku Nairar da ke kan rasitinku.',
  'activity.farmer.settled.title': 'An kammala inshora #{id}',
  'activity.farmer.settled.body': 'Ruwan sama ya kai {rain}, ya kai iyakar {threshold}, don haka babu biyan kuɗi.',
  'activity.agent.purchased.title': 'An rubuta siyarwa: inshora #{id}',
  'activity.agent.purchased.body': '{farmer} · {crop} a {lga} · za ta biya {payout} idan ruwa bai kai {threshold} ba.',
  'activity.agent.paid.title': 'An biya {farmer}: {payout}',
  'activity.agent.paid.body': 'Inshora #{id}: ruwan sama {rain} ne kawai, ƙasa da {threshold}. Kuɗin suna walat ɗinku na wakili; ku biya {farmer} Nairar da ke kan rasitinsa.',
  'activity.agent.settled.title': 'An kammala inshora #{id} ta {farmer}',
  'activity.agent.settled.body': 'Ruwan sama ya kai {rain}, ya kai iyakar {threshold}, don haka babu biyan kuɗi.',
  'activity.admin.purchased.title': 'Sabuwar inshora #{id}',
  'activity.admin.purchased.body': '{farmer} · {crop} a {lga} · kuɗin inshora {premium}, za ta biya {payout} idan ruwa bai kai {threshold} ba.',
  'activity.admin.paid.title': 'An biya kuɗi a kan inshora #{id}',
  'activity.admin.paid.body': '{payout} ga {farmer}: ruwan sama {rain} ne kawai, ƙasa da {threshold}.',
  'activity.admin.settled.title': 'An kammala inshora #{id}, babu biyan kuɗi',
  'activity.admin.settled.body': '{farmer}: ruwan sama ya kai {rain}, ya kai iyakar {threshold}.',
  'crop.Millet': 'Gero',
  'crop.Sorghum': 'Dawa'
};

export const fr: Strings = {
  'notif.view': 'Voir',
  'activity.someFarmer': 'Un agriculteur',
  'activity.farmer.purchased.title': 'La police n° {id} est active',
  'activity.farmer.purchased.body': 'Couverture {crop} à {lga}. Verse {payout} si la pluie reste sous {threshold}.',
  'activity.farmer.paid.title': 'Indemnité versée : {payout}',
  'activity.farmer.paid.body': 'La pluie ({rain}) est restée sous votre seuil de {threshold}. L’argent est sur votre portefeuille.',
  'activity.farmer.paidViaAgent.body': 'La pluie ({rain}) est restée sous votre seuil de {threshold}. Votre agent a reçu l’indemnité et vous paiera les naira de votre reçu.',
  'activity.farmer.settled.title': 'Police n° {id} réglée',
  'activity.farmer.settled.body': 'La pluie ({rain}) a atteint votre seuil de {threshold} : aucune indemnité n’était due.',
  'activity.agent.purchased.title': 'Vente enregistrée : police n° {id}',
  'activity.agent.purchased.body': '{farmer} · {crop} à {lga} · verse {payout} sous {threshold}.',
  'activity.agent.paid.title': 'Indemnité pour {farmer} : {payout}',
  'activity.agent.paid.body': 'Police n° {id} : la pluie ({rain}) est restée sous {threshold}. L’indemnité est sur votre portefeuille d’agent ; payez à {farmer} les naira de son reçu.',
  'activity.agent.settled.title': 'Police n° {id} de {farmer} réglée',
  'activity.agent.settled.body': 'La pluie ({rain}) a atteint le seuil de {threshold} : aucune indemnité n’était due.',
  'activity.admin.purchased.title': 'Nouvelle police n° {id}',
  'activity.admin.purchased.body': '{farmer} · {crop} à {lga} · prime {premium}, verse {payout} sous {threshold}.',
  'activity.admin.paid.title': 'Indemnité versée sur la police n° {id}',
  'activity.admin.paid.body': '{payout} à {farmer} : la pluie ({rain}) est restée sous {threshold}.',
  'activity.admin.settled.title': 'Police n° {id} réglée, sans indemnité',
  'activity.admin.settled.body': '{farmer} : la pluie ({rain}) a atteint le seuil de {threshold}.',
  'crop.Millet': 'Mil',
  'crop.Sorghum': 'Sorgho'
};
