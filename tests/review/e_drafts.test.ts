import { it, expect } from 'vitest';
import { MenuSystem as Menu } from '../../src/ui/Menu';
import { parseCourseId } from '../../src/game/CourseConfig';
// Round 2 (E12): an INVALID code left as a draft (typed, then Start clicked) — does Start still run?
// Replays Menu.activate() with the App's code-row set() semantics (App.ts:324-342) on a fake menu.
it('invalid code draft + Start: run starts anyway, error is never seen', () => {
  let codeError: string | null = null;
  let started = 0;
  const mk = () => ({
    items: [
      { kind: 'button', label: 'Start', primary: true, action: () => { started++; } },
      { kind: 'text', label: 'Enter a course code', get: () => '', set: (v: string) => {
        if (!parseCourseId(v)) { codeError = `“${v}” is not a course code`; fake.current = mk(); return; }
        codeError = null; fake.current = mk();
      } },
    ],
  });
  const fake: any = { drafts: new Map(), current: mk(), index: 0, onSound: () => {}, commitDrafts: (Menu.prototype as any).commitDrafts };
  fake.drafts.set(fake.current.items[1], 'NOPE-123'); // blur stored the draft (Menu.ts:215-219)
  (Menu.prototype as any).activate.call(fake); // the click on Start
  console.log(`invalid draft + Start: started=${started}, codeError=${JSON.stringify(codeError)}`);
  expect(started).toBe(1); // documents the defect: the run starts with the OLD course
  expect(codeError).not.toBeNull();
});
