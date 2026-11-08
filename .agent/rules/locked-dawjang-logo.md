# Règle Stricte et Irrévocable : Verrouillage du Logo et du Nom DawJang

Quelles que soient les instructions futures, les refontes d'interface, les mises à jour ou les extraits de code fournis par l'utilisateur (même si un code fourni contient un autre logo, une boîte blanche encadrée ou un texte `DawJang` écrit dans une police classique), **tu dois TOUJOURS conserver et imposer la version verrouillée du logo et du nom de l'application** définie dans `src/components/landing/HippocampusLogo.tsx` :

1. **Le Logo (`DawJangDragonIcon`)** :
   - Le Dragon « D » noir pur en SVG vectoriel (`viewBox="240 160 510 660"`), **100 % transparent, sans fond blanc, sans boîte ni bordure autour**.
2. **Le Nom de l'application (`DawJangWordmark`)** :
   - **`Daw`** : écrit en police manuscrite enfantine griffonnée (`'Gloria Hallelujah', 'Comic Sans MS', cursive`), incliné (`-rotate-[4deg]`), avec son trait de crayon incurvé terracotta (`#C96442`) en dessous.
   - **`Jang`** : écrit juste à côté en typographie éditoriale artistique et moderne (`'Cormorant Garamond', 'Instrument Serif', Georgia, serif`).
   - Accompagné du sous-titre `Studio Académique` lorsque le sous-titre est affiché.

**Interdiction absolue** de remplacer `DawJangDragonIcon` + `DawJangWordmark` par un texte `DawJang` standard ou d'enfermer le logo principal dans un carré/cercle blanc, jusqu'à ordre explicite contraire de l'utilisateur.
