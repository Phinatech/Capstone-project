/** The welcome tour for each role and the "What's new" notes. */
export const en = {
  'tour.farmer.1.title': 'Cover that pays without a claim',
  'tour.farmer.1.body': 'Choose a coverage window and confirm your farm size. Each window has a rainfall level set from 44 years of records. If the rain falls short, you are paid automatically.',
  'tour.farmer.2.title': 'Three sources, one fair decision',
  'tour.farmer.2.body':
    'CHIRPS, NASA POWER and Meteostat report rainfall separately. At least two must report before a result counts, so one bad reading cannot decide your payout.',
  'tour.farmer.3.title': 'Paid where you bought',
  'tour.farmer.3.body':
    'Cover you buy yourself pays into your Sepolia wallet; cover an agent sold you is paid through that agent in naira. Track every policy, payout and alert from your dashboard and notifications.',
  'tour.admin.1.title': 'Settle the evaluation queue',
  'tour.admin.1.body': 'Policies whose coverage window has closed appear on the overview. Open one to request an oracle round and settle it on-chain.',
  'tour.admin.2.title': 'Stress-test the oracle',
  'tour.admin.2.body': 'Corrupt a source during evaluation or open the backtest to compare single-source, equal and reputation-weighted decisions.',
  'tour.admin.3.title': 'Stay on top of live events',
  'tour.admin.3.body': 'Purchases, payouts and settlements arrive as notifications on any device. Use search (Ctrl K) to jump anywhere.',
  'tour.agent.1.title': 'Insure farmers from your wallet',
  'tour.agent.1.body':
    'Select a farmer, enter the farm size you checked with them, and pay the premium from your agent wallet. If the season falls short, the payout comes to your wallet automatically.',
  'tour.agent.2.title': 'No crypto knowledge needed',
  'tour.agent.2.body': 'The farmer does not need a wallet or any blockchain knowledge. You handle the transaction and pay them the naira on their receipt.',
  'tour.agent.3.title': 'Track every policy',
  'tour.agent.3.body': 'Follow every policy you sold, its status and its payout from your agent dashboard and notifications.',
  'release.1.title': 'Real-time notifications',
  'release.1.body': 'A notification centre with purchase and settlement events, plus a bell in the navbar.',
  'release.2.title': 'List and card views',
  'release.2.body': 'Switch between dense lists and cards on policies, farmers and payouts, with filters that fit on any screen.',
  'release.3.title': 'Quick search',
  'release.3.body': 'Press Ctrl K or use the sidebar search to jump to any page, policy or farmer.',
  'release.4.title': 'New colour system',
  'release.4.body': 'A calmer petrol accent with indigo, plum and graphite alternatives in light and dark mode.',
  'release.5.title': 'Account security',
  'release.5.body': 'Reset forgotten passwords, verify your email and change your password from Settings.'
} as const;

type Strings = Record<keyof typeof en, string>;

export const ha: Strings = {
  'tour.farmer.1.title': 'Inshorar da ke biya ba tare da ƙara ba',
  'tour.farmer.1.body': 'Zaɓi lokacin kariya kuma ku tabbatar da girman gonarku. An saita matakin ruwan sama na kowane lokaci daga bayanan shekaru 44. Idan ruwan sama bai isa ba, za a biya ku kai tsaye.',
  'tour.farmer.2.title': 'Tushe uku, hukunci ɗaya na adalci',
  'tour.farmer.2.body':
    'CHIRPS, NASA POWER da Meteostat suna ba da rahoton ruwan sama daban-daban. Sai aƙalla biyu sun ba da rahoto kafin a karɓi sakamako, don haka karatu mara kyau ɗaya ba zai yanke hukuncin biyan kuɗinku ba.',
  'tour.farmer.3.title': 'Ana biya ta inda kuka saya',
  'tour.farmer.3.body':
    'Inshorar da kuka saya da kanku tana biya zuwa walat ɗinku na Sepolia; inshorar da wakili ya sayar muku ana biya ta hannun wakilin da Naira. Bi duk inshora, biyan kuɗi da sanarwa daga babban shafinku.',
  'tour.admin.1.title': 'Kammala jerin tantancewa',
  'tour.admin.1.body': 'Inshorar da lokacin kariyarta ya ƙare tana bayyana a taƙaitawa. Buɗe ɗaya don neman zagayen oracle da kammala ta a blockchain.',
  'tour.admin.2.title': 'Gwada juriyar oracle',
  'tour.admin.2.body': 'Ɓata tushe yayin tantancewa ko buɗe gwaji don kwatanta hukuncin tushe ɗaya, nauyi daidai da nauyi bisa amincewa.',
  'tour.admin.3.title': 'Kasance kan abubuwan da ke faruwa',
  'tour.admin.3.body': 'Saye, biyan kuɗi da kammalawa suna zuwa a matsayin sanarwa a kowace na’ura. Yi amfani da nema (Ctrl K) don zuwa ko’ina.',
  'tour.agent.1.title': 'Yi wa manoma inshora daga walat ɗinku',
  'tour.agent.1.body':
    'Zaɓi manomi, shigar da girman gonar da kuka tabbatar tare da shi, sannan ku biya kuɗin inshora daga walat ɗinku na wakili. Idan damina ba ta kai ba, biyan kuɗi zai zo walat ɗinku kai tsaye.',
  'tour.agent.2.title': 'Ba a buƙatar ilimin crypto',
  'tour.agent.2.body': 'Manomi baya buƙatar walat ko ilimin blockchain. Ku ne kuke yin ma’amalar, kuma ku biya shi Nairar da ke kan rasitinsa.',
  'tour.agent.3.title': 'Bi kowace inshora',
  'tour.agent.3.body': 'Bi kowace inshorar da kuka sayar, matsayinta da biyan kuɗinta daga babban shafinku na wakili da sanarwa.',
  'release.1.title': 'Sanarwa nan take',
  'release.1.body': 'Cibiyar sanarwa mai abubuwan saye da kammalawa, tare da ƙararrawa a saman shafi.',
  'release.2.title': 'Duba a jere ko a katuna',
  'release.2.body': 'Canza tsakanin jerin bayanai da katuna a inshora, manoma da biyan kuɗi, tare da tacewa da ke dacewa da kowane allo.',
  'release.3.title': 'Nema cikin sauri',
  'release.3.body': 'Danna Ctrl K ko yi amfani da nema a gefe don zuwa kowane shafi, inshora ko manomi.',
  'release.4.title': 'Sabon tsarin launi',
  'release.4.body': 'Launin petrol mai natsuwa tare da zaɓuɓɓukan indigo, plum da graphite a yanayin haske da duhu.',
  'release.5.title': 'Tsaron asusu',
  'release.5.body': 'Sake saita kalmar sirri da aka manta, tabbatar da imel ɗinku kuma canza kalmar sirri daga Saituna.'
};

