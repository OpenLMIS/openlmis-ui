import { describe, expect, it } from 'vitest';
import {
  changeMode,
  changeProgram,
  facilityProgramOptions,
  facilityProgramSearchSchema,
  initialSelection,
  isCompleteSelection,
  validSelection,
} from '@/lib/facility-program-selection';

const named = (id: string, name: string | null = id.toUpperCase()) => ({ id, code: id, name });

const HOME = 'home';

const sources = {
  homeFacilityId: HOME,
  programs: [named('pb', 'Beta'), named('pa', 'Alpha'), named('pc', 'Gamma'), named('pz', 'Zeta')],
  facilities: [named(HOME, 'Home Clinic'), named('fz', 'Zomba'), named('fa', 'Ayotte')],
  grants: [
    { facilityId: HOME, programId: 'pa' },
    { facilityId: HOME, programId: 'pb' },
    { facilityId: 'fz', programId: 'pb' },
    { facilityId: 'fa', programId: 'pb' },
    { facilityId: 'fa', programId: 'pc' },
    { facilityId: 'fa', programId: 'pc' },
    { facilityId: 'gone', programId: 'pc' },
    { facilityId: 'fz', programId: 'not-mine' },
  ],
};

describe('facilityProgramOptions', () => {
  const options = facilityProgramOptions(sources);

  it('finds the home facility among the facilities', () => {
    expect(options.home).toEqual(named(HOME, 'Home Clinic'));
  });

  it('offers my facility the programs granted there, by name', () => {
    expect(options.myPrograms.map((program) => program.id)).toEqual(['pa', 'pb']);
  });

  it('offers supervised programs granted at any other facility, each once, by name', () => {
    expect(options.supervisedPrograms.map((program) => program.id)).toEqual(['pb', 'pc']);
  });

  it('offers the facilities granted for the program, home included, by name, as legacy does', () => {
    expect(options.facilitiesFor('pb').map((facility) => facility.id)).toEqual(['fa', HOME, 'fz']);
    expect(options.facilitiesFor('pc').map((facility) => facility.id)).toEqual(['fa']);
    expect(options.facilitiesFor('pa').map((facility) => facility.id)).toEqual([HOME]);
  });

  it('has no home, and counts every grant as supervised, without a home facility', () => {
    const noHome = facilityProgramOptions({ ...sources, homeFacilityId: null });

    expect(noHome.home).toBeNull();
    expect(noHome.myPrograms).toEqual([]);
    expect(noHome.supervisedPrograms.map((program) => program.id)).toEqual(['pa', 'pb', 'pc']);
  });

  it('has no home when the home facility is not among the facilities', () => {
    expect(facilityProgramOptions({ ...sources, homeFacilityId: 'unknown' }).home).toBeNull();
  });

  it('sorts a program without a name by its code', () => {
    const options = facilityProgramOptions({
      ...sources,
      programs: [named('pa', 'Beta'), named('pb', null)],
    });

    expect(options.myPrograms.map((program) => program.id)).toEqual(['pa', 'pb']);
  });
});

describe('initialSelection', () => {
  const options = facilityProgramOptions(sources);

  it('starts on my facility, fixed to home, when the user has one', () => {
    expect(initialSelection({}, options)).toEqual({ mode: 'my', facilityId: HOME });
  });

  it('starts on supervised facilities without a home', () => {
    const noHome = facilityProgramOptions({ ...sources, homeFacilityId: null });

    expect(initialSelection({}, noHome)).toEqual({ mode: 'supervised' });
  });

  it('picks the only program my facility offers, as legacy does', () => {
    const onlyAlpha = facilityProgramOptions({
      ...sources,
      grants: [{ facilityId: HOME, programId: 'pa' }],
    });

    expect(initialSelection({}, onlyAlpha)).toEqual({
      mode: 'my',
      programId: 'pa',
      facilityId: HOME,
    });
  });

  it('picks the only supervised program and its only facility, as legacy does', () => {
    const onlyGamma = facilityProgramOptions({
      ...sources,
      homeFacilityId: null,
      grants: [{ facilityId: 'fa', programId: 'pc' }],
    });

    expect(initialSelection({}, onlyGamma)).toEqual({
      mode: 'supervised',
      programId: 'pc',
      facilityId: 'fa',
    });
  });

  it('keeps the selection the link holds, and picks no program from several', () => {
    const applied = { mode: 'supervised', programId: 'pc', facilityId: 'fa' } as const;

    expect(initialSelection(applied, options)).toEqual(applied);
  });

  it('fixes my facility to home whatever facility the link held', () => {
    expect(initialSelection({ mode: 'my', programId: 'pa', facilityId: 'fz' }, options)).toEqual({
      mode: 'my',
      programId: 'pa',
      facilityId: HOME,
    });
  });
});

