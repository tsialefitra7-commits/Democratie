# Démocratie

Jeu de simulation politique et de stratégie, jouable dans un navigateur. Il tient dans **un seul fichier HTML** (`index.html`), sans aucune dépendance externe.

Vous incarnez un dirigeant élu d’une jeune démocratie. Votre objectif : tenir 48 mois, garder le pays stable et prospère, puis gagner l’élection. Vous pouvez respecter les règles du jeu démocratique… ou les contourner.

## Jouer

Ouvrez `index.html` dans n’importe quel navigateur récent. Pas de serveur, pas d’installation.

- **1 tour = 1 mois** et le mandat dure 48 mois. Chaque mois, 1 à 3 dossiers arrivent sur votre bureau (1 à 2 au début, 2 à 3 en fin de mandat).
- Chaque choix a des **effets immédiats**, parfois des **effets différés** (2 à 12 mois plus tard) et parfois un **aléa** (une affaire peut être découverte, un pari peut échouer).
- **8 indicateurs** : Popularité, Économie, Sécurité, Libertés civiles, Intégrité, Crédibilité internationale, Confiance des institutions (de 0 à 100) et Trésorerie (en milliards, elle peut être négative ; la faillite arrive à −60).
- **Opposition** : elle se renforce quand votre popularité baisse et se mobilise à l’approche du scrutin.
- **Dérive autoritaire** (jauge cachée) : elle monte avec les mesures antidémocratiques (contrôle des médias, juges aux ordres, état d’urgence, report des élections, fraude…). Elle n’est révélée qu’à la fin. La presse étrangère et les avertissements du tableau de bord donnent des indices.
- **Notes du conseiller** (option) : des flèches ▲/▼ indiquent la *tendance* des effets immédiats. Elles ne montrent ni l’ampleur exacte, ni les effets différés, ni les risques.
- Raccourcis clavier : **1 à 4** pour choisir, **Entrée** pour continuer.
- Trois niveaux de difficulté : Stagiaire, Normal, Realpolitik.

### Fins possibles (10)

| Type | Fins |
|---|---|
| Victoire | **Réélection démocratique**, ou **victoire entachée** (fraude ou dérive ≥ 35) |
| Défaite | **Sortie honorable**, ou **départ sous les huées** (contestation ratée) |
| Sombre | **Président à vie** (élections reportées ou résultat refusé avec succès) |
| Chute du régime | **Coup d’État**, **Révolution**, **Destitution**, **Banqueroute**, **Asphyxie internationale** (sanctions) |

Le score final tient compte de la moyenne des indicateurs, des mois passés au pouvoir, de la trésorerie et de la fin obtenue. Il est fortement pénalisé par la dérive autoritaire. Une réélection propre rapporte donc toujours plus qu’une victoire volée. Le meilleur score est conservé dans le navigateur (`localStorage`).

## Contenu

- **48 événements**, pour un total de 146 choix :
  - **42 événements aléatoires** : économie, social, scandales, presse, sécurité, institutions, international, catastrophes ;
  - **6 événements programmés** : investiture, budgets annuels, élections locales de mi-mandat, campagne, débat télévisé, dernier meeting ;
  - **1 carte spéciale** le soir d’une défaite : reconnaître le résultat, demander un recomptage ou refuser le verdict.
- **Tirage pondéré par l’état du pays.** Par exemple, une économie basse provoque plus de grèves et de crises bancaires, une intégrité basse plus de scandales, et une dérive élevée fait apparaître des manifestations pro-démocratie et des rumeurs de putsch.
- **Difficulté progressive.** Les effets négatifs s’amplifient avec le temps (jusqu’à +40 %), les événements « durs » deviennent plus fréquents et l’usure du pouvoir s’accentue.
- **Mécaniques croisées.** Le contrôle des médias réduit le risque qu’un scandale éclate, mais ronge les libertés à chaque mois. Les juges nommés par le pouvoir protègent de la destitution. Une armée choyée réduit le risque de coup d’État. Les fonds de corruption alimentent la caisse de campagne, qui pèse sur le vote.

## Architecture du code (`index.html`)

Le script est découpé en 7 sections commentées :

