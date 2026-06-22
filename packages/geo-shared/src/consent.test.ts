import { describe, it, expect } from 'vitest';
import { applySharingAction, consentReason } from './consent.js';

describe('applySharingAction', () => {
  it('pause/resume/revoke felizes para participant', () => {
    expect(applySharingAction('active', 'pause', { role: 'participant' })).toMatchObject({ next: 'paused' });
    expect(applySharingAction('paused', 'resume', { role: 'participant' })).toMatchObject({ next: 'active' });
    expect(applySharingAction('active', 'revoke', { role: 'participant' })).toMatchObject({ next: 'revoked' });
    expect(applySharingAction('paused', 'revoke', { role: 'admin' })).toMatchObject({ next: 'revoked' });
  });
  it('supervised_participant não pode pause/revoke (403)', () => {
    expect(applySharingAction('active', 'pause', { role: 'supervised_participant' }).result).toMatchObject({ allowed: false, status: 403 });
    expect(applySharingAction('active', 'revoke', { role: 'supervised_participant' }).result).toMatchObject({ allowed: false, status: 403 });
  });
  it('supervised_participant PODE ir a unavailable (sistema) e recuperar', () => {
    expect(applySharingAction('active', 'unavailable', { role: 'supervised_participant', bySystem: true })).toMatchObject({ next: 'unavailable' });
    expect(applySharingAction('unavailable', 'recover', { role: 'supervised_participant', bySystem: true })).toMatchObject({ next: 'active' });
  });
  it('transição inválida a partir do estado atual → 409', () => {
    expect(applySharingAction('revoked', 'pause', { role: 'participant' }).result).toMatchObject({ allowed: false, status: 409 });
    expect(applySharingAction('active', 'resume', { role: 'participant' }).result).toMatchObject({ allowed: false, status: 409 });
  });
});

describe('consentReason', () => {
  it('mapeia ação → motivo', () => {
    expect(consentReason('pause')).toBe('paused_by_user');
    expect(consentReason('unavailable')).toBe('gps_unavailable');
    expect(consentReason('revoke')).toBe('revoked_by_user');
  });
});