describe('changeMode', () => {
  const options = facilityProgramOptions(sources);

  it('clears the program and facility, fixing my facility to home', () => {
    expect(changeMode('my', options)).toEqual({ mode: 'my', facilityId: HOME });
    expect(changeMode('supervised', options)).toEqual({ mode: 'supervised' });
  });

  it('picks the only program the mode offers, and its only facility', () => {
    const onlyGamma = facilityProgramOptions({
      ...sources,
      grants: [
        { facilityId: HOME, programId: 'pa' },
        { facilityId: 'fa', programId: 'pc' },
      ],
    });

    expect(changeMode('supervised', onlyGamma)).toEqual({
      mode: 'supervised',
      programId: 'pc',
      facilityId: 'fa',
    });
  });
});

describe('changeProgram', () => {
  const options = facilityProgramOptions(sources);

  it('keeps home on my facility', () => {
    expect(changeProgram({ mode: 'my', programId: 'pa', facilityId: HOME }, 'pb', options)).toEqual(
      {
        mode: 'my',
        programId: 'pb',
        facilityId: HOME,
      },
    );
  });

  it('keeps a supervised facility the new program is granted at', () => {
    expect(
      changeProgram({ mode: 'supervised', programId: 'pc', facilityId: 'fa' }, 'pb', options),
    ).toEqual({ mode: 'supervised', programId: 'pb', facilityId: 'fa' });
  });

  it('picks the only facility the new program is granted at, as legacy does', () => {
    expect(
      changeProgram({ mode: 'supervised', programId: 'pb', facilityId: 'fz' }, 'pc', options),
    ).toEqual({ mode: 'supervised', programId: 'pc', facilityId: 'fa' });
  });

  it('clears a supervised facility the new program is not granted at', () => {
    const wider = facilityProgramOptions({
      ...sources,
      grants: [...sources.grants, { facilityId: 'fz', programId: 'pc' }],
    });

    expect(
      changeProgram({ mode: 'supervised', programId: 'pb', facilityId: HOME }, 'pc', wider),
    ).toEqual({ mode: 'supervised', programId: 'pc' });
  });
});

describe('isCompleteSelection', () => {
  it('needs a mode, a program and a facility', () => {
    expect(isCompleteSelection({ mode: 'my', programId: 'pa', facilityId: HOME })).toBe(true);
    expect(isCompleteSelection({ mode: 'my', facilityId: HOME })).toBe(false);
    expect(isCompleteSelection({ programId: 'pa', facilityId: HOME })).toBe(false);
  });
});

describe('validSelection', () => {
  const options = facilityProgramOptions(sources);

  it('accepts a program granted at home on my facility', () => {
    expect(validSelection({ mode: 'my', programId: 'pa', facilityId: HOME }, options)).toEqual({
      mode: 'my',
      programId: 'pa',
      facilityId: HOME,
    });
  });

  it('refuses my facility at a facility other than home', () => {
    expect(validSelection({ mode: 'my', programId: 'pb', facilityId: 'fz' }, options)).toBeNull();
  });

  it('refuses a program not granted at the facility', () => {
    expect(validSelection({ mode: 'my', programId: 'pc', facilityId: HOME }, options)).toBeNull();
    expect(
      validSelection({ mode: 'supervised', programId: 'pc', facilityId: 'fz' }, options),
    ).toBeNull();
  });

  it('accepts home under supervised facilities when the program is granted elsewhere too', () => {
    expect(
      validSelection({ mode: 'supervised', programId: 'pb', facilityId: HOME }, options),
    ).not.toBeNull();
  });

  it('refuses a supervised program only granted at home, as legacy never offers it', () => {
    expect(
      validSelection({ mode: 'supervised', programId: 'pa', facilityId: HOME }, options),
    ).toBeNull();
  });

  it('refuses an incomplete selection', () => {
    expect(validSelection({ mode: 'supervised', programId: 'pb' }, options)).toBeNull();
  });
});

describe('facilityProgramSearchSchema', () => {
  const schema = facilityProgramSearchSchema;
  const id = '4727ecbf-df85-41ce-bbe0-bdcc3b1fe448';

  it('keeps a mode and ids', () => {
    expect(schema.parse({ mode: 'supervised', programId: id, facilityId: id })).toEqual({
      mode: 'supervised',
      programId: id,
      facilityId: id,
    });
  });

  it('drops a mode or id that is not one', () => {
    expect(schema.parse({ mode: 'all', programId: 'x', facilityId: 3 })).toEqual({});
  });
});