export const fr: Strings = {
  'tour.farmer.1.title': 'Une couverture qui paie sans déclaration',
  'tour.farmer.1.body': 'Choisissez une période et confirmez la taille de votre exploitation. Le niveau de pluie de chaque période est fixé à partir de 44 ans de relevés. Si la pluie manque, vous êtes payé automatiquement.',
  'tour.farmer.2.title': 'Trois sources, une décision juste',
  'tour.farmer.2.body':
    'CHIRPS, NASA POWER et Meteostat mesurent la pluie séparément. Au moins deux doivent répondre avant qu’un résultat compte : une mauvaise mesure ne peut pas décider seule de votre indemnité.',
  'tour.farmer.3.title': 'Payé selon votre achat',
  'tour.farmer.3.body':
    'Une couverture achetée vous-même paie sur votre portefeuille Sepolia ; une couverture vendue par un agent est payée par cet agent en naira. Suivez polices, indemnités et alertes depuis votre tableau de bord.',
  'tour.admin.1.title': 'Traiter la file d’évaluation',
  'tour.admin.1.body': 'Les polices dont la période est close apparaissent dans la vue d’ensemble. Ouvrez-en une pour demander un tour d’oracle et la régler sur la blockchain.',
  'tour.admin.2.title': 'Éprouver l’oracle',
  'tour.admin.2.body': 'Corrompez une source pendant l’évaluation ou ouvrez le backtest pour comparer source unique, poids égaux et pondération par réputation.',
  'tour.admin.3.title': 'Suivre les événements en direct',
  'tour.admin.3.body': 'Souscriptions, indemnités et règlements arrivent en notifications sur tous vos appareils. Utilisez la recherche (Ctrl K) pour aller partout.',
  'tour.agent.1.title': 'Assurez des agriculteurs depuis votre portefeuille',
  'tour.agent.1.body':
    'Choisissez un agriculteur, saisissez la taille de l’exploitation vérifiée avec lui et payez la prime depuis votre portefeuille d’agent. Si la saison est trop sèche, l’indemnité arrive automatiquement sur votre portefeuille.',
  'tour.agent.2.title': 'Aucune connaissance crypto requise',
  'tour.agent.2.body': 'L’agriculteur n’a besoin ni de portefeuille ni de connaissances blockchain. Vous gérez la transaction et lui payez les naira de son reçu.',
  'tour.agent.3.title': 'Suivre chaque police',
  'tour.agent.3.body': 'Suivez chaque police vendue, son statut et son indemnité depuis votre tableau de bord d’agent et vos notifications.',
  'release.1.title': 'Notifications en temps réel',
  'release.1.body': 'Un centre de notifications avec les souscriptions et règlements, et une cloche dans la barre.',
  'release.2.title': 'Vues liste et cartes',
  'release.2.body': 'Basculez entre listes denses et cartes pour les polices, agriculteurs et indemnités, avec des filtres adaptés à tout écran.',
  'release.3.title': 'Recherche rapide',
  'release.3.body': 'Appuyez sur Ctrl K ou utilisez la recherche latérale pour aller à n’importe quelle page, police ou agriculteur.',
  'release.4.title': 'Nouvelles couleurs',
  'release.4.body': 'Un accent pétrole plus calme, avec des variantes indigo, prune et graphite en mode clair et sombre.',
  'release.5.title': 'Sécurité du compte',
  'release.5.body': 'Réinitialisez un mot de passe oublié, vérifiez votre e-mail et changez votre mot de passe dans les Paramètres.'
};
