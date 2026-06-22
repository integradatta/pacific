import { describe, it, expect } from 'vitest';
import { checkRoleTransition, checkLastAdmin, canMemberLeave } from './membership.js';

describe('checkRoleTransition', () => {
  it('permite promoção e rebaixamento entre participant e admin', () => {
    expect(checkRoleTransition('participant', 'admin', 'collaborative').allowed).toBe(true);
    expect(checkRoleTransition('admin', 'participant', 'collaborative').allowed).toBe(true);
  });
  it('permite remover supervisão (supervised_participant → participant)', () => {
    expect(checkRoleTransition('supervised_participant', 'participant', 'supervised').allowed).toBe(true);
  });
  it('ativar supervisão só em grupo supervised', () => {
    expect(checkRoleTransition('participant', 'supervised_participant', 'supervised').allowed).toBe(true);
    const r = checkRoleTransition('participant', 'supervised_participant', 'collaborative');
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.status).toBe(400);
  });
  it('rejeita transições fora da lista (400) e origem==destino', () => {
    const r = checkRoleTransition('admin', 'supervised_participant', 'supervised');
    expect(r).toMatchObject({ allowed: false, status: 400 });
    expect(checkRoleTransition('admin', 'admin', 'supervised').allowed).toBe(false);
  });
});

describe('checkLastAdmin', () => {
  it('bloqueia (409) sair/remover/rebaixar o último admin', () => {
    for (const action of ['leave', 'remove', 'demote'] as const) {
      const r = checkLastAdmin(action, 'admin', 1);
      expect(r).toMatchObject({ allowed: false, status: 409 });
    }
  });
  it('permite quando há outro admin', () => {
    expect(checkLastAdmin('demote', 'admin', 2).allowed).toBe(true);
  });
  it('não se aplica a não-admin', () => {
    expect(checkLastAdmin('leave', 'participant', 1).allowed).toBe(true);
  });
});

describe('canMemberLeave', () => {
  it('supervised_participant em grupo supervised NÃO pode sair', () => {
    expect(canMemberLeave('supervised_participant', 'supervised')).toBe(false);
  });
  it('demais podem sair', () => {
    expect(canMemberLeave('participant', 'collaborative')).toBe(true);
    expect(canMemberLeave('admin', 'supervised')).toBe(true);
  });
});