1. **Utilitaires** : `clamp`, générateur aléatoire déterministe (`makeRng`).
2. **Configuration** : constantes (`CONFIG`) et niveaux de difficulté (`DIFFICULTIES`).
3. **Indicateurs** : `INDICATORS`, état initial `START_STATE`.
4. **Événements** : tableau `EVENTS`, où chaque objet de données décrit un événement : `id`, `cat`, `title`, `text`, `weight(s)`, `when(s)`, `minTurn`, `cooldown`, `once`, `hard`, et `choices[]` avec `fx` (effets immédiats), `later` (effets différés), `risk` (aléa), `auth` (mesure antidémocratique), `flag` et `run` (effet scripté). Le calendrier des événements programmés est dans `SCHEDULE`.
5. **Moteur** (`Engine`) : logique pure, **sans accès au DOM**. On y trouve le tirage des événements, l’application des effets, l’évolution naturelle mensuelle (`drift`), les risques de chute (`risks`) et l’élection.
6. **Fins et score** : `ENDINGS`, `computeScore`, `rankOf`.
7. **Interface** (`UI`) : rendu du tableau de bord, de la carte d’événement, du journal et des écrans titre et de fin.

Pour ajouter un événement, ajoutez un objet dans `EVENTS`. Il sera automatiquement intégré au tirage.

## Équilibrage

Comme le moteur est indépendant du DOM, on peut le tester hors navigateur. `tools/simulate.js` joue des milliers de parties avec des profils de joueurs automatisés :

```bash
node tools/simulate.js 1000 normal          # répartition des fins par profil
node tools/simulate.js 300 normal --traj    # trajectoires moyennes des indicateurs
```

Résultats sur 1 000 parties par profil, en difficulté **Normal** :

| Profil (stratégie du bot) | Réélu | Victoire entachée | Défaite | Président à vie | Chute | Score moyen |
|---|---|---|---|---|---|---|
| **Équilibré** (pondère tous les indicateurs, reste démocrate) | 83 % | – | 17 % | – | 0 % | **1342** |
| **Intègre** (intégrité et libertés avant tout) | 20 % | – | 78 % | – | 3 % | 1106 |
| **Cynique** (corruption, fraude, petits arrangements) | – | 66 % | 25 % | – | 9 % | 960 |
| **Autocrate prudent** (autoritaire mais choie l’armée) | – | 8 % | – | 34 % | 57 % | 223 |
| **Économe** (austérité) | – | – | 67 % | – | 33 % | 1013 |
| **Populiste** (popularité à tout prix) | – | – | – | – | 100 % (faillite) | 517 |
| **Autoritaire** (toujours la mesure dure) | – | – | – | – | 100 % (coup d’État) | 34 |
| **Naïf** (au hasard, mais jamais de mesure autoritaire) | – | – | 31 % | – | 69 % | 642 |

Aucune stratégie extrême ne domine. Il faut arbitrer en permanence entre popularité, finances, intégrité et libertés. La triche peut marcher, mais elle rapporte nettement moins de points et fait courir un vrai risque de chute. Le bot « Équilibré » connaît les valeurs exactes des effets immédiats ; un humain n’a que les tendances du conseiller, ce qui rend le jeu plus difficile pour lui.

Le profil « Équilibré » gagne 100 % de ses parties en Stagiaire et 48 % en Realpolitik.

### Trois parties types

1. **La démocrate gestionnaire.** Elle promet la transparence à l’investiture. Elle négocie avec les grévistes, limoge le ministre au pont et laisse la juge travailler. Au 12ᵉ mois, elle vote un budget équilibré, puis accepte le prêt du FMI quand la trésorerie plonge. Sa popularité s’érode avec l’usure du pouvoir (de 60 à 55), mais son bilan reste solide. Elle est réélue avec environ 54 % des voix. C’est la fin la plus rentable, mais rien n’est garanti : un scandale découvert ou une pandémie mal gérée suffisent à basculer dans la défaite.
2. **Le populiste généreux.** Il subventionne le carburant, lance un plan massif pour l’hôpital, puis une relance budgétaire. Sa popularité grimpe à 70, mais la trésorerie passe sous −30 dès le 12ᵉ mois. Les intérêts de la dette rongent l’économie, et l’alerte « les créanciers s’affolent » s’allume. Sans un virage vers l’austérité, la faillite tombe vers le 18ᵉ mois.
3. **L’apprenti autocrate.** Il crée la « Haute Autorité de l’Information Responsable », décrète l’état d’urgence et fait nommer les juges par le pouvoir. Les sondages remontent et les scandales ne sortent plus. Mais la dérive cachée dépasse 50 et les rumeurs de putsch apparaissent. S’il n’achète pas l’armée, le coup d’État tombe vers le 20ᵉ mois. S’il l’achète puis reporte les élections, il a environ une chance sur trois de finir « Président à vie », avec un score dérisoire.
