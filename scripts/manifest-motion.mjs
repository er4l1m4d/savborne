// Record the section 4 / section 6 second revisions in the manifest.
import fs from 'node:fs';
const F = 'assets/manifest.json';
const j = JSON.parse(fs.readFileSync(F, 'utf8'));

j.motionSpec = {
  revised: '2026-10-30, second revision. Sections 4 and 6 of the art bible.',
  whySecondRevision: 'The first revision of each was written against assets-raw/turn-states.html, a scratch page I had authored from the spec. The handoff already contained a working motion vocabulary that contradicted almost every value. Same error twice: describing the artefact from a model of it instead of reading it.',
  authoritativeRead: 'scripts/motion-vocabulary.mjs — dumps every @keyframes, timing token, animation-bearing class and demo function out of Savborne-handoff.html. Run it before amending section 4 or 6.',
  correctedFromTheDocument: {
    lunge: '0 -> translateX(24px) -> 0, 450ms steps(6). I had specified 0 -> -3 -> +9 -> 0 at ease-out.',
    damage: '.sv-hit is filter:brightness(2.2) 400ms steps(4) PLUS sv-shake +-6px 300ms steps(5). I had specified a #FF706D colour tint, which the document has never implemented.',
    hpDrain: 'sv-fill 700ms steps(14). I had specified 500ms linear.',
    thinkingIndicator: 'sv-dots exists (width 0 -> 2ch). My first draft claimed no thinking indicator can work under polling; a HELD indicator works fine, an instantaneous one does not.',
    alsoMissed: 'sv-enter, sv-pop, sv-tick, sv-levelup, and the token set --sv-ease, --sv-t-press, --sv-t-enter, --sv-t-fill, --sv-t-pop',
  },
  houseRule: 'Motion is quantised. Every battle and feedback beat uses steps(n), not a smooth ease. Only sv-pop and sv-enter use --sv-ease, and they are transitions rather than state.',
  scopeNarrowed: 'Section 4 now governs only the two battle sprites and their nameplates. General UI motion is transition and feedback and is free of the one-channel-one-meaning rule. It had already broken that rule four times: sv-tick and sv-levelup use scale, sv-enter and sv-pop use vertical offset, sv-shake uses horizontal offset, and damage uses a filter rather than a tint.',
  channelIsGesture: 'A channel is a perceptual gesture, not a CSS property. Lunge and shake both animate translateX and both are legitimate because they are distinguishable without reading - one-way and committed versus two-way and decaying.',
  pendingWork: {
    timeoutBeat: 'Needs an API change. The server auto-plays defend on deadline and the payload reports it as a chosen move, so the client cannot tell them apart. Needs an auto / move_source flag on the move row, surfaced through the battle GET.',
    glowBeat: 'Needs a pre-baked 8-neighbour gilt rim path per character in assets/characters.json. Not done. A 4-neighbour rim renders as a dotted outline. filter: drop-shadow would break the quantised idiom. Until it lands, defend and item-use have no animation.',
    arenasWithoutPlates: 'A_ItemSheet, A_Win, A_Loss and A_Tie carry no nameplate, so handover and commit beats have nowhere to land.',
  },
  reducedMotion: 'Implemented twice in the document and both are required: a CSS media query, and a JS reduce flag from matchMedia used inside the demo functions. The media query alone cannot express "skip this beat but still drain the bar".',
};

j.signedOff.channelScopeNarrowedToBattleState = '2026-10-30';
j.signedOff.damageCueAdoptedFromDoc = '2026-10-30';
j.signedOff.motionSpecRewrittenFromDocument = '2026-10-30';

fs.writeFileSync(F, JSON.stringify(j, null, 2) + String.fromCharCode(10));
JSON.parse(fs.readFileSync(F, 'utf8'));
console.log('manifest updated and re-parsed OK');
console.log('keys now:', Object.keys(j).join(', '));
