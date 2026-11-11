/**
 * Achievements screen content and the in-play unlock toast (DOM only, no game logic).
 * The screen is a fixed panel: a summary line, a card grid (scrolls inside the panel only if it
 * cannot fit), then ordinary menu buttons, so keyboard / gamepad / mouse navigation is the same
 * as every other menu.
 */
import './progression.css';
import { CATEGORY_LABEL, type AchievementView } from '../progression/achievements';
import { icon } from './icons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtNum = (v: number) => Math.floor(v).toLocaleString('en-US');

/** Name of a cosmetic reward for a card (resolved by the caller). */
export type RewardName = (id: string) => string | null;

export function achievementCard(v: AchievementView, rewardName: RewardName = () => null): string {
  const d = v.def;
  if (v.secret)
    return `<div class="ach-card locked secret" data-id="${esc(d.id)}">${icon('secret')}<div class="ach-body"><div class="ach-name">???</div><div class="ach-desc">Hidden achievement — keep skiing to discover it.</div><div class="ach-meta"><span class="ach-cat">${CATEGORY_LABEL[d.category]}</span></div></div></div>`;
  const reward = d.reward ? rewardName(d.reward) : null;
  let status = '';
  if (v.earned && v.earnedAt) status = `<span class="ach-earned">Earned ${fmtDate(v.earnedAt)}</span>`;
  else if (v.progress) {
    const f = Math.max(0, Math.min(1, v.progress.value / v.progress.target));
    status = `<span class="ach-progress"><span class="ach-bar"><i style="width:${(f * 100).toFixed(1)}%"></i></span><span class="ach-count">${fmtNum(v.progress.value)} / ${fmtNum(v.progress.target)}${v.progress.unit ? ` ${v.progress.unit}` : ''}</span></span>`;
  } else if (d.requires) status = `<span class="ach-req">Needs the ${esc(d.requires)} (coming soon)</span>`;
  const rew = reward ? `<span class="ach-reward" title="Cosmetic reward">${icon('jacket', 'ach-mini')}${esc(reward)}</span>` : '';
  return `<div class="ach-card ${v.earned ? 'earned' : 'locked'}${d.requires && !v.earned ? ' future' : ''}" data-id="${esc(d.id)}">${icon(d.icon)}<div class="ach-body"><div class="ach-name">${esc(d.name)}</div><div class="ach-desc">${esc(d.description)}</div><div class="ach-meta"><span class="ach-cat">${CATEGORY_LABEL[d.category]}</span>${status}${rew}</div></div></div>`;
}

export function achievementsGrid(views: AchievementView[], rewardName?: RewardName): string {
  return `<div class="ach-grid">${views.map((v) => achievementCard(v, rewardName)).join('')}</div>`;
}

export function achievementsSummary(views: AchievementView[], note: string | null): string {
  const n = views.filter((v) => v.earned).length;
  return `<span class="ach-total"><b>${n}</b> / ${views.length} earned</span>${note ? ` · <span class="ach-note">${esc(note)}</span>` : ''}`;
}

/** Unlock toasts during play (queued; one at a time). Styled like the HUD. */
export class AchievementToast {
  private el: HTMLDivElement;
  private queue: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ach-toast';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    parent.appendChild(this.el);
  }

  show(name: string, iconId: string, sub: string | null) {
    this.queue.push(`${icon(iconId)}<div><div class="ach-toast-kicker">Achievement unlocked</div><div class="ach-toast-name">${esc(name)}</div>${sub ? `<div class="ach-toast-sub">${esc(sub)}</div>` : ''}</div>`);
    if (!this.timer) this.next();
  }

  private next() {
    const html = this.queue.shift();
    if (html === undefined) {
      this.timer = null;
      this.el.classList.remove('on');
      return;
    }
    this.el.innerHTML = html;
    this.el.classList.remove('on');
    void this.el.offsetWidth;
    this.el.classList.add('on');
    this.timer = setTimeout(() => this.next(), 4200);
  }

  get text(): string {
    return this.el.textContent ?? '';
  }
}
