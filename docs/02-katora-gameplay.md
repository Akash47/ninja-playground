# Katora: gameplay draft v0.3

Katora = the bowl in the middle that holds the pot. Play money only (chips).

## Setup
- 2-8 players. Each starts with 100 chips. Ante = 10 chips.
- Ranks: Ace (1) lowest up to King (13) highest. Suits ignored.

## A round
1. If the katora is LOW (less than one ante), every player puts in an ante. Otherwise no ante.
2. Every player is dealt 2 cards, face up (sorted low to high).
3. Turn by turn, starting from this round's first seat, the player BIDS before the dealer opens the card:
   - whole number from 0 to min(own chips, katora - 1). Never the full katora.
   - bid 0 = pass: no card is opened, the turn ends.
4. The dealer opens one card.
   - Strictly BETWEEN the two cards: WIN. The bid comes out of the katora to the player.
   - Equal to a card, or outside: LOSE. The bid goes from the player into the katora.
5. After every player has had one turn, the round ends. The first seat moves one seat along, cards are dealt again, next round.
6. Players with 0 chips sit out. When the katora is low, players who cannot pay the ante sit out. When fewer than 2 can play, the game ends; most chips wins.

## Decisions made
- Passing is allowed. First seat rotates every round. Ante only when the katora is low.

## Defaults I chose (change any)
- D1 "Low" = katora has less than one ante (10).
- D2 Hitting a card exactly is a normal loss.
- D3 A hand with nothing possible between (a pair, or ranks 1 apart) is re-dealt automatically.
- D4 If every player keeps passing, the game never ends (a UI "end game" button will cover this).

## Open questions
- Is "low" = less than one ante right, or should it be higher (e.g. less than half of all chips in play)?
- When the game ends, does the winner keep the leftover katora?
