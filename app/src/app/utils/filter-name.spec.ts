import { autoFilterName } from './filter-name';

describe('autoFilterName', () => {
  it('names single-day arrivals filters', () => {
    expect(autoFilterName('arrivals', 'yesterday')).toBe("Yesterday's arrivals");
    expect(autoFilterName('arrivals', 'today')).toBe("Today's arrivals");
    expect(autoFilterName('arrivals', 'tomorrow')).toBe("Tomorrow's arrivals");
  });

  it('names single-day departures filters', () => {
    expect(autoFilterName('departures', 'yesterday')).toBe("Yesterday's departures");
    expect(autoFilterName('departures', 'today')).toBe("Today's departures");
    expect(autoFilterName('departures', 'tomorrow')).toBe("Tomorrow's departures");
  });

  it('names multi-day arrivals/departures filters', () => {
    expect(autoFilterName('arrivals', 'next_7_days')).toBe('Arrivals · next 7 days');
    expect(autoFilterName('arrivals', 'next_14_days')).toBe('Arrivals · next 14 days');
    expect(autoFilterName('departures', 'next_7_days')).toBe('Departures · next 7 days');
    expect(autoFilterName('departures', 'next_14_days')).toBe('Departures · next 14 days');
  });

  it('names in_house filters regardless of day', () => {
    expect(autoFilterName('in_house', 'today')).toBe('In-house');
    expect(autoFilterName('in_house', 'next_7_days')).toBe('In-house');
  });
});
