import { describe, it, expect } from 'vitest';
import { statusChangeMessage, isConsensusUnanimous } from './notifications.js';

describe('statusChangeMessage', () => {
  it('collaborative: genérica, sem motivo técnico', () => {
    const msg = statusChangeMessage({ groupType: 'collaborative', name: 'Ana', groupName: 'Família', newState: 'paused' });
    expect(msg).toBe('Ana pausou o compartilhamento de localização no grupo Família.');
    expect(msg).not.toMatch(/GPS|internet/i);
  });
  it('supervised + unavailable: inclui motivo técnico', () => {
    const msg = statusChangeMessage({ groupType: 'supervised', name: 'Bia', groupName: 'Turma', newState: 'unavailable' });
    expect(msg).toMatch(/indisponível/);
    expect(msg).toMatch(/GPS|internet|app fechado/i);
  });
  it('volta a compartilhar', () => {
    expect(statusChangeMessage({ groupType: 'collaborative', name: 'Ana', groupName: 'G', newState: 'active' })).toMatch(/voltou a compartilhar/);
  });
});

describe('isConsensusUnanimous', () => {
  it('true só quando todos os membros ativos concordaram', () => {
    expect(isConsensusUnanimous(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(isConsensusUnanimous(['a', 'b', 'c'], ['a', 'b'])).toBe(false); // falta c
  });
  it('grupo vazio nunca é unânime', () => {
    expect(isConsensusUnanimous([], [])).toBe(false);
  });
  it('revogar consenso (remover um) desliga', () => {
    const members = ['a', 'b'];
    const agreed = new Set(['a', 'b']);
    expect(isConsensusUnanimous(members, agreed)).toBe(true);
    agreed.delete('b');
    expect(isConsensusUnanimous(members, agreed)).toBe(false);
  });
});
