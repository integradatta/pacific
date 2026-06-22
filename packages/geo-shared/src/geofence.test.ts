import { describe, it, expect } from 'vitest';
import { evaluateGeofence, isWithinSchedule } from './geofence.js';

describe('evaluateGeofence (anti-bounce 20%)', () => {
  const R = 1000; // raio 1km → banda morta [800m, 1200m]
  it('entra quando cruza para dentro do limiar interno', () => {
    expect(evaluateGeofence(700, R, false)).toEqual({ inside: true, event: 'enter' });
  });
  it('sai quando cruza para fora do limiar externo', () => {
    expect(evaluateGeofence(1300, R, true)).toEqual({ inside: false, event: 'exit' });
  });
  it('banda morta mantém estado anterior, sem evento', () => {
    expect(evaluateGeofence(1000, R, true)).toEqual({ inside: true, event: null });
    expect(evaluateGeofence(1000, R, false)).toEqual({ inside: false, event: null });
  });
  it('primeira observação estabelece estado sem evento', () => {
    expect(evaluateGeofence(500, R, null)).toEqual({ inside: true, event: null });
    expect(evaluateGeofence(1500, R, null)).toEqual({ inside: false, event: null });
  });
  it('sem evento repetido quando continua dentro', () => {
    expect(evaluateGeofence(100, R, true)).toEqual({ inside: true, event: null });
  });
});

describe('isWithinSchedule', () => {
  const weekdays = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' };
  it('null = sempre ativo', () => {
    expect(isWithinSchedule(6, 0, null)).toBe(true);
  });
  it('dentro de dia útil e horário', () => {
    expect(isWithinSchedule(3, 12 * 60, weekdays)).toBe(true); // qua, 12:00
  });
  it('fora do dia (sábado=6)', () => {
    expect(isWithinSchedule(6, 12 * 60, weekdays)).toBe(false);
  });
  it('fora do horário', () => {
    expect(isWithinSchedule(3, 19 * 60, weekdays)).toBe(false);
  });
  it('janela que cruza a meia-noite (22:00–06:00)', () => {
    const night = { days: [1, 2, 3, 4, 5, 6, 7], start: '22:00', end: '06:00' };
    expect(isWithinSchedule(1, 23 * 60, night)).toBe(true);
    expect(isWithinSchedule(1, 3 * 60, night)).toBe(true);
    expect(isWithinSchedule(1, 12 * 60, night)).toBe(false);
  });
});
