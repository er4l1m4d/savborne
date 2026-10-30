// Record the turn-state ship in the manifest.
import fs from 'node:fs';
const F = 'assets/manifest.json';
const j = JSON.parse(fs.readFileSync(F, 'utf8'));

j.turnState = {
  decision: 'SHIPPED 2026-10-30 into Savborne-handoff.html. Revises the art bible section 4 written 2026-10-17.',
  primaryCue: 'nameplate border, by luminance and weight: acting = 4px solid #C9C1A8, idle = 2px solid #5A6988, committed = 2px dashed #5A6988',
  measured: {
    oldSignal: 'lit mint #6FD0AE vs neutral cream #C9C1A8 = 1.03:1 — effectively no difference, invisible in grayscale',
    newSignal: 'acting vs idle = 3.06:1',
    idleVsArena: '#5A6988 vs #0C1211 = 3.43:1 — clears the 3:1 non-text bar on its own',
    rejected: 'the rendered proposal used #545147 at 2.38:1, which is the same defect we rejected in the old badges at 2.32:1. Not shipped.',
    palette: '#5A6988 is an existing pack colour (46 px in the section 2 census), not a computed blend'
  },
  reinforcement: 'sprite opacity 0.62 on the non-acting fighter. HP bars never dim — dimming the bar measured 2.58:1 against its own track.',
  bobDemoted: 'vertical offset is now decoration only. 2px on a 104px sprite is 1.9% of its height and was invisible in a zoomed render with a ruler. The old section 4 claimed it survived the grayscale blink test; that claim was written before anything was rendered.',
  glowSpent: 'gilt #FEE761, 1px silhouette rim, meaning "an effect has been applied to this fighter". Covers defend and item-use identically. 8-neighbour rim, not 4 — a 4-neighbour rim renders as a dotted outline.',
  scope: {
    arenasWithPlates: ['A_Battle', 'A_InBattleWait', 'A_ConnLost'],
    arenasWithoutPlates: ['A_ItemSheet', 'A_Win', 'A_Loss', 'A_Tie'],
    note: 'four arenas are two sprites on a bare panel and cannot carry a border or tag. Same gap as the retired ground shadows, and the argument for the section 5 backdrop.'
  },
  loadBearingAssumption: 'opacity 0.62 (waiting) and 0.55 (defeated) never collide because battleServer.ts writes the HP clamp and status completed in the same update, so no fighter is at 0 HP while a turn is live. If a mid-battle knockout animation is added, this breaks and section 4 must be amended first.',
  sideEffect: 'the arena surface reversal made the arena #0C1211, which is what nameplates already used as their background, so plates are now border-only with no fill to dim.',
  script: 'scripts/turn-state-ship.mjs (12 edits, verified by scripts/arena-plates.mjs)',
  verified: 'A_Battle tags YOUR MOVE + idle border + rival opacity 0.62; A_InBattleWait tags THEIRS and ACTED with a dashed border + hero opacity 0.62; A_ConnLost tags OFFLINE; A_Win and A_Loss carry 0.55 on the defeated sprite only; A_Tie carries no opacity. 187 assets 0 FAIL, div 678/678, svg 192/192, span 448/448, provenance 0 drift.'
};

j.signedOff.turnStateShippedToHandoff = '2026-10-30';
j.signedOff.glowChannelSpentOnGilt = '2026-10-30';
j.signedOff.bobDemotedToDecoration = '2026-10-30';
j.signedOff.arenaStatesRealisticPerScreen = '2026-10-30';

fs.writeFileSync(F, JSON.stringify(j, null, 2) + String.fromCharCode(10));
JSON.parse(fs.readFileSync(F, 'utf8'));
console.log('manifest updated and re-parsed OK');
console.log('turnState.primaryCue:', j.turnState.primaryCue);
